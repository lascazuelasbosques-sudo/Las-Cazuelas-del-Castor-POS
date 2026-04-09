import { useState, useEffect } from "react";
import { CreditCard, DollarSign, Receipt, TrendingUp, TrendingDown, Clock, CheckCircle2, Trash2, Edit2, Plus, X, AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { formatCurrency, cn, customRound } from "@/src/lib/utils";
import { Order, CashLog, OrderStatus } from "@/src/types";
import { db, auth } from "../firebase";
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, addDoc, deleteDoc, writeBatch, getDocs } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firestoreErrorHandler";
import toast from "react-hot-toast";

interface CashierViewProps {
  onEditOrder?: (order: Order) => void;
  userRole?: string;
}

export const CashierView = ({ onEditOrder, userRole = 'waiter' }: CashierViewProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cashLogs, setCashLogs] = useState<CashLog[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [loading, setLoading] = useState(true);

  interface GroupedOrder {
    id: string; // tableNumber or orderId for takeaway
    displayTitle: string;
    isTakeaway: boolean;
    total: number;
    orders: Order[];
    folios: string[];
    waiterNames: string[];
  }

  const groupedOrders = orders.reduce((acc: GroupedOrder[], order) => {
    const key = order.isTakeaway ? order.id : order.tableNumber;
    let group = acc.find(g => g.id === key);
    
    if (!group) {
      group = {
        id: key,
        displayTitle: order.isTakeaway ? 'Para Llevar' : `Mesa ${order.tableNumber}`,
        isTakeaway: order.isTakeaway,
        total: 0,
        orders: [],
        folios: [],
        waiterNames: []
      };
      acc.push(group);
    }
    
    group.orders.push(order);
    group.total += order.total;
    if (order.folio && !group.folios.includes(order.folio)) {
      group.folios.push(order.folio);
    }
    if (!group.waiterNames.includes(order.waiterName)) {
      group.waiterNames.push(order.waiterName);
    }
    
    return acc;
  }, []);

  // CRUD for Cash Logs
  const [showLogModal, setShowLogModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [editingLog, setEditingLog] = useState<CashLog | null>(null);
  const [logForm, setLogForm] = useState({
    type: 'expense' as 'income' | 'expense' | 'opening' | 'closing',
    amount: '',
    reason: ''
  });

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
  } | null>(null);

  const CARD_FEE_PERCENTAGE = 0.04; // 4% fee for card payments as requested

  useEffect(() => {
    const qOrders = query(
      collection(db, "orders"),
      where("status", "in", ["ready", "served"]),
      orderBy("createdAt", "asc")
    );

    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const orderData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(orderData);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "orders");
    });

    const qLogs = query(collection(db, "cashLogs"), orderBy("timestamp", "desc"));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashLog));
      setCashLogs(logData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "cashLogs");
    });

    return () => {
      unsubOrders();
      unsubLogs();
    };
  }, []);

  const cardFee = paymentMethod === 'card' ? customRound((selectedGroup?.total || 0) * CARD_FEE_PERCENTAGE) : 0;
  const finalTotal = customRound((selectedGroup?.total || 0) + cardFee);

  const handleConfirmPayment = async () => {
    if (!selectedGroup || !auth.currentUser) return;

    try {
      // Update all orders in the group to paid
      await Promise.all(selectedGroup.orders.map(order => {
        const orderCardFee = paymentMethod === 'card' ? customRound(order.total * CARD_FEE_PERCENTAGE) : 0;
        const orderTotal = customRound(order.total + orderCardFee);
        
        return updateDoc(doc(db, "orders", order.id), {
          status: 'paid',
          paymentMethod,
          cardFee: orderCardFee,
          total: orderTotal,
          updatedAt: new Date().toISOString()
        });
      }));

      // Add cash log entry
      await addDoc(collection(db, "cashLogs"), {
        type: 'income',
        amount: finalTotal,
        reason: `Pago ${selectedGroup.displayTitle} (${paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}) - Folios: ${selectedGroup.folios.join(', ')}`,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email
      });

      setShowPaymentModal(false);
      setSelectedGroup(null);
      setPaymentMethod('cash');
      toast.success("Pago registrado correctamente");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "orders/cashLogs");
    }
  };

  const handleSaveLog = async () => {
    if (!auth.currentUser) return;

    try {
      const amount = parseFloat(logForm.amount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Por favor ingresa un monto válido");
        return;
      }
      if (!logForm.reason.trim()) {
        toast.error("Por favor ingresa una razón");
        return;
      }

      const logData = {
        type: logForm.type,
        amount: amount,
        reason: logForm.reason.trim(),
        timestamp: editingLog ? editingLog.timestamp : new Date().toISOString(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email
      };

      if (editingLog) {
        await updateDoc(doc(db, "cashLogs", editingLog.id), logData);
        toast.success("Registro actualizado");
      } else {
        await addDoc(collection(db, "cashLogs"), logData);
        toast.success("Registro guardado");
      }

      setShowLogModal(false);
      setEditingLog(null);
      setLogForm({ type: 'expense', amount: '', reason: '' });
    } catch (error) {
      console.error("Error saving log:", error);
      toast.error("Error al guardar el registro");
    }
  };

  const handleDeleteLog = async (id: string) => {
    setConfirmAction({
      title: "Eliminar Registro",
      message: "¿Estás seguro de que deseas borrar este registro de caja? Esta acción no se puede deshacer.",
      action: async () => {
        try {
          await deleteDoc(doc(db, "cashLogs", id));
          toast.success("Registro eliminado");
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, "cashLogs");
        } finally {
          setShowConfirmModal(false);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const openEditLog = (log: CashLog) => {
    setEditingLog(log);
    setLogForm({
      type: log.type as any,
      amount: log.amount.toString(),
      reason: log.reason
    });
    setShowLogModal(true);
  };
  const totalCash = cashLogs.reduce((acc, log) => {
    if (log.type === 'opening' || log.type === 'income') return acc + log.amount;
    if (log.type === 'expense') return acc - log.amount;
    return acc;
  }, 0);

  const stats = cashLogs.reduce((acc, log) => {
    const isToday = new Date(log.timestamp).toDateString() === new Date().toDateString();
    if (!isToday) return acc;

    if (log.type === 'income') {
      if (log.reason.toLowerCase().includes('tarjeta')) {
        acc.cardSales += log.amount;
      } else {
        acc.cashSales += log.amount;
      }
    } else if (log.type === 'expense') {
      acc.expenses += log.amount;
    } else if (log.type === 'opening') {
      acc.opening = log.amount;
    }
    return acc;
  }, { cashSales: 0, cardSales: 0, expenses: 0, opening: 0 });

  const handleCloseDay = async () => {
    if (!auth.currentUser) return;
    
    try {
      await addDoc(collection(db, "cashLogs"), {
        type: 'closing',
        amount: totalCash,
        reason: `Cierre de Caja - Ventas Efectivo: ${formatCurrency(stats.cashSales)}, Tarjeta: ${formatCurrency(stats.cardSales)}, Gastos: ${formatCurrency(stats.expenses)}`,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email
      });
      
      setShowClosingModal(false);
      toast.success("Caja cerrada correctamente");
    } catch (error) {
      console.error("Error closing cash:", error);
      toast.error("Error al cerrar la caja");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mex-green"></div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 h-full overflow-hidden flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-serif text-mex-terracotta">Caja y Cobros</h1>
        <div className="flex gap-2">
          {userRole === 'admin' && (
            <Button 
              variant="ghost" 
              className="flex-1 sm:flex-none gap-2 h-10 text-xs md:text-sm text-red-600 hover:bg-red-50"
              onClick={async () => {
                if (!confirm("¿Borrar TODO el historial de caja?")) return;
                const toastId = toast.loading("Borrando...");
                try {
                  const snap = await getDocs(collection(db, "cashLogs"));
                  const docs = snap.docs;
                  for (let i = 0; i < docs.length; i += 500) {
                    const batch = writeBatch(db);
                    docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
                    await batch.commit();
                  }
                  toast.success("Historial borrado", { id: toastId });
                } catch (e) { toast.error("Error al borrar", { id: toastId }); }
              }}
            >
              <Trash2 size={16} />
              Limpiar Historial
            </Button>
          )}
          <Button 
            variant="outline" 
            className="flex-1 sm:flex-none gap-2 h-10 text-xs md:text-sm"
            onClick={() => {
              setLogForm({ type: 'expense', amount: '', reason: '' });
              setShowLogModal(true);
            }}
          >
            <TrendingDown size={16} />
            Gasto / Entrada
          </Button>
          <Button 
            variant="secondary" 
            className="flex-1 sm:flex-none gap-2 h-10 text-xs md:text-sm"
            onClick={() => setShowClosingModal(true)}
          >
            <TrendingUp size={16} />
            Cierre
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">
        <Card className="bg-mex-green text-white border-none">
          <CardContent className="p-4 md:p-6 flex items-center gap-4">
            <div className="p-2 bg-white/20 rounded-full">
              <DollarSign size={24} className="md:w-8 md:h-8" />
            </div>
            <div>
              <p className="text-[10px] md:text-sm opacity-80 uppercase font-bold tracking-wider">Efectivo</p>
              <p className="text-xl md:text-3xl font-bold">{formatCurrency(totalCash)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:p-6 flex items-center gap-4">
            <div className="p-2 bg-mex-terracotta/10 text-mex-terracotta rounded-full">
              <Receipt size={24} className="md:w-8 md:h-8" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] md:text-sm text-stone-500 uppercase font-bold tracking-wider">Ventas Hoy</p>
              <p className="text-xl md:text-3xl font-bold text-stone-800">{formatCurrency(stats.cashSales + stats.cardSales)}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] text-mex-green font-medium">Efe: {formatCurrency(stats.cashSales)}</span>
                <span className="text-[10px] text-blue-600 font-medium">Tar: {formatCurrency(stats.cardSales)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hidden sm:block">
          <CardContent className="p-4 md:p-6 flex items-center gap-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
              <Clock size={24} className="md:w-8 md:h-8" />
            </div>
            <div>
              <p className="text-[10px] md:text-sm text-stone-500 uppercase font-bold tracking-wider">Por Cobrar</p>
              <p className="text-xl md:text-3xl font-bold text-stone-800">{orders.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="flex flex-col gap-3 overflow-hidden">
          <h2 className="text-lg md:text-xl font-serif text-stone-800">Pedidos por Cobrar</h2>
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 pb-24 md:pb-6">
            {groupedOrders.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl">
                <CheckCircle2 size={32} className="mb-2 opacity-20" />
                <p>No hay pedidos pendientes</p>
              </div>
            ) : (
              groupedOrders.map(group => (
                <Card key={group.id} className="hover:border-mex-green transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between bg-stone-50 p-4">
                    <div>
                      <p className="text-xs text-stone-500 uppercase font-semibold">Mesa / Cuenta</p>
                      <p className="text-2xl font-bold text-mex-green">
                        {group.displayTitle}
                      </p>
                      <p className="text-[10px] text-stone-400 font-mono mt-1">
                        Folios: {group.folios.join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      {group.isTakeaway && (
                        <p className="text-[10px] text-mex-terracotta font-bold uppercase">Para Llevar (+5%)</p>
                      )}
                      <p className="text-lg font-bold text-mex-terracotta">{formatCurrency(group.total)}</p>
                      <p className="text-xs text-stone-400">
                        Mesero(s): {group.waiterNames.join(', ')}
                      </p>
                    </div>
                  </CardHeader>
                  <CardFooter className="p-3 bg-white border-t border-stone-100 flex gap-2">
                    {onEditOrder && group.orders.length === 1 && (
                      <Button 
                        variant="outline" 
                        className="w-1/3 gap-1 px-2"
                        onClick={() => onEditOrder(group.orders[0])}
                      >
                        <Edit2 size={16} />
                        Editar
                      </Button>
                    )}
                    <Button 
                      variant="primary" 
                      className={cn("gap-2", onEditOrder && group.orders.length === 1 ? "w-2/3" : "w-full")}
                      onClick={() => {
                        setSelectedGroup(group);
                        setShowPaymentModal(true);
                      }}
                    >
                      <CreditCard size={18} />
                      Cobrar Cuenta
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-hidden">
          <h2 className="text-xl font-serif text-stone-800">Historial de Caja</h2>
          <div className="flex-1 overflow-y-auto pr-2 space-y-2 pb-20 md:pb-6">
            {cashLogs.map(log => (
              <div key={log.id} className="bg-white p-3 rounded-xl border border-stone-100 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    log.type === 'expense' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                  )}>
                    {log.type === 'expense' ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-800">{log.reason}</p>
                    <p className="text-[10px] text-stone-400">
                      {new Date(log.timestamp).toLocaleTimeString()} • {log.userName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className={cn(
                    "font-bold",
                    log.type === 'expense' ? "text-red-600" : "text-green-600"
                  )}>
                    {log.type === 'expense' ? '-' : '+'}{formatCurrency(log.amount)}
                  </p>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openEditLog(log)}
                      className="p-1 text-stone-400 hover:text-mex-green"
                    >
                      <Edit2 size={14} />
                    </button>
                    {userRole === 'admin' && (
                      <button 
                        onClick={() => handleDeleteLog(log.id)}
                        className="p-1 text-stone-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Modal Placeholder */}
      {showPaymentModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="bg-mex-green text-white">
              <h3 className="text-xl font-serif">Cobrar {selectedGroup.displayTitle}</h3>
              <p className="text-sm opacity-80 font-mono">Folios: {selectedGroup.folios.join(', ')}</p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="text-center">
                <p className="text-sm text-stone-500 uppercase tracking-widest">Total a Pagar</p>
                <p className="text-5xl font-bold text-mex-terracotta mt-2">{formatCurrency(finalTotal)}</p>
                <div className="flex flex-col gap-1 mt-2">
                  {selectedGroup.isTakeaway && (
                    <p className="text-xs text-stone-400">Incluye cargo por desechables</p>
                  )}
                  {paymentMethod === 'card' && (
                    <p className="text-xs text-mex-green font-bold">Comisión por tarjeta (4%): {formatCurrency(cardFee)}</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant={paymentMethod === 'cash' ? 'primary' : 'outline'} 
                  className={cn("h-24 flex-col gap-2 transition-all", paymentMethod === 'cash' ? "border-mex-green shadow-lg" : "border-stone-200")}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <DollarSign size={32} />
                  Efectivo
                </Button>
                <Button 
                  variant={paymentMethod === 'card' ? 'primary' : 'outline'} 
                  className={cn("h-24 flex-col gap-2 transition-all", paymentMethod === 'card' ? "border-mex-green shadow-lg" : "border-stone-200")}
                  onClick={() => setPaymentMethod('card')}
                >
                  <CreditCard size={32} />
                  Tarjeta
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-700">Propina Sugerida</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="ghost" className="border border-stone-200">10%</Button>
                  <Button variant="ghost" className="border border-stone-200">15%</Button>
                  <Button variant="ghost" className="border border-stone-200">Otro</Button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowPaymentModal(false)}>
                Cancelar
              </Button>
              <Button variant="primary" className="flex-1 gap-2" onClick={handleConfirmPayment}>
                <CheckCircle2 size={18} />
                Confirmar Pago
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
      {/* Closing Modal */}
      {showClosingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="bg-mex-terracotta text-white flex flex-row items-center justify-between">
              <h3 className="text-xl font-serif">Cierre de Caja</h3>
              <button onClick={() => setShowClosingModal(false)}><X size={20}/></button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                  <span className="text-stone-500">Fondo Inicial</span>
                  <span className="font-medium">{formatCurrency(stats.opening)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                  <span className="text-stone-500">Ventas en Efectivo</span>
                  <span className="font-medium text-mex-green">+{formatCurrency(stats.cashSales)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                  <span className="text-stone-500">Ventas con Tarjeta</span>
                  <span className="font-medium text-blue-600">+{formatCurrency(stats.cardSales)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                  <span className="text-stone-500">Gastos / Salidas</span>
                  <span className="font-medium text-red-600">-{formatCurrency(stats.expenses)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-bold text-stone-800">Total en Caja</span>
                  <span className="text-2xl font-bold text-mex-terracotta">{formatCurrency(totalCash)}</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                <p className="text-xs text-amber-800">
                  Al confirmar el cierre, se generará un registro histórico con el balance final. 
                  Asegúrate de que el efectivo físico coincida con el total en caja.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowClosingModal(false)}>
                Cancelar
              </Button>
              <Button variant="primary" className="flex-1 gap-2 bg-mex-terracotta hover:bg-mex-terracotta/90" onClick={handleCloseDay}>
                <CheckCircle2 size={18} />
                Confirmar Cierre
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Log Modal (Create/Update) */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="bg-mex-brown text-white flex flex-row items-center justify-between">
              <h3 className="text-xl font-serif">{editingLog ? 'Editar Registro' : 'Nuevo Registro de Caja'}</h3>
              <button onClick={() => setShowLogModal(false)}><X size={20}/></button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  variant={logForm.type === 'opening' ? 'primary' : 'outline'}
                  onClick={() => setLogForm({...logForm, type: 'opening'})}
                  className="gap-1 px-1 text-[10px]"
                >
                  <Plus size={14} />
                  Fondo Inicial
                </Button>
                <Button 
                  variant={logForm.type === 'income' ? 'primary' : 'outline'}
                  onClick={() => setLogForm({...logForm, type: 'income'})}
                  className="gap-1 px-1 text-[10px]"
                >
                  <TrendingUp size={14} />
                  Ingreso
                </Button>
                <Button 
                  variant={logForm.type === 'expense' ? 'primary' : 'outline'}
                  onClick={() => setLogForm({...logForm, type: 'expense'})}
                  className="gap-1 px-1 text-[10px]"
                >
                  <TrendingDown size={14} />
                  Egreso
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">Monto</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="number" 
                    value={logForm.amount}
                    onChange={(e) => setLogForm({...logForm, amount: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-mex-green focus:border-transparent outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">Concepto / Razón</label>
                <textarea 
                  value={logForm.reason}
                  onChange={(e) => setLogForm({...logForm, reason: e.target.value})}
                  className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-mex-green focus:border-transparent outline-none min-h-[100px]"
                  placeholder="Ej: Pago a proveedor, Venta manual, etc."
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowLogModal(false)}>
                Cancelar
              </Button>
              <Button variant="primary" className="flex-1 gap-2" onClick={handleSaveLog}>
                <CheckCircle2 size={18} />
                Guardar Registro
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4">
          <Card className="w-full max-w-md border-mex-red/30 shadow-2xl">
            <CardHeader className="bg-mex-red text-white flex flex-row items-center justify-between">
              <h3 className="text-xl font-serif flex items-center gap-2">
                <AlertTriangle size={20} />
                {confirmAction.title}
              </h3>
              <button onClick={() => setShowConfirmModal(false)}><X size={24}/></button>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-stone-700 font-medium">{confirmAction.message}</p>
            </CardContent>
            <CardFooter className="flex gap-2 p-4 bg-stone-50">
              <Button variant="ghost" className="flex-1" onClick={() => setShowConfirmModal(false)}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 gap-2 bg-mex-red hover:bg-red-700" 
                onClick={confirmAction.action}
              >
                <CheckCircle2 size={18} />
                Confirmar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
