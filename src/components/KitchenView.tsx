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
    <div className="p-4 md:p-8 h-full overflow-hidden flex flex-col bg-mex-cream">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-mex-brown">Comandas en Cocina</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", 
              activeStation === 'plancha' ? "bg-orange-500" : activeStation === 'cocina' ? "bg-blue-500" : "bg-mex-green"
            )} />
            <p className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">
              {activeStation === 'all' ? 'Todas las estaciones' : activeStation === 'plancha' ? 'Estación: Parrilla' : 'Estación: Cocina'}
            </p>
          </div>
        </div>

        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-stone-100 self-start sm:self-auto overflow-x-auto no-scrollbar max-w-full">
          <button 
            onClick={() => setActiveStation('all')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeStation === 'all' ? "bg-mex-brown text-white shadow-md scale-100" : "text-stone-400 hover:text-stone-600 active:scale-95"
            )}
          >
            Todas
          </button>
          <button 
            onClick={() => setActiveStation('cocina')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border border-transparent",
              activeStation === 'cocina' ? "bg-blue-600 text-white shadow-md border-blue-500 scale-100" : "text-stone-400 hover:text-stone-600 active:scale-95"
            )}
          >
            Cocina
          </button>
          <button 
            onClick={() => setActiveStation('plancha')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border border-transparent",
              activeStation === 'plancha' ? "bg-orange-600 text-white shadow-md border-orange-500 scale-100" : "text-stone-400 hover:text-stone-600 active:scale-95"
            )}
          >
            Parrilla
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 overflow-y-auto pr-1 pb-24 md:pb-8">
        {tickets.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-stone-300">
            <ClipboardList size={80} className="mb-4 opacity-10" />
            <p className="text-xl font-serif opacity-40">No hay comandas pendientes</p>
            <p className="text-sm opacity-30 mt-1 uppercase tracking-tighter">Estación: {activeStation === 'plancha' ? 'Parrilla' : activeStation === 'cocina' ? 'Cocina' : 'Todas'}</p>
          </div>
        ) : (
          tickets.map(ticket => (
            <Card key={ticket.id} className={cn(
              "flex flex-col border-none shadow-lg transition-all",
              ticket.stationStatus === 'preparing' ? 'ring-2 ring-blue-500' : 'hover:shadow-xl'
            )}>
              <CardHeader className="flex flex-row items-center justify-between bg-stone-50/80 p-4 border-b border-stone-100">
                <div className="min-w-0">
                  <p className="text-[10px] text-stone-400 uppercase font-bold tracking-tighter">Mesa / Orden</p>
                  <p className="text-2xl font-bold text-mex-brown truncate">
                    {ticket.order.isTakeaway ? 'LLEVAR' : ticket.order.tableNumber}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 border border-stone-200 bg-white px-2 py-0.5 rounded-lg w-fit">
                    <div className={cn("w-1.5 h-1.5 rounded-full", ticket.station === 'plancha' ? "bg-orange-500" : "bg-blue-500")} />
                    <span className="text-[10px] font-bold text-stone-600 uppercase">{ticket.station === 'plancha' ? 'Parrilla' : 'Cocina'}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className={cn("px-2 py-1 rounded-xl text-[10px] font-black uppercase tracking-tighter border shadow-sm", getStatusColor(ticket.stationStatus as OrderStatus))}>
                    {ticket.stationStatus === 'pending' ? 'Pendiente' : 'En Proceso'}
                  </div>
                  <div className="flex items-center gap-1 text-stone-400 font-bold text-[10px]">
                    <Clock size={12} />
                    {getTimeElapsed(ticket.order.createdAt)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3 flex-1">
                {ticket.items.map((item, idx) => (
                  <div key={idx} className={cn("flex justify-between items-start p-3 rounded-xl border border-transparent transition-all", 
                    item.status === 'completed' ? "bg-stone-50 opacity-40 grayscale" : "bg-white shadow-sm border-stone-100"
                  )}>
                    <div className="flex gap-3">
                      <span className={cn("font-black text-lg", item.status === 'completed' ? "text-stone-300" : "text-mex-terracotta")}>{item.quantity}x</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={cn("font-bold text-sm leading-tight", item.status === 'completed' ? "text-stone-400 line-through" : "text-stone-800")}>{item.name}</p>
                          {item.status === 'completed' && (
                            <CheckCircle2 size={14} className="text-green-500" />
                          )}
                        </div>
                        {item.notes && <p className="text-[10px] text-mex-red italic font-medium mt-1 leading-tight">"{item.notes}"</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
              <CardFooter className="p-3 bg-stone-50/50 border-t border-stone-100 flex gap-2 shrink-0">
                {onEditOrder && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 h-11 gap-1 text-[10px] font-bold uppercase text-stone-500 hover:text-mex-green bg-white border border-stone-200"
                    onClick={() => onEditOrder(ticket.order)}
                  >
                    <PlusCircle size={16} />
                    <span className="hidden sm:inline">Agregar</span>
                  </Button>
                )}
                {ticket.stationStatus === 'pending' ? (
                  <Button 
                    variant="primary" 
                    className="flex-[2] h-11 gap-2 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
                    onClick={() => updateOrderStatus(ticket.orderId, 'start_station', ticket.station)}
                  >
                    <PlayCircle size={18} />
                    Comenzar
                  </Button>
                ) : (
                  <Button 
                    variant="primary" 
                    className="flex-[2] h-11 gap-2 bg-mex-green hover:bg-mex-green/90 shadow-md shadow-mex-green/20"
                    onClick={() => updateOrderStatus(ticket.orderId, 'finish_station', ticket.station)}
                  >
                    <CheckCircle2 size={18} />
                    Cerrar
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
