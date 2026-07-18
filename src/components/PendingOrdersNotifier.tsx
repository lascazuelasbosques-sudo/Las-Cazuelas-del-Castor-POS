import { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { Order, Category, Product } from "../types";
import { Bell, BellOff, Volume2, VolumeX, AlertTriangle, Clock, ChevronDown, ChevronUp, Eye, CheckCircle2, Mic } from "lucide-react";
import { formatCurrency } from "@/src/lib/utils";
import toast from "react-hot-toast";
import { useDraggable } from "../lib/useDraggable";

export function PendingOrdersNotifier({ userRole = 'waiter' }: { userRole?: string }) {
  const { dragProps, hasMoved } = useDraggable();
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

    if (soundEnabled && userRole !== 'admin') {
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
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" && userRole !== 'admin') {
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
        // Resume if paused
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        // Cancel previous speech to prevent overlapping queues
        window.speechSynthesis.cancel();
        
        // Use a small timeout so that the cancel operation fully completes in the browser's speech thread
        // before we queue the new utterance. This solves the famous WebKit bug where cancel() instantly
        // voids the immediately following speak() call.
        setTimeout(() => {
          try {
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Configure language and speech properties
            utterance.lang = "es-MX";
            utterance.rate = 0.95; // Slightly slower speed for clearer restaurant kitchen hearing
            utterance.pitch = 1.0;
            
            // Find any Spanish voice
            const voices = window.speechSynthesis.getVoices();
            const spanishVoice = voices.find(v => {
              const langLower = v.lang.toLowerCase();
              return langLower.includes("es-mx") || langLower.includes("es-es") || langLower.startsWith("es");
            });
            
            if (spanishVoice) {
              utterance.voice = spanishVoice;
            }
            
            utterance.onerror = (e) => {
              console.error("SpeechSynthesisUtterance error event:", e);
              // Fallback retry with default language if voice is unavailable or fails
              if (e.error === 'network' || e.error === 'voice-unavailable') {
                try {
                  const retryUtterance = new SpeechSynthesisUtterance(text);
                  retryUtterance.lang = "es-ES";
                  retryUtterance.rate = 0.95;
                  window.speechSynthesis.speak(retryUtterance);
                } catch (retryErr) {
                  console.error("Speech retry error:", retryErr);
                }
              }
            };

            window.speechSynthesis.speak(utterance);
          } catch (innerErr) {
            console.error("Error instantiating or speaking utterance:", innerErr);
          }
        }, 150);
      } catch (err) {
        console.error("Speech synthesis error:", err);
      }
    } else {
      console.warn("Speech synthesis not supported in this environment");
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

  // Load products and categories to identify drinks vs dishes
  useEffect(() => {
    const unsubscribeCat = onSnapshot(collection(db, "categories"), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    });
    const unsubscribeProd = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return () => {
      unsubscribeCat();
      unsubscribeProd();
    };
  }, []);

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
          // Optimization: only check for cancellation if it was previously pending or preparing
          if (dispOrder.status !== 'pending' && dispOrder.status !== 'preparing') {
            continue;
          }

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

      // Play sound and speak immediately on NEW order arrival if sound is enabled
      if (orders.length > prevOrdersCountRef.current) {
        const newest = orders[0];

        // Helper to check if an item is a drink
        const isDrinkItem = (item: any) => {
          // Check categories if loaded
          const prod = products.find(p => p.id === item.productId || p.name === item.name);
          if (prod) {
            const cat = categories.find(c => c.id === prod.categoryId);
            if (cat && cat.name.toLowerCase().includes('bebida')) {
              return true;
            }
          }
          const nameLower = item.name.toLowerCase();
          return nameLower.includes("agua") || 
                 nameLower.includes("jugo") || 
                 nameLower.includes("bebida") || 
                 nameLower.includes("refresco") || 
                 nameLower.includes("café") || 
                 nameLower.includes("cafe") || 
                 nameLower.includes("coca") || 
                 nameLower.includes("soda") || 
                 nameLower.includes("fanta") || 
                 nameLower.includes("sprite") || 
                 nameLower.includes("boing") || 
                 nameLower.includes("cerveza") || 
                 nameLower.includes("licuado") || 
                 nameLower.includes("té") || 
                 nameLower.includes("te");
        };

        const activeItems = newest.items.filter(item => item.status !== 'cancelled');
        const drinksToDeliver = activeItems.filter(isDrinkItem);
        const dishesToPrepare = activeItems.filter(item => !isDrinkItem(item));

        let shouldAlert = false;
        let speakMsg = "";

        const destiny = newest.isTakeaway 
          ? "para llevar" 
          : `para la mesa ${newest.tableNumber || ""}`;

        const activePlanchaSpecific = dishesToPrepare.some(i => i.station === 'plancha');
        const activeCocinaSpecific = dishesToPrepare.some(i => i.station === 'cocina' || !i.station);

        if (userRole === 'kitchen') {
          const relevantDishes = dishesToPrepare.filter(item => {
            if (item.station === 'cocina' || !item.station) return true;
            if (item.station === 'comun') {
              return activeCocinaSpecific || !activePlanchaSpecific;
            }
            return false;
          });
          shouldAlert = relevantDishes.length > 0;
          if (shouldAlert) {
            const listText = relevantDishes.map(item => `${item.quantity} ${item.name}`).join(", ");
            speakMsg = `Nuevo pedido ${destiny}. Preparar en cocina: ${listText}.`;
          }
        } else if (userRole === 'parrilla') {
          const relevantDishes = dishesToPrepare.filter(item => {
            if (item.station === 'plancha') return true;
            if (item.station === 'comun') {
              return activePlanchaSpecific && !activeCocinaSpecific;
            }
            return false;
          });
          shouldAlert = relevantDishes.length > 0;
          if (shouldAlert) {
            const listText = relevantDishes.map(item => `${item.quantity} ${item.name}`).join(", ");
            speakMsg = `Nuevo pedido ${destiny}. Preparar en parrilla: ${listText}.`;
          }
        } else {
          // For waiter, cashier, admin, or other roles, announce both dishes and drinks!
          shouldAlert = activeItems.length > 0;
          if (shouldAlert) {
            const dishesText = dishesToPrepare.map(item => `${item.quantity} ${item.name}`).join(", ");
            const drinksText = drinksToDeliver.map(item => `${item.quantity} ${item.name}`).join(", ");
            
            speakMsg = `Nuevo pedido ${destiny}.`;
            if (dishesToPrepare.length > 0) {
              speakMsg += ` Platillos a preparar: ${dishesText}.`;
            }
            if (drinksToDeliver.length > 0) {
              speakMsg += ` Bebidas a entregar: ${drinksText}.`;
            }
          }
        }

        if (shouldAlert) {
          if (soundEnabled && userRole !== 'admin') {
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
              duration: 5000,
              style: {
                background: "#1e293b",
                color: "#fff",
                fontWeight: "bold",
              }
            });
            
            // Reset the timer since we just spoke, preventing immediate repetition
            lastPlayTimeRef.current = Date.now();
          }

          // Trigger system background Notification
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" && userRole !== 'admin') {
            try {
              new Notification("🍳 ¡NUEVO PEDIDO RECIBIDO!", {
                body: speakMsg,
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
  }, [soundEnabled, userRole, categories, products]);

  // Periodic Voice Reminder of pending kitchen items (Every 10 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only preparers or cashier roles get reminders of pending kitchen items (exclude admin)
      const isRelevantRole = ['kitchen', 'parrilla', 'cashier'].includes(userRole);
      if (!isRelevantRole || userRole === 'admin') return;

      // Group pending items across all active orders
      const pendingItemsMap: Record<string, number> = {};
      let totalPendingCount = 0;

      pendingOrders.forEach(order => {
        const activeItemsInOrder = order.items.filter(i => i.status !== 'cancelled' && i.status !== 'completed');
        const activePlanchaSpecific = activeItemsInOrder.some(i => i.station === 'plancha');
        const activeCocinaSpecific = activeItemsInOrder.some(i => i.station === 'cocina' || !i.station);

        order.items.forEach(item => {
          const isCancelled = item.status === 'cancelled';
          const isCompleted = item.status === 'completed';
          if (isCancelled || isCompleted) return;

          // Check if this item matches the role's station or is a dish to prepare
          let matchesStation = false;
          if (userRole === 'kitchen') {
            if (item.station === 'cocina' || !item.station) {
              matchesStation = true;
            } else if (item.station === 'comun') {
              matchesStation = activeCocinaSpecific || !activePlanchaSpecific;
            }
          } else if (userRole === 'parrilla') {
            if (item.station === 'plancha') {
              matchesStation = true;
            } else if (item.station === 'comun') {
              matchesStation = activePlanchaSpecific && !activeCocinaSpecific;
            }
          } else {
            // For admin/cashier, we include all items that need preparation
            matchesStation = true;
          }

          if (matchesStation) {
            pendingItemsMap[item.name] = (pendingItemsMap[item.name] || 0) + item.quantity;
            totalPendingCount++;
          }
        });
      });

      if (totalPendingCount > 0 && soundEnabled) {
        const now = Date.now();
        // Prevent playing too rapidly (10 minutes = 600,000 ms, safeguard at 580,000 ms)
        if (now - lastPlayTimeRef.current >= 580000) {
          // Play chime
          audioRef.current?.play().catch(e => console.log("Sound loop play blocked:", e));

          const pendingItemsList = Object.entries(pendingItemsMap)
            .map(([name, qty]) => `${qty} ${name}`)
            .join(", ");

          const speakMsg = `Recordatorio de lo que falta por preparar en cocina: ${pendingItemsList}.`;

          // Delay to wait for chime sound
          setTimeout(() => {
            speakText(speakMsg);
          }, 1000);

          lastPlayTimeRef.current = now;
        }
      }
    }, 600000); // 10 minutes in ms

    return () => clearInterval(interval);
  }, [pendingOrders, soundEnabled, userRole]);

  if (pendingOrders.length === 0) {
    return null;
  }

  const criticalOrdersCount = pendingOrders.filter(o => getWaitTime(o.createdAt) >= 10).length;

  return (
    <div 
      className="fixed bottom-20 md:bottom-4 right-4 z-[99] flex flex-col items-end gap-2 max-w-[360px] w-full px-2 sm:px-0 select-none"
      {...dragProps}
    >
      {/* Alert Header Box / Pill */}
      <div 
        className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 ${
          criticalOrdersCount > 0 
            ? "bg-amber-500/95 text-white border-amber-600 shadow-amber-500/10" 
            : "bg-stone-900/95 text-white border-stone-800 shadow-black/30"
        }`}
      >
        <div 
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer" 
          onClick={(e) => {
            if (hasMoved) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            setIsOpen(!isOpen);
          }}
        >
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
