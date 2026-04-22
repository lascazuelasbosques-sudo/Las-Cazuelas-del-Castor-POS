import { useState, useEffect } from "react";
import { CreditCard, DollarSign, Receipt, TrendingUp, TrendingDown, Clock, CheckCircle2, Trash2, Edit2, Plus, X, AlertTriangle, History } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { formatCurrency, cn, customRound } from "@/src/lib/utils";
import { Order, CashLog, OrderStatus } from "@/src/types";
import { db, auth } from "../firebase";
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, addDoc, deleteDoc, writeBatch, getDocs, getDocsFromServer } from "firebase/firestore";
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
      where("status", "in", ["pending", "preparing", "ready", "served"]),
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

    const toastId = toast.loading("Registrando pago...");
    try {
      const batch = writeBatch(db);
      
      // Update all orders in the group to paid
      selectedGroup.orders.forEach(order => {
        const orderCardFee = paymentMethod === 'card' ? customRound(order.total * CARD_FEE_PERCENTAGE) : 0;
        const orderTotal = customRound(order.total + orderCardFee);
        
        const orderRef = doc(db, "orders", order.id);
        batch.update(orderRef, {
          status: 'paid',
          paymentMethod,
          cardFee: orderCardFee,
          total: orderTotal,
          updatedAt: new Date().toISOString()
        });
      });

      // Add cash log entry
      const logRef = doc(collection(db, "cashLogs"));
      batch.set(logRef, {
        type: 'income',
        amount: finalTotal,
        reason: `Pago ${selectedGroup.displayTitle} (${paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}) - Folios: ${selectedGroup.folios.join(', ')}`,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email
      });

      await batch.commit();

      setShowPaymentModal(false);
      setSelectedGroup(null);
      setPaymentMethod('cash');
      toast.success("Pago registrado correctamente", { id: toastId });
    } catch (error) {
      console.error("Error in handleConfirmPayment:", error);
      handleFirestoreError(error, OperationType.WRITE, "orders/cashLogs");
      toast.error("Error al procesar el pago", { id: toastId });
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
    <div className="p-4 md:p-8 h-full overflow-hidden flex flex-col bg-mex-cream">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-mex-brown">Caja y Cobros</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-mex-green animate-pulse" />
            <p className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Estado: Turno Abierto</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1">
          {userRole === 'admin' && (
            <Button 
              variant="ghost" 
              className="flex-1 sm:flex-none gap-2 h-11 text-xs text-red-600 hover:bg-red-50 bg-white border border-stone-100 shadow-sm whitespace-nowrap"
              onClick={async () => {
                if (!confirm("¿Borrar TODO el historial de ventas, pedidos y caja? Se reiniciarán los folios a 001.")) return;
                const toastId = toast.loading("Borrando historial completo...");
                try {
                  const collections = ["cashLogs", "orders", "counters"];
                  for (const name of collections) {
                    const snap = await getDocsFromServer(collection(db, name));
                    const docs = snap.docs;
                    for (let i = 0; i < docs.length; i += 500) {
                      const batch = writeBatch(db);
                      docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
                      await batch.commit();
                    }
                  }
                  toast.success("Historial y folios reiniciados", { id: toastId });
                } catch (e: any) { 
                  console.error("Error al borrar:", e);
                  toast.error("Error: " + e.message, { id: toastId }); 
                }
              }}
            >
              <Trash2 size={16} />
              Limpiar
            </Button>
          )}
          <Button 
            variant="outline" 
            className="flex-1 sm:flex-none gap-2 h-11 text-xs bg-white border-stone-100 shadow-sm whitespace-nowrap"
            onClick={() => {
              setLogForm({ type: 'expense', amount: '', reason: '' });
              setShowLogModal(true);
            }}
          >
            <TrendingDown size={16} />
            Movimiento
          </Button>
          <Button 
            variant="primary" 
            className="flex-1 sm:flex-none gap-2 h-11 text-xs bg-mex-brown hover:bg-stone-800 shadow-md whitespace-nowrap"
            onClick={() => setShowClosingModal(true)}
          >
            <TrendingUp size={16} />
            Cierre
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 shrink-0">
        <Card className="bg-mex-green text-white border-none shadow-lg transform active:scale-[0.98] transition-transform">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] opacity-80 uppercase font-black tracking-widest mb-1">Efectivo en Caja</p>
              <p className="text-2xl md:text-3xl font-bold font-serif">{formatCurrency(totalCash)}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-2xl shadow-inner">
              <DollarSign size={28} />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-md overflow-hidden transform active:scale-[0.98] transition-transform">
          <CardContent className="p-5 flex items-center justify-between relative">
            <div className="z-10">
              <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest mb-1">Ventas de Hoy</p>
              <p className="text-2xl md:text-3xl font-bold text-stone-800 font-serif">{formatCurrency(stats.cashSales + stats.cardSales)}</p>
              <div className="flex gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-mex-green" />
                  <span className="text-[10px] text-stone-500 font-bold uppercase tracking-tighter">Efe: {formatCurrency(stats.cashSales)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] text-stone-500 font-bold uppercase tracking-tighter">Tar: {formatCurrency(stats.cardSales)}</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-mex-terracotta/5 text-mex-terracotta rounded-2xl">
              <Receipt size={28} />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-md hidden sm:block overflow-hidden transform active:scale-[0.98] transition-transform">
          <CardContent className="p-5 flex items-center justify-between w-full h-full relative">
            <div className="z-10">
              <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest mb-1">Cuentas Abiertas</p>
              <p className="text-2xl md:text-3xl font-bold text-stone-800 font-serif">{groupedOrders.length}</p>
              <div className="flex items-center gap-1 mt-2">
                <Clock size={12} className="text-stone-400" />
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-tighter">Esperando pago</span>
              </div>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <CreditCard size={28} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden pb-24 md:pb-8">
        <div className="flex flex-col gap-4 overflow-hidden bg-white/50 rounded-3xl p-2 border border-stone-100 shadow-inner">
          <div className="flex items-center justify-between px-4 py-2 bg-white rounded-2xl shadow-sm border border-stone-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-mex-gold/10 text-mex-gold rounded-xl">
                <CreditCard size={18} />
              </div>
              <h2 className="text-lg font-serif text-stone-800">Cuentas Pendientes</h2>
            </div>
            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{groupedOrders.length} MESAS</span>
          </div>
          
          <div className="flex-1 overflow-y-auto px-2 space-y-3 no-scrollbar pb-6">
            {groupedOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-20">
                <CheckCircle2 size={64} className="mb-4" />
                <p className="text-xl font-serif uppercase tracking-tighter">Todo al día</p>
                <p className="text-xs mt-1">No hay pedidos pendientes de cobro</p>
              </div>
            ) : (
              groupedOrders.map(group => (
                <Card key={group.id} className="border-none shadow-md hover:shadow-xl transition-all group overflow-hidden">
                  <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={cn("text-2xl font-black", group.isTakeaway ? "text-mex-terracotta" : "text-mex-green")}>
                          {group.displayTitle}
                        </p>
                        {group.isTakeaway && (
                          <span className="px-2 py-0.5 bg-mex-terracotta/10 text-mex-terracotta rounded text-[9px] font-black uppercase tracking-widest">PARA LLEVAR</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-[10px] text-stone-400 font-mono">Folios: {group.folios.join(', ')}</p>
                        <span className="text-stone-300 hidden sm:inline">•</span>
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Mesero: {group.waiterNames.join(', ')}</p>
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 border-t sm:border-none pt-3 sm:pt-0 mt-1 sm:mt-0">
                      <p className="text-2xl font-black text-mex-brown font-serif">{formatCurrency(group.total)}</p>
                      <div className="flex gap-2">
                        {onEditOrder && group.orders.length === 1 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-11 w-11 p-0 rounded-xl bg-stone-50 border border-stone-100 hover:text-mex-green"
                            onClick={() => onEditOrder(group.orders[0])}
                            title="Editar Pedido"
                          >
                            <Edit2 size={18} />
                          </Button>
                        )}
                        <Button 
                          variant="primary" 
                          className="h-11 px-6 bg-mex-green hover:bg-mex-green/90 rounded-xl shadow-md shadow-mex-green/20 font-black tracking-widest text-[11px] uppercase"
                          onClick={() => {
                            setSelectedGroup(group);
                            setShowPaymentModal(true);
                          }}
                        >
                          COBRAR
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-hidden bg-white/50 rounded-3xl p-2 border border-stone-100 shadow-inner">
          <div className="flex items-center justify-between px-4 py-2 bg-white rounded-2xl shadow-sm border border-stone-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-mex-brown/10 text-mex-brown rounded-xl">
                <History size={18} />
              </div>
              <h2 className="text-lg font-serif text-stone-800">Flujo de Caja</h2>
            </div>
            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{cashLogs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length} HOY</span>
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-2 no-scrollbar pb-6">
            {cashLogs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).map(log => (
              <div key={log.id} className="bg-white p-4 rounded-2xl border-none shadow-sm flex items-center justify-between group transition-all hover:shadow-md border border-stone-50">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                    log.type === 'expense' ? "bg-red-50 text-red-600 border border-red-100" : 
                    log.type === 'income' ? "bg-green-50 text-mex-green border border-green-100" :
                    "bg-blue-50 text-blue-600 border border-blue-100"
                  )}>
                    {log.type === 'expense' ? <TrendingDown size={22} /> : 
                     log.type === 'income' ? <TrendingUp size={22} /> : 
                     <DollarSign size={22} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-800 leading-tight truncate pr-4">{log.reason}</p>
                    <div className="flex items-center gap-1.5 mt-1 border border-stone-50 bg-stone-50/50 w-fit px-1.5 py-0.5 rounded-md">
                      <Clock size={10} className="text-stone-400" />
                      <p className="text-[9px] text-stone-500 font-bold uppercase tracking-wider">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.userName}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <p className={cn(
                    "text-lg font-black font-serif",
                    log.type === 'expense' ? "text-red-600" : "text-mex-green"
                  )}>
                    {log.type === 'expense' ? '-' : '+'}{formatCurrency(log.amount)}
                  </p>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openEditLog(log)}
                      className="p-2 text-stone-400 hover:text-mex-green hover:bg-stone-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    {userRole === 'admin' && (
                      <button 
                        onClick={() => handleDeleteLog(log.id)}
                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-stone-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {cashLogs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 opacity-20">
                <TrendingUp size={64} className="mb-4" />
                <p className="text-xl font-serif uppercase tracking-tighter">Sin movimientos</p>
                <p className="text-xs mt-1">No se han registrado ingresos o gastos hoy</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="bg-mex-brown text-white rounded-t-[2rem] p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <button onClick={() => setShowPaymentModal(false)} className="text-white/50 hover:text-white transition-colors"><X size={20}/></button>
              </div>
              <p className="text-[10px] font-black text-mex-gold uppercase tracking-[0.3em] mb-1">Total de Cuenta</p>
              <h3 className="text-4xl font-serif">{formatCurrency(finalTotal)}</h3>
              <div className="mt-2 flex flex-col items-center">
                <p className="text-[10px] text-white/60 font-mono italic">Folios: {selectedGroup.folios.join(', ')}</p>
                {paymentMethod === 'card' && (
                  <span className="mt-2 px-2 py-0.5 bg-white/10 rounded text-[9px] font-bold text-mex-gold uppercase">Incluye comisión 4%</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block text-center">Método de Pago</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setPaymentMethod('cash')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                      paymentMethod === 'cash' ? "bg-mex-green/5 border-mex-green text-mex-green" : "bg-stone-50 border-stone-100 text-stone-400 hover:border-stone-200"
                    )}
                  >
                    <DollarSign size={28} />
                    <span className="text-[10px] font-black uppercase">Efectivo</span>
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('card')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                      paymentMethod === 'card' ? "bg-blue-50 border-blue-600 text-blue-600" : "bg-stone-50 border-stone-100 text-stone-400 hover:border-stone-200"
                    )}
                  >
                    <CreditCard size={28} />
                    <span className="text-[10px] font-black uppercase">Tarjeta</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-2 text-center text-stone-500">
                <p className="text-[10px] font-bold uppercase tracking-widest">Resumen</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs px-2">
                    <span>Consumo</span>
                    <span className="font-bold">{formatCurrency(selectedGroup.total)}</span>
                  </div>
                  {paymentMethod === 'card' && (
                    <div className="flex justify-between text-xs px-2 text-mex-green">
                      <span>Comisión</span>
                      <span className="font-bold">+{formatCurrency(cardFee)}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0">
              <Button 
                variant="primary" 
                className="w-full h-14 text-lg font-black rounded-xl bg-mex-green hover:bg-mex-green/90 shadow-lg shadow-mex-green/20 tracking-widest" 
                onClick={handleConfirmPayment}
              >
                CONFIRMAR PAGO
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Closing Modal */}
      {showClosingModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl">
            <CardHeader className="bg-mex-brown text-white rounded-t-[2rem] p-6 text-center">
              <h3 className="text-2xl font-serif">Cierre de Caja</h3>
              <p className="text-[10px] text-mex-gold font-bold uppercase tracking-widest mt-1">Resumen del Turno</p>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3 px-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 italic">Apertura</span>
                  <span className="font-bold text-stone-700">{formatCurrency(stats.opening)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 italic">Ventas (Efectivo)</span>
                  <span className="font-bold text-mex-green">+{formatCurrency(stats.cashSales)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 italic">Ventas (Tarjeta)</span>
                  <span className="font-bold text-blue-600">+{formatCurrency(stats.cardSales)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 italic">Gastos</span>
                  <span className="font-bold text-mex-red">-{formatCurrency(stats.expenses)}</span>
                </div>
                <div className="pt-3 border-t border-stone-100 flex justify-between items-end">
                  <span className="text-xs font-black text-stone-400 uppercase tracking-widest">Total en Caja</span>
                  <span className="text-3xl font-serif font-bold text-mex-terracotta">{formatCurrency(totalCash)}</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 mt-4">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                <p className="text-[10px] text-amber-800 leading-relaxed italic">
                  Al confirmar el cierre, los pedidos "Served" o "Ready" no cobrados se mantendrán para el siguiente turno.
                </p>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0 flex gap-3">
              <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={() => setShowClosingModal(false)}>
                Atrás
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 h-12 text-xs font-black rounded-xl bg-mex-brown hover:bg-stone-800 shadow-lg shadow-mex-brown/20 tracking-widest uppercase" 
                onClick={handleCloseDay}
              >
                Cerrar Caja
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Log Modal (Create/Update) */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl">
            <CardHeader className="bg-mex-brown text-white rounded-t-[2rem] p-6 text-center">
              <h3 className="text-2xl font-serif">{editingLog ? 'Editar Movimiento' : 'Movimiento de Caja'}</h3>
              <p className="text-[10px] text-mex-gold font-bold uppercase tracking-widest mt-1">Registrar entrada o salida</p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setLogForm({...logForm, type: 'income'})}
                  className={cn(
                    "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                    logForm.type === 'income' ? "bg-mex-green/5 border-mex-green text-mex-green shadow-sm" : "bg-stone-50 border-stone-100 text-stone-400"
                  )}
                >
                  Ingreso
                </button>
                <button 
                  onClick={() => setLogForm({...logForm, type: 'expense'})}
                  className={cn(
                    "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                    logForm.type === 'expense' ? "bg-red-50 border-red-200 text-red-600 shadow-sm" : "bg-stone-50 border-stone-100 text-stone-400"
                  )}
                >
                  Egreso
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Monto</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input 
                      type="number" 
                      value={logForm.amount}
                      onChange={(e) => setLogForm({...logForm, amount: e.target.value})}
                      className="w-full pl-11 pr-4 py-4 text-2xl font-black bg-stone-50 rounded-2xl border border-stone-200 focus:border-mex-brown focus:ring-0 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Concepto</label>
                  <textarea 
                    value={logForm.reason}
                    onChange={(e) => setLogForm({...logForm, reason: e.target.value})}
                    className="w-full px-5 py-4 text-sm font-medium bg-stone-50 rounded-2xl border border-stone-200 focus:border-mex-brown focus:ring-0 outline-none min-h-[100px] no-scrollbar"
                    placeholder="Escribe la razón del movimiento..."
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0 flex gap-3">
              <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={() => setShowLogModal(false)}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-[2] h-12 text-xs font-black rounded-xl bg-mex-brown hover:bg-stone-800 shadow-lg shadow-mex-brown/20 tracking-widest uppercase" 
                onClick={handleSaveLog}
              >
                {editingLog ? 'Actualizar' : 'Registrar'}
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
