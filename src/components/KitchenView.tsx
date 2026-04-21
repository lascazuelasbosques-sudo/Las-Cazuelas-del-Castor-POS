import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { Button } from "./Button";
import { Order, OrderStatus, OrderItem } from "@/src/types";
import { Clock, CheckCircle2, PlayCircle, ClipboardList, PlusCircle } from "lucide-react";
import { db } from "../firebase";
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc } from "firebase/firestore";
import { cn } from "@/src/lib/utils";
import toast from "react-hot-toast";
import { handleFirestoreError, OperationType } from "@/src/lib/firestoreErrorHandler";

interface KitchenTicket {
  id: string;
  orderId: string;
  order: Order;
  station: 'plancha' | 'cocina';
  items: OrderItem[];
  stationStatus: 'pending' | 'preparing';
}

interface KitchenViewProps {
  onEditOrder?: (order: Order) => void;
}

export const KitchenView = ({ onEditOrder }: KitchenViewProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStation, setActiveStation] = useState<'all' | 'plancha' | 'cocina'>('all');

  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "in", ["pending", "preparing"]),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(orderData);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "orders");
    });

    return () => unsubscribe();
  }, []);

  const updateOrderStatus = async (orderId: string, action: 'start_station' | 'finish_station', station: 'plancha' | 'cocina') => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      let updateData: any = {
        updatedAt: new Date().toISOString()
      };

      if (action === 'start_station') {
        const updatedItems = order.items.map(item => {
          const itemStation = item.station || 'cocina';
          if (itemStation === station && item.status !== 'completed') {
            return { ...item, status: 'preparing' };
          }
          return item;
        });

        updateData.items = updatedItems;
        updateData.status = 'preparing';

        await updateDoc(doc(db, "orders", orderId), updateData);
        toast.success(`Comanda de ${station === 'plancha' ? 'Parrilla' : 'Cocina'} en preparación`);
      } else if (action === 'finish_station') {
        // Mark items for this station as completed
        const updatedItems = order.items.map(item => {
          const itemStation = item.station || 'cocina';
          if (itemStation === station) {
            return { ...item, status: 'completed' };
          }
          return item;
        });

        updateData.items = updatedItems;

        // Check if ALL items are now completed
        const allCompleted = updatedItems.every(item => item.status === 'completed');
        if (allCompleted) {
          updateData.status = 'ready';
        }

        await updateDoc(doc(db, "orders", orderId), updateData);
        toast.success(`Comanda de ${station === 'plancha' ? 'Parrilla' : 'Cocina'} lista`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "orders");
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'preparing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ready': return 'bg-mex-green/10 text-mex-green border-mex-green/20';
      default: return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  const getTimeElapsed = (createdAt: string) => {
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return `${elapsed} min`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mex-green"></div>
      </div>
    );
  }

  const tickets: KitchenTicket[] = [];
  orders.forEach(order => {
    const planchaItems = order.items.filter(i => i.station === 'plancha');
    const cocinaItems = order.items.filter(i => i.station === 'cocina' || !i.station);

    const hasPendingPlancha = planchaItems.some(i => i.status !== 'completed');
    const hasPendingCocina = cocinaItems.some(i => i.status !== 'completed');

    if (hasPendingPlancha && (activeStation === 'all' || activeStation === 'plancha')) {
      tickets.push({
        id: `${order.id}-plancha`,
        orderId: order.id,
        order: order,
        station: 'plancha',
        items: planchaItems,
        stationStatus: planchaItems.some(i => i.status === 'preparing') ? 'preparing' : 'pending'
      });
    }
    
    if (hasPendingCocina && (activeStation === 'all' || activeStation === 'cocina')) {
      tickets.push({
        id: `${order.id}-cocina`,
        orderId: order.id,
        order: order,
        station: 'cocina',
        items: cocinaItems,
        stationStatus: cocinaItems.some(i => i.status === 'preparing') ? 'preparing' : 'pending'
      });
    }
  });

  return (
    <div className="p-3 md:p-6 h-full overflow-hidden flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-serif text-mex-terracotta">Comandas en Cocina</h1>
          <p className="text-xs text-stone-500 uppercase font-bold tracking-widest mt-1">
            {activeStation === 'all' ? 'Todas las estaciones' : activeStation === 'plancha' ? 'Estación: Parrilla' : 'Estación: Cocina'}
          </p>
        </div>

        <div className="flex bg-stone-100 p-1 rounded-xl self-start sm:self-auto">
          <button 
            onClick={() => setActiveStation('all')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all",
              activeStation === 'all' ? "bg-white text-mex-brown shadow-sm" : "text-stone-500 hover:text-stone-700"
            )}
          >
            Todas
          </button>
          <button 
            onClick={() => setActiveStation('cocina')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all",
              activeStation === 'cocina' ? "bg-blue-600 text-white shadow-sm" : "text-stone-500 hover:text-stone-700"
            )}
          >
            Cocina
          </button>
          <button 
            onClick={() => setActiveStation('plancha')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all",
              activeStation === 'plancha' ? "bg-orange-600 text-white shadow-sm" : "text-stone-500 hover:text-stone-700"
            )}
          >
            Parrilla
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 overflow-y-auto pr-1 pb-24 md:pb-6">
        {tickets.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-stone-400 opacity-40">
            <ClipboardList size={64} className="mb-4" />
            <p className="text-xl font-serif">No hay comandas pendientes</p>
            <p className="text-sm">En esta estación: {activeStation === 'plancha' ? 'Parrilla' : activeStation === 'cocina' ? 'Cocina' : 'Todas'}</p>
          </div>
        ) : (
          tickets.map(ticket => (
            <Card key={ticket.id} className={ticket.stationStatus === 'preparing' ? 'border-blue-500 ring-1 ring-blue-500/20' : ''}>
              <CardHeader className="flex flex-row items-center justify-between bg-stone-50">
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold">Mesa</p>
                  <p className="text-2xl font-bold text-mex-green">
                    {ticket.order.isTakeaway ? 'LLEVAR' : ticket.order.tableNumber}
                  </p>
                  {ticket.order.folio && (
                    <p className="text-[10px] text-stone-400 font-mono mt-1">Folio: {ticket.order.folio}</p>
                  )}
                  <div className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider w-fit mt-2", 
                    ticket.station === 'plancha' ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {ticket.station === 'plancha' ? '🔥 Parrilla' : '🍳 Cocina'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    {ticket.order.isTakeaway && (
                      <div className="px-2 py-0.5 rounded bg-mex-terracotta text-white text-[10px] font-bold uppercase mb-1">
                        Para Llevar
                      </div>
                    )}
                    <div className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase border mb-1", getStatusColor(ticket.stationStatus as OrderStatus))}>
                      {ticket.stationStatus === 'pending' ? 'Pendiente' : 'Preparando'}
                    </div>
                    <div className="flex items-center gap-1 text-stone-400 text-xs">
                      <Clock size={12} />
                      {getTimeElapsed(ticket.order.createdAt)}
                    </div>
                  </div>
                  
                  {onEditOrder && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 gap-1 text-[10px] font-bold uppercase text-mex-green hover:bg-mex-green/10 border border-mex-green/20"
                      onClick={() => onEditOrder(ticket.order)}
                    >
                      <PlusCircle size={14} />
                      Agregar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {ticket.items.map((item, idx) => (
                  <div key={idx} className={cn("flex justify-between items-start p-2 rounded", item.status === 'completed' ? "bg-stone-100 opacity-50" : "")}>
                    <div className="flex gap-2">
                      <span className={cn("font-bold", item.status === 'completed' ? "text-stone-500" : "text-mex-terracotta")}>{item.quantity}x</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={cn("font-medium leading-tight", item.status === 'completed' ? "text-stone-500 line-through" : "text-stone-800")}>{item.name}</p>
                          {item.status === 'completed' && (
                            <span className="text-[10px] bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded font-bold uppercase">Listo</span>
                          )}
                        </div>
                        {item.hasExtraCheese && <p className="text-xs text-mex-gold font-bold">🧀 CON QUESO EXTRA</p>}
                        {item.notes && <p className="text-xs text-mex-red italic">{item.notes}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
              <CardFooter className="p-3 bg-white border-t border-stone-100 flex gap-2">
                {ticket.stationStatus === 'pending' ? (
                  <Button 
                    variant="primary" 
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                    onClick={() => updateOrderStatus(ticket.orderId, 'start_station', ticket.station)}
                  >
                    <PlayCircle size={18} />
                    Empezar
                  </Button>
                ) : (
                  <Button 
                    variant="primary" 
                    className="w-full gap-2"
                    onClick={() => updateOrderStatus(ticket.orderId, 'finish_station', ticket.station)}
                  >
                    <CheckCircle2 size={18} />
                    Listo
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
