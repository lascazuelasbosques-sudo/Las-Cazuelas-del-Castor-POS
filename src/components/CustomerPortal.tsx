import { useState, useEffect } from 'react';
import React from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Order } from '../types';
import { useBranding } from '../lib/useBranding';
import { Search, MapPin, Phone, Clock, ChevronRight, CheckCircle2, ChefHat, Bike, Package } from 'lucide-react';
import { Card, CardContent } from './Card';
import { cn } from '../lib/utils';
import WhatsAppInternoView from './WhatsAppInternoView';

export function CustomerPortal() {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { branding } = useBranding();
  const [hasIdUrl, setHasIdUrl] = useState(false);

  useEffect(() => {
    // Check URL search params for order ID (query inside search or query inside hash)
    let params: URLSearchParams;
    if (window.location.search) {
      params = new URLSearchParams(window.location.search);
    } else if (window.location.hash.includes('?')) {
      params = new URLSearchParams(window.location.hash.split('?')[1]);
    } else {
      params = new URLSearchParams();
    }
    
    const idFromUrl = params.get('id') || params.get('pedido');
    if (idFromUrl) {
      setHasIdUrl(true);
      setOrderId(idFromUrl);
      fetchOrder(idFromUrl);
    }
  }, []);

  const fetchOrder = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError('');
    try {
      const docRef = doc(db, 'orders', id.trim());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const orderData = { id: docSnap.id, ...docSnap.data() } as Order;
        setOrder(orderData);
      } else {
        setError('No pudimos encontrar este pedido. Verifica el código.');
        setOrder(null);
      }
    } catch (err) {
      console.error("Error fetching order:", err);
      setError('Error al consultar el pedido. Por favor intenta de nuevo.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(orderId);
    // Update URL without reload to make it shareable
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('id', orderId);
    window.history.replaceState({}, '', newUrl);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending': return { text: 'Recibido', color: 'bg-blue-100 text-blue-700', icon: Clock, progress: 25 };
      case 'preparing': return { text: 'En Cocina', color: 'bg-orange-100 text-orange-700', icon: ChefHat, progress: 50 };
      case 'ready': return { text: 'Listo para Empacar', color: 'bg-amber-100 text-amber-700', icon: Package, progress: 75 };
      case 'served': return { text: 'Entregado / Enviado', color: 'bg-mex-green/20 text-mex-green font-black', icon: Bike, progress: 100 };
      case 'paid': return { text: 'Completado', color: 'bg-mex-green/20 text-mex-green font-black', icon: CheckCircle2, progress: 100 };
      case 'cancelled': return { text: 'Cancelado', color: 'bg-red-100 text-red-700', icon: Clock, progress: 0 };
      default: return { text: 'Recibido', color: 'bg-stone-200 text-stone-700', icon: Clock, progress: 10 };
    }
  };

  // If no order ID is in the URL, assume they want the WhatsApp Customer Portal
  if (!hasIdUrl) {
    return (
      <div className="h-[100dvh] w-full relative flex flex-col bg-white overflow-hidden overscroll-none">
        <WhatsAppInternoView userRole="client" mode="client" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 md:bg-mex-cream flex flex-col font-sans text-stone-800 relative">
      {/* Header */}
      <header className="bg-stone-950 text-white py-8 px-4 shadow-2xl sticky top-0 z-20 overflow-hidden">
        <div className="absolute inset-0 bg-mex-gold/5 blur-3xl rounded-full -mt-20 -mr-20" />
        <div className="max-w-md mx-auto flex flex-col items-center gap-4 relative z-10">
          <div className="p-1 bg-white rounded-[2rem] shadow-xl border border-white/20">
            {branding.logoUrl && (
              <img src={branding.logoUrl} alt={branding.appName} className="h-20 w-20 object-cover rounded-[1.8rem]" />
            )}
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-serif font-black tracking-tight">{branding.appName}</h1>
            <p className="text-mex-gold text-[10px] font-black uppercase tracking-[0.3em]">Seguimiento en Vivo</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto p-4 md:py-8 flex flex-col gap-6">
        
        {/* Search Box */}
        <Card className="rounded-[2rem] border-stone-200 shadow-xl overflow-hidden bg-white">
          <CardContent className="p-6">
            <p className="text-sm font-bold text-stone-600 mb-4 text-center">Rastrea el estado de tu pedido</p>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input 
                  type="text" 
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="Código de tu pedido (Ej. ABC...)"
                  className="w-full bg-stone-50 border border-stone-200 text-stone-800 text-sm font-medium rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-mex-brown focus:border-transparent transition-all shadow-inner"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || !orderId.trim()}
                className="bg-mex-brown text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-mex-brown/90 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {loading ? '...' : 'Buscar'}
              </button>
            </form>
            {error && (
              <p className="text-red-500 text-xs font-bold mt-3 text-center bg-red-50 py-2 rounded-lg border border-red-100">{error}</p>
            )}
          </CardContent>
        </Card>

        {/* Order Details */}
        {order && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* Status Card */}
            <Card className="rounded-[2rem] border-stone-200 shadow-xl overflow-hidden bg-white">
              <div className="bg-stone-50 px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Pedido</p>
                  <p className="text-xl font-black text-stone-800">#{order.folio || order.id.substring(0, 5)}</p>
                </div>
                {order.clientName && (
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest">A nombre de</p>
                    <p className="font-bold text-mex-brown">{order.clientName}</p>
                  </div>
                )}
              </div>
              <CardContent className="p-6">
                
                {/* Visual Progress Bar */}
                <div className="mb-8 mt-2 relative">
                  <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-1000 ease-out", order.status === 'cancelled' ? 'bg-red-500' : 'bg-mex-green')}
                      style={{ width: `${getStatusInfo(order.status).progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 px-1">
                     <span className="text-[9px] font-bold text-stone-400 uppercase">Recibido</span>
                     <span className="text-[9px] font-bold text-stone-400 uppercase">Cocina</span>
                     <span className="text-[9px] font-bold text-stone-400 uppercase">Listo</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", getStatusInfo(order.status).color.replace('text-', 'text-').replace('bg-', 'bg-'))}>
                    {(() => {
                      const Icon = getStatusInfo(order.status).icon;
                      return <Icon size={28} strokeWidth={2.5}  />;
                    })()}
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Estado Actual</h3>
                    <p className={cn("text-lg font-black", order.status === 'cancelled' ? 'text-red-600' : 'text-stone-800')}>
                      {getStatusInfo(order.status).text}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card className="rounded-[2rem] border-stone-200 shadow-xl overflow-hidden bg-white">
               <div className="bg-stone-50 px-6 py-4 border-b border-stone-100">
                 <h3 className="font-black text-stone-800 text-sm uppercase tracking-wider">Tu Resumen</h3>
               </div>
               <CardContent className="p-0">
                  <div className="divide-y divide-stone-100">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center px-6 py-4">
                        <div className="flex items-baseline gap-3">
                          <span className="font-black text-mex-brown text-sm">{item.quantity}x</span>
                          <div>
                            <p className="font-bold text-stone-800">{item.name}</p>
                            {(item.notes || item.hasExtraCheese) && (
                              <p className="text-[10px] uppercase font-bold text-stone-500 mt-0.5">
                                {item.hasExtraCheese && <span className="text-amber-500">Extra Queso</span>}
                                {item.hasExtraCheese && item.notes && ' • '}
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="font-black text-stone-800">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-stone-50/50 p-6 border-t border-stone-100">
                     <div className="flex justify-between items-center text-xl">
                       <span className="font-black text-stone-800">Total</span>
                       <span className="font-black text-mex-green">${order.total.toFixed(2)}</span>
                     </div>
                  </div>
               </CardContent>
            </Card>
            
          </div>
        )}
      </main>
    </div>
  );
}
