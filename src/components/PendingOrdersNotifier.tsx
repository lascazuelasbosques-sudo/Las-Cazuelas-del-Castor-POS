import { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { Order } from "../types";
import { Bell, BellOff, Volume2, VolumeX, AlertTriangle, Clock, ChevronDown, ChevronUp, Eye, CheckCircle2, Mic } from "lucide-react";
import { formatCurrency } from "@/src/lib/utils";
import toast from "react-hot-toast";

export function PendingOrdersNotifier({ userRole = 'waiter' }: { userRole?: string }) {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("pending_orders_sound_enabled");
    return saved === null ? true : saved === "true";
  });
  const [isOpen, setIsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevOrdersCountRef = useRef<number>(0);
  const lastPlayTimeRef = useRef<number>(0);
  const prevOrdersRef = useRef<Order[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "unsupported";
  });

  // Request notifications permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  // Sound/Speech warning for cancelled orders
  const triggerCancellationAlert = (order: Order) => {
    const orderInfo = order.isTakeaway ? "para llevar" : `de la Mesa ${order.tableNumber || ""}`;
    const speakMsg = `¡Atención! El pedido ${orderInfo} ha sido cancelado.`;

    if (soundEnabled) {
      speakText(speakMsg);

      // Play specific warning chime
      try {
        const cancelAudio = new Audio("https://assets.mixkit.co/active_storage/sfx/1446/1446-preview.mp3");
        cancelAudio.volume = 0.9;
        cancelAudio.play().catch(e => console.log("Sound blocked by browser:", e));
      } catch (e) {
        console.log("Audio play error:", e);
      }
    }

    // Trigger system background Notification
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("🛑 ¡PEDIDO CANCELADO!", {
          body: `El pedido ${orderInfo} ha sido cancelado.`,
          requireInteraction: true,
          tag: `cancelled-order-notifier-${order.id}`
        });
      } catch (e) {
        console.error("Web Notification error:", e);
      }
    }

    // Always show toast warning
    toast.error(`🚨 ¡PEDIDO CANCELADO! ${orderInfo.toUpperCase()}`, {
      duration: 10000,
      icon: "🛑",
      style: {
        background: "#dc2626",
        color: "#ffffff",
        fontWeight: "900",
        border: "2px solid #ef4444",
      }
    });
  };

  // Calculate wait time in minutes for an order
  const getWaitTime = (createdAtStr: string) => {
    try {
      const created = new Date(createdAtStr).getTime();
      const diffMs = Date.now() - created;
      const mins = Math.floor(diffMs / 60000);
      return mins < 0 ? 0 : mins;
    } catch {
      return 0;
    }
  };

  // Spanish Voice Text-to-Speech speaker
  const speakText = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        // Cancel any active speech to avoid queues piling up
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "es-MX";
        utterance.rate = 0.95; // Slightly slower speed for clearer restaurant kitchen hearing
        utterance.pitch = 1.0;
        
        // Try finding a Spanish voice
        const voices = window.speechSynthesis.getVoices();
        const spanishVoice = voices.find(v => v.lang.startsWith("es"));
        if (spanishVoice) {
          utterance.voice = spanishVoice;
        }
        
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error("Speech synthesis error:", err);
      }
    }
  };

  // Initialize sound chime
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2857/2857-preview.mp3");
    audioRef.current.volume = 0.8;
  }, []);

  // Persist sound preference
  useEffect(() => {
    localStorage.setItem("pending_orders_sound_enabled", String(soundEnabled));
  }, [soundEnabled]);

  // Subscribe to unattended/unfinished orders
  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "in", ["pending", "preparing"]),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

      // --- DETECT CANCELLED ORDERS ---
      const prevOrders = prevOrdersRef.current;
      if (prevOrders.length > 0) {
        const currentIds = orders.map(o => o.id);
        const disappeared = prevOrders.filter(po => !currentIds.includes(po.id));

        for (const dispOrder of disappeared) {
          try {
            const { doc, getDoc } = await import("firebase/firestore");
            const orderDocRef = doc(db, "orders", dispOrder.id);
            const snap = await getDoc(orderDocRef);
            if (snap.exists()) {
              const data = snap.data() as Order;
              if (data.status === 'cancelled') {
                triggerCancellationAlert(data);
              }
            }
          } catch (err) {
            console.error("Error verifying cancellation in notifier:", err);
          }
        }
      }

      prevOrdersRef.current = orders;
      setPendingOrders(orders);

      // Play sound and speak immediately on NEW order arrival if sound is enabled and the user is the preparer
      if (orders.length > prevOrdersCountRef.current) {
        const newest = orders[0];

        // Filter items based on the user's preparation station
        const cocinaItems = newest.items.filter(item => (item.station === 'cocina' || !item.station) && item.status !== 'cancelled');
        const planchaItems = newest.items.filter(item => item.station === 'plancha' && item.status !== 'cancelled');

        let shouldAlert = false;
        let itemsToSpeak: typeof newest.items = [];

        if (userRole === 'kitchen') {
          shouldAlert = cocinaItems.length > 0;
          itemsToSpeak = cocinaItems;
        } else if (userRole === 'parrilla') {
          shouldAlert = planchaItems.length > 0;
          itemsToSpeak = planchaItems;
        }

        if (shouldAlert) {
          const destiny = newest.isTakeaway 
            ? "para llevar" 
            : `para la mesa ${newest.tableNumber || ""}`;
          
          const itemsListText = itemsToSpeak.map(item => `${item.quantity} ${item.name}`).join(", ");
          const speakMsg = `Nuevo pedido ${destiny}. Preparar: ${itemsListText}.`;

          if (soundEnabled) {
            // Play chime sound
            audioRef.current?.play().catch(err => {
              console.log("Audio blocked by browser, needs user interaction first.", err);
            });
            
            // Speak with a slight delay so it doesn't overlap with the chime
            setTimeout(() => {
              speakText(speakMsg);
            }, 800);

            const toastInfo = newest.folio || newest.tableNumber ? `Mesa ${newest.tableNumber}` : newest.clientName || "Llevar";
            toast(`🔔 Nuevo pedido recibido: ${toastInfo}`, {
              icon: "🍳",
              duration: 4000,
              style: {
                background: "#1e293b",
                color: "#fff",
                fontWeight: "bold",
              }
            });
            
            // Reset the timer since we just spoke, preventing immediate repetition
            lastPlayTimeRef.current = Date.now();
          }

          // Trigger system background Notification for the preparer
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("🍳 ¡NUEVO PEDIDO RECIBIDO!", {
                body: `Pedido ${destiny}. Preparar: ${itemsListText}.`,
                requireInteraction: true,
                tag: `new-order-notifier-${newest.id}`
              });
            } catch (e) {
              console.error("Web Notification error on new order:", e);
            }
          }
        }
      }

      prevOrdersCountRef.current = orders.length;
    }, (error) => {
      console.error("Error fetching pending orders for notifier:", error);
    });

    return () => unsubscribe();
  }, [soundEnabled, userRole]);

  // Periodic Reminder Sound Loop (Every 3 minutes if there are unattended orders)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only preparers get alerts
      const isPreparer = userRole === 'kitchen' || userRole === 'parrilla';
      if (!isPreparer) return;

      // Filter orders that have pending items for this specific station
      const relevantOrders = pendingOrders.filter(order => {
        const hasStationItems = order.items.some(item => {
          const isCancelled = item.status === 'cancelled';
          const isCompleted = item.status === 'completed';
          if (isCancelled || isCompleted) return false;

          if (userRole === 'kitchen') {
            return item.station === 'cocina' || !item.station;
          } else {
            return item.station === 'plancha';
          }
        });
        return hasStationItems;
      });

      if (relevantOrders.length > 0 && soundEnabled) {
        const now = Date.now();
        // Prevent playing too rapidly (3 minutes = 180,000 ms, safeguard at 170,000 ms)
        if (now - lastPlayTimeRef.current >= 170000) {
          // Play chime
          audioRef.current?.play().catch(e => console.log("Sound loop play blocked:", e));
          
          // Prepare friendly Spanish reminder
          const criticalCount = relevantOrders.filter(o => getWaitTime(o.createdAt) >= 10).length;
          let speakMsg = `Recordatorio: tienes ${relevantOrders.length} ${relevantOrders.length === 1 ? 'pedido pendiente' : 'pedidos pendientes'} de atender.`;
          if (criticalCount > 0) {
            speakMsg += ` ¡Atención! ${criticalCount} de ellos ya llevan más de diez minutos de espera.`;
          }
          
          // Delay to wait for chime sound
          setTimeout(() => {
            speakText(speakMsg);
          }, 1000);
          
          lastPlayTimeRef.current = now;
        }
      }
    }, 180000); // 3 minutes in ms

    return () => clearInterval(interval);
  }, [pendingOrders, soundEnabled, userRole]);

  if (pendingOrders.length === 0) {
    return null;
  }

  const criticalOrdersCount = pendingOrders.filter(o => getWaitTime(o.createdAt) >= 10).length;

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-[99] flex flex-col items-end gap-2 max-w-[360px] w-full px-2 sm:px-0">
      {/* Alert Header Box / Pill */}
      <div 
        className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 ${
          criticalOrdersCount > 0 
            ? "bg-amber-500/95 text-white border-amber-600 shadow-amber-500/10" 
            : "bg-stone-900/95 text-white border-stone-800 shadow-black/30"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <div className="relative shrink-0">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black ${
              criticalOrdersCount > 0 ? "bg-white text-amber-600" : "bg-mex-green text-white"
            }`}>
              {pendingOrders.length}
            </span>
            <span className={`absolute -inset-1 rounded-full animate-ping opacity-50 ${
              criticalOrdersCount > 0 ? "bg-white" : "bg-mex-green"
            }`} style={{ animationDuration: '2s' }} />
          </div>
          
          <div className="min-w-0 flex-1">
            <h5 className="text-[11px] font-black uppercase tracking-wider leading-none">
              {criticalOrdersCount > 0 ? "¡Pedidos Retrasados!" : "Pedidos Pendientes"}
            </h5>
            <p className="text-[10px] text-white/80 font-medium truncate mt-0.5">
              {criticalOrdersCount > 0 
                ? `${criticalOrdersCount} con más de 10 min de espera`
                : "Hay pedidos sin terminar en cocina"
              }
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Test Voice & Audio Button */}
          <button
            onClick={() => {
              audioRef.current?.play().catch(() => {});
              setTimeout(() => {
                speakText("Notificaciones de voz activadas en Las Cazuelas. Listo para recibir comandas.");
              }, 600);
              toast.success("Probando altavoz de voz...", { icon: "🗣️" });
            }}
            className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-all"
            title="Probar sonido y voz"
          >
            <Mic size={15} />
          </button>

          {/* Sound Toggle Button */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              toast.success(soundEnabled ? "Alertas sonoras silenciadas" : "Alertas sonoras activadas", {
                icon: soundEnabled ? "🔇" : "🔊"
              });
            }}
            className={`p-2 rounded-xl transition-all ${
              soundEnabled 
                ? "bg-white/20 text-white hover:bg-white/30" 
                : "bg-red-500/40 text-red-200 border border-red-500/30 hover:bg-red-500/50"
            }`}
            title={soundEnabled ? "Silenciar alertas" : "Activar alertas sonoras"}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          {/* Toggle Expand Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            {isOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded Pending List Box */}
      {isOpen && (
        <div className="w-full bg-white rounded-2xl shadow-2xl border border-stone-150 overflow-hidden max-h-[300px] flex flex-col transition-all duration-300">
          <div className="p-3 bg-stone-50 border-b border-stone-150 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Lista de Espera</span>
            <span className="text-[9px] font-bold text-stone-400 bg-stone-150 px-2 py-0.5 rounded-full">
              Real-time
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-stone-100 p-1">
            {pendingOrders.map((order) => {
              const mins = getWaitTime(order.createdAt);
              const isDelayed = mins >= 10;
              
              return (
                <div 
                  key={order.id} 
                  className={`p-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                    isDelayed ? "bg-amber-50/70 hover:bg-amber-100/60" : "hover:bg-stone-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[11px] font-black text-stone-900">
                        {order.folio ? `#${order.folio}` : "Sin Folio"}
                      </span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${
                        order.isTakeaway 
                          ? "bg-purple-100 text-purple-700" 
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {order.isTakeaway ? "Llevar" : `Mesa ${order.tableNumber}`}
                      </span>
                    </div>

                    <p className="text-[9px] text-stone-500 font-medium truncate">
                      {order.clientName || order.waiterName || "Cliente"}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className={`flex items-center gap-1 text-[10px] font-black ${
                      isDelayed ? "text-amber-600 animate-pulse" : "text-stone-500"
                    }`}>
                      <Clock size={11} />
                      <span>{mins} min</span>
                    </div>
                    
                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                      order.status === "pending" 
                        ? "bg-red-50 text-red-600 border border-red-100" 
                        : "bg-orange-50 text-orange-600 border border-orange-100"
                    }`}>
                      {order.status === "pending" ? "Pendiente" : "Cocina"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
