import { useState, useEffect, useRef } from "react";
import { Utensils, ClipboardList, Package, CreditCard, Settings, LogOut, Menu, ChefHat, MessageSquare, Bell, Maximize2, Minimize2, Radio, Music } from "lucide-react";
import { Button } from "./Button";
import { cn, getRoleLabel } from "@/src/lib/utils";
import { auth, db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Order } from "../types";
import { useBranding } from "../lib/useBranding";
import { PWAInstallBanner } from "./PWAInstallBanner";
import { WeatherClockWidget } from "./WeatherClockWidget";
import { DiscreteMiniPlayer } from "./DiscreteMiniPlayer";
import { FullScreenLockControl } from "./FullScreenLockControl";
import toast from "react-hot-toast";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: string;
  userName?: string;
  onLogout: () => void;
  isFullscreen?: boolean;
  toggleFullscreen?: () => void;
  isWalkieOpen: boolean;
  setIsWalkieOpen: (open: boolean) => void;
}

export const Navbar = ({ 
  activeTab, 
  setActiveTab, 
  userRole = 'waiter', 
  userName = 'Usuario', 
  onLogout,
  isFullscreen: propIsFullscreen,
  toggleFullscreen: propToggleFullscreen,
  isWalkieOpen,
  setIsWalkieOpen
}: NavbarProps) => {
  const [pendingStations, setPendingStations] = useState<{plancha: boolean, cocina: boolean}>({ plancha: false, cocina: false });
  const [pendingFoodCount, setPendingFoodCount] = useState(0);
  const [unpaidPaymentsCount, setUnpaidPaymentsCount] = useState(0);
  const [totalUnreadChats, setTotalUnreadChats] = useState(0);
  const prevUnreadRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [localIsFullscreen, setLocalIsFullscreen] = useState(false);
  
  const { branding } = useBranding();

  // Screen Fullscreen monitor
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFull = !!(doc.fullscreenElement || 
                        doc.webkitFullscreenElement || 
                        doc.mozFullScreenElement || 
                        doc.msFullscreenElement);
      setLocalIsFullscreen(isFull);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  const isFullscreen = propIsFullscreen !== undefined ? propIsFullscreen : localIsFullscreen;

  const toggleFullscreen = async () => {
    if (propToggleFullscreen) {
      propToggleFullscreen();
      return;
    }
    try {
      const doc = document as any;
      const docElm = document.documentElement as any;
      const currentFullscreenElm = doc.fullscreenElement ||
                                  doc.webkitFullscreenElement ||
                                  doc.mozFullScreenElement ||
                                  doc.msFullscreenElement;

      if (!currentFullscreenElm) {
        if (docElm.requestFullscreen) {
          await docElm.requestFullscreen();
        } else if (docElm.webkitRequestFullscreen) {
          await docElm.webkitRequestFullscreen();
        } else if (docElm.mozRequestFullScreen) {
          await docElm.mozRequestFullScreen();
        } else if (docElm.msRequestFullscreen) {
          await docElm.msRequestFullscreen();
        } else {
          toast.error("Tu navegador no soporta pantalla completa automática.");
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
      toast.error("Para activar Pantalla Completa, abre la aplicación en una nueva pestaña externa.");
    }
  };

  // Initialize notification sound
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2857/2857-preview.mp3");
  }, []);

  // Monitor Kitchen Orders and Unprocessed Payments
  const prevFoodCountRef = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      let hasPlancha = false;
      let hasCocina = false;
      let unpaidCount = 0;
      let foodCount = 0;

      orders.forEach(order => {
        // Ignore unconfirmed WhatsApp orders so they don't light up the kitchen badges before being accepted
        if (order.isTakeaway && order.whatsAppConfirmed === false) {
          return;
        }

        // Increment count of active unpaid orders (excluding those marked as paid/cancelled)
        const isPaid = order.isPaid || order.status === 'paid';
        if (!isPaid && order.status !== 'cancelled') {
          unpaidCount++;
        }

        // Only show kitchen & food alerts for orders that are not paid or cancelled
        if (order.status !== 'cancelled' && order.status !== 'paid') {
          const items = order.items || [];
          const activeItems = items.filter(item => item.status !== 'cancelled' && item.status !== 'completed');
          const isPendingOrder = order.status === 'pending' || order.status === 'preparing' || !order.status;

          if (isPendingOrder || activeItems.length > 0) {
            let activeQty = 0;
            if (activeItems.length > 0) {
              activeQty = activeItems.reduce((sum, i) => sum + (i.quantity || 1), 0);
            } else if (isPendingOrder) {
              activeQty = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
            }
            foodCount += (activeQty > 0 ? activeQty : 1);

            const activePlanchaSpecific = activeItems.some(i => i.station === 'plancha');
            const activeCocinaSpecific = activeItems.some(i => i.station === 'cocina' || !i.station);

            activeItems.forEach(item => {
              if (item.station === 'plancha') {
                hasPlancha = true;
              } else if (item.station === 'cocina' || !item.station) {
                hasCocina = true;
              } else if (item.station === 'comun') {
                hasCocina = true;
                hasPlancha = true;
              }
            });

            if (activeItems.length === 0 && isPendingOrder) {
              hasCocina = true;
            }
          }
        }
      });

      if (foodCount > prevFoodCountRef.current && prevFoodCountRef.current > 0) {
        try {
          const alertSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2857/2857-preview.mp3");
          alertSound.volume = 0.7;
          alertSound.play().catch(() => {});
        } catch (e) {}
      }
      prevFoodCountRef.current = foodCount;

      setPendingStations({ plancha: hasPlancha, cocina: hasCocina });
      setPendingFoodCount(foodCount);
      setUnpaidPaymentsCount(unpaidCount);
    }, (error) => {
      console.error("Error subscribing to orders in Navbar:", error);
    });

    return () => unsubscribe();
  }, []);

  // Monitor WhatsApp Chats & Orders efficiently without nesting
  useEffect(() => {
    let chatDocs: any[] = [];
    let activeOrdersMap = new Map();

    const recalculateUnread = () => {
      let count = 0;
      chatDocs.forEach(data => {
        if (!data.unreadCount || data.unreadCount <= 0) return;
        let isVisible = true;
        if (data.activeOrderId) {
          const orderDoc = activeOrdersMap.get(data.activeOrderId);
          if (orderDoc) {
            const isCancelled = orderDoc.status === 'cancelled';
            const isCompleted = (orderDoc.isDelivered || orderDoc.status === 'served') && 
                               (orderDoc.isPaid || orderDoc.status === 'paid');
            if (isCancelled || isCompleted) {
              isVisible = false; 
            }
          }
        }
        if (isVisible) {
          count += data.unreadCount;
        }
      });

      setTotalUnreadChats(count);
      if (count > prevUnreadRef.current) {
        audioRef.current?.play().catch(e => console.log("Audio play blocked by browser", e));
      }
      prevUnreadRef.current = count;
    };

    const unsubOrders = onSnapshot(collection(db, "orders"), (orderSnapshot) => {
      activeOrdersMap.clear();
      orderSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.isTakeaway) {
          activeOrdersMap.set(doc.id, data);
        }
      });
      recalculateUnread();
    }, (err) => {
      console.warn("Orders snapshot error:", err);
    });

    const unsubChats = onSnapshot(collection(db, "chats"), (chatSnapshot) => {
      chatDocs = [];
      chatSnapshot.forEach(doc => {
        chatDocs.push(doc.data());
      });
      recalculateUnread();
    }, (err) => {
      console.warn("Chats snapshot error:", err);
    });

    return () => {
      unsubChats();
      unsubOrders();
    };
  }, []);

  const [imageError, setImageError] = useState(false);
  const [isPC, setIsPC] = useState(false);
  const logoUrl = branding.logoUrl;

  useEffect(() => {
    const checkDevice = () => {
      const isWideScreen = window.innerWidth >= 1024;
      const userAgentMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
      setIsPC(isWideScreen && !userAgentMobile);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const navItems = [
    { id: 'orders', label: 'Pedidos', icon: Utensils, roles: ['admin', 'waiter', 'cashier', 'kitchen', 'parrilla'] },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, roles: ['admin', 'cashier', 'waiter'] },
    { id: 'kitchen', label: userRole === 'parrilla' ? 'Parrilla' : 'Cocina', icon: ClipboardList, roles: ['admin', 'kitchen', 'parrilla'] },
    { id: 'inventory', label: 'Comidas', icon: ChefHat, roles: ['admin', 'kitchen', 'parrilla', 'cashier', 'waiter'] },
    { id: 'cash', label: 'Caja', icon: CreditCard, roles: ['admin', 'cashier', 'waiter'] },
    ...(isPC ? [{ id: 'music', label: 'Música', icon: Music, roles: ['admin', 'waiter', 'cashier', 'kitchen', 'parrilla'] }] : []),
    { id: 'admin', label: 'Admin', icon: Settings, roles: ['admin'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-2 py-1 flex justify-around items-center md:relative md:flex-col md:h-screen md:w-20 lg:w-64 md:border-t-0 md:border-r md:justify-start md:gap-4 md:px-2 lg:px-4 md:py-8 z-50 transition-all duration-300">
      <div className="hidden md:flex flex-col items-center mb-8 px-2 lg:px-4">
        <div className="w-12 h-12 lg:w-24 lg:h-24 mb-4 rounded-full overflow-hidden border-2 lg:border-4 border-mex-gold shadow-xl transition-all duration-300 bg-white flex items-center justify-center">
          {imageError ? (
            <ChefHat className="text-mex-brown h-6 w-6 lg:h-12 lg:w-12" />
          ) : (
            <img 
              src={logoUrl} 
              alt={branding.appName} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />
          )}
        </div>
        <h1 className="hidden lg:block text-xl font-serif text-mex-brown text-center leading-tight">
          {branding.appName}
        </h1>
      </div>

      {/* Unified flex scroll track for mobile, default grid/col for desktop */}
      <div className="flex items-center gap-1 w-full overflow-x-auto no-scrollbar py-1 md:py-0 md:overflow-visible md:flex-col justify-between md:justify-start">
        
        {/* Navigation Tabs */}
        <div className="flex md:flex-col gap-1 items-center md:items-stretch shrink-0 md:shrink md:w-full">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all md:w-full md:px-3 lg:px-4 md:py-3 lg:flex-row lg:gap-3 relative shrink-0",
                activeTab === item.id 
                  ? "text-mex-green bg-mex-green/10 font-bold px-3 py-1.5 md:shadow-inner" 
                  : "text-stone-500 hover:bg-stone-100",
                item.id === 'whatsapp' && totalUnreadChats > 0 && "lg:animate-pulse"
              )}
            >
              <div className="relative shrink-0 flex items-center justify-center">
                <item.icon size={21} className={cn(
                  "transition-transform duration-250 md:h-[22px] md:w-[22px]", 
                  activeTab === item.id && "scale-105",
                  item.id === 'whatsapp' && totalUnreadChats > 0 && "animate-bounce text-emerald-600",
                  item.id === 'kitchen' && (pendingStations.cocina || pendingStations.plancha || pendingFoodCount > 0) && "animate-pulse text-orange-600 font-bold",
                  item.id === 'inventory' && (pendingFoodCount > 0 || pendingStations.cocina || pendingStations.plancha) && "animate-pulse text-amber-600 font-bold"
                )} />
                
                {/* Kitchen Badges */}
                {item.id === 'kitchen' && (pendingStations.cocina || pendingStations.plancha || pendingFoodCount > 0) && (
                  <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5">
                    {pendingFoodCount > 0 && (
                      <span className="bg-orange-600 text-white text-[8px] md:text-[9px] font-black min-w-[14px] h-3.5 md:h-4 px-1 rounded-full flex items-center justify-center border border-white shadow-sm scale-110 animate-pulse" title="Comidas/Productos pendientes en Cocina">
                        {pendingFoodCount > 9 ? '+9' : pendingFoodCount}
                      </span>
                    )}
                    {pendingStations.cocina && (
                      <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full border border-white animate-pulse" title="Pedido en Cocina" />
                    )}
                    {pendingStations.plancha && (
                      <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-orange-500 rounded-full border border-white animate-pulse" title="Pedido en Parrilla" />
                    )}
                  </div>
                )}

                {/* Comidas / Inventory Badge */}
                {item.id === 'inventory' && (pendingFoodCount > 0 || pendingStations.cocina || pendingStations.plancha) && (
                  <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[8px] md:text-[9px] font-black min-w-[14px] h-3.5 md:h-4 px-1 rounded-full flex items-center justify-center border border-white shadow-sm scale-110 animate-pulse" title="Comidas para preparar en cocina/parrilla">
                    {pendingFoodCount > 0 ? (pendingFoodCount > 9 ? '+9' : pendingFoodCount) : '!'}
                  </div>
                )}

                {/* WhatsApp Badge */}
                {item.id === 'whatsapp' && totalUnreadChats > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[8px] md:text-[9px] font-black w-3.5 h-3.5 md:w-4 md:h-4 rounded-full flex items-center justify-center border border-white shadow-sm scale-110">
                    {totalUnreadChats > 9 ? '+9' : totalUnreadChats}
                  </div>
                )}

                {/* Cash Badge (Unprocessed Payments) */}
                {item.id === 'cash' && unpaidPaymentsCount > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] md:text-[9px] font-black w-3.5 h-3.5 md:w-4 md:h-4 rounded-full flex items-center justify-center border border-white shadow-sm scale-110 animate-pulse" title="Pagos sin procesar">
                    {unpaidPaymentsCount}
                  </div>
                )}
              </div>
              <span className={cn(
                "text-[9px] font-extrabold whitespace-nowrap lg:text-xs tracking-tight transition-all duration-300",
                activeTab === item.id ? "block" : "hidden md:block"
              )}>
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {/* Dynamic scroll indicators / Actions on mobile */}
        <div className="flex md:hidden items-center gap-1 pl-2 border-l border-stone-200 shrink-0">
          <WeatherClockWidget compact />
          <PWAInstallBanner compact />
          <FullScreenLockControl compact />

          <button
            onClick={() => setIsWalkieOpen(!isWalkieOpen)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl shrink-0 transition-all",
              isWalkieOpen ? "text-orange-500 bg-orange-50" : "text-stone-600 hover:bg-stone-50"
            )}
            title="Walkie-Talkie Interno"
          >
            <Radio size={21} className={isWalkieOpen ? "animate-pulse text-orange-600" : "text-orange-500"} />
            <span className="text-[9px] font-extrabold whitespace-nowrap">Walkie</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="flex flex-col items-center gap-1 p-2 rounded-xl text-stone-600 hover:bg-stone-50 shrink-0"
            title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
          >
            {isFullscreen ? <Minimize2 size={21} className="text-mex-gold" /> : <Maximize2 size={21} className="text-mex-green" />}
            <span className="text-[9px] font-extrabold whitespace-nowrap">Pantalla</span>
          </button>

          <button
            onClick={() => onLogout()}
            className="flex flex-col items-center gap-1 p-2 rounded-xl text-red-500 hover:bg-red-50 shrink-0"
          >
            <LogOut size={21} />
            <span className="text-[9px] font-extrabold whitespace-nowrap">Salir</span>
          </button>
        </div>

      </div>

      <div className="hidden md:mt-auto md:flex flex-col w-full gap-2 px-2 lg:px-4">
        {/* Weather & Clock Widget for Desktop */}
        <div className="hidden lg:flex flex-col gap-2 mb-1">
          <WeatherClockWidget />
          <DiscreteMiniPlayer onNavigateToMusic={() => setActiveTab('music')} />
        </div>
        <div className="lg:hidden flex flex-col items-center gap-1 mb-1">
          <WeatherClockWidget compact />
          <DiscreteMiniPlayer compact onNavigateToMusic={() => setActiveTab('music')} />
        </div>

        <div className="p-2 lg:p-3 bg-stone-50 rounded-lg border border-stone-100 mb-2 flex items-center justify-center lg:justify-start">
          <div className="hidden lg:block w-full">
            <p className="text-xs text-stone-500">{getRoleLabel(userRole)}</p>
            <p className="text-sm font-medium truncate">{userName}</p>
          </div>
          <div className="lg:hidden w-8 h-8 rounded-full overflow-hidden border border-stone-200" title={`${userName} (${getRoleLabel(userRole)})`}>
            <img src={logoUrl} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
        </div>

        {/* Walkie-Talkie Button for Desktop */}
        <Button 
          variant={isWalkieOpen ? "primary" : "outline"}
          className={cn(
            "justify-center lg:justify-start gap-3 w-full px-0 lg:px-4 h-[40px] rounded-xl text-xs font-bold transition-all",
            isWalkieOpen 
              ? "bg-orange-500 hover:bg-orange-600 text-stone-950 border-orange-500" 
              : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
          )}
          title="Walkie-Talkie Interno"
          onClick={() => setIsWalkieOpen(!isWalkieOpen)}
        >
          <Radio size={18} className={cn(isWalkieOpen ? "animate-pulse" : "text-orange-500")} />
          <span className="hidden lg:inline">Walkie-Talkie</span>
        </Button>

        {/* Fullscreen Button for Desktop */}
        <Button 
          variant="outline" 
          className="justify-center lg:justify-start gap-3 w-full border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900 px-0 lg:px-4 h-[40px] rounded-xl text-xs font-bold"
          title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize2 size={18} className="text-mex-gold" /> : <Maximize2 size={18} className="text-mex-green" />}
          <span className="hidden lg:inline">{isFullscreen ? "Ventana Normal" : "Pantalla Completa"}</span>
        </Button>

        {/* Lock Screen Button */}
        <FullScreenLockControl />

        <Button 
          variant="ghost" 
          className="justify-center lg:justify-start gap-3 w-full text-stone-500 px-0 lg:px-4"
          title="Cerrar Sesión"
          onClick={() => onLogout()}
        >
          <LogOut size={20} />
          <span className="hidden lg:inline">Cerrar Sesión</span>
        </Button>
      </div>
    </nav>
  );
};
