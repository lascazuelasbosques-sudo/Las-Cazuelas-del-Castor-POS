import { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { onOfflineSnapshot } from "../lib/offlineService";
import { db } from "../firebase";
import { Order, Category, Product } from "../types";
import { Bell, BellOff, Volume2, VolumeX, AlertTriangle, Clock, ChevronDown, ChevronUp, Eye, CheckCircle2, Mic } from "lucide-react";
import { formatCurrency } from "@/src/lib/utils";
import toast from "react-hot-toast";
import { useDraggable } from "../lib/useDraggable";
import { isDrinkItem } from "../lib/drinkUtils";

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
    const unsubscribeCat = onOfflineSnapshot("categories", collection(db, "categories"), (cats) => {
      setCategories(cats as Category[]);
    });
    const unsubscribeProd = onOfflineSnapshot("products", collection(db, "products"), (prods) => {
      setProducts(prods as Product[]);
    });
    return () => {
      unsubscribeCat();
      unsubscribeProd();
    };
  }, []);

  // Subscribe to unattended/unfinished orders
  useEffect(() => {
    const unsubscribe = onOfflineSnapshot("orders", collection(db, "orders"), async (ordersList) => {
      const orders = (ordersList as Order[])
        .filter(o => o.status === 'pending' || o.status === 'preparing')
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

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

        const activeItems = newest.items.filter(item => item.status !== 'cancelled');
        const drinksToDeliver = activeItems.filter(item => isDrinkItem(item, products, categories));
        const dishesToPrepare = activeItems.filter(item => !isDrinkItem(item, products, categories));

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

  // Popup UI disabled by request
  return null;
}
