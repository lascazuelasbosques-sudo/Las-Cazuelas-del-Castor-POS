import { useState, useEffect, useRef } from "react";
import { Utensils, ClipboardList, Package, CreditCard, Settings, LogOut, Menu, ChefHat, MessageSquare, Bell, Maximize2, Minimize2, Radio, Youtube } from "lucide-react";
import { Button } from "./Button";
import { cn, getRoleLabel } from "@/src/lib/utils";
import { auth, db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Order } from "../types";
import { useBranding } from "../lib/useBranding";
import { PWAInstallBanner } from "./PWAInstallBanner";
import { WeatherClockWidget } from "./WeatherClockWidget";
import { FullScreenLockControl } from "./FullScreenLockControl";
import toast from "react-hot-toast";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { 
  getOfflineStatus, 
  getPendingOperationsCount, 
  subscribeToOfflineState, 
  toggleSimulateOffline, 
  syncOfflineData 
} from "../lib/offlineService";

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
  isYouTubeOpen: boolean;
  onToggleYouTube: () => void;
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
  setIsWalkieOpen,
  isYouTubeOpen,
  onToggleYouTube
}: NavbarProps) => {
  const [pendingStations, setPendingStations] = useState<{plancha: boolean, cocina: boolean}>({ plancha: false, cocina: false });
  const [pendingFoodCount, setPendingFoodCount] = useState(0);
  const [unpaidPaymentsCount, setUnpaidPaymentsCount] = useState(0);
  const [totalUnreadChats, setTotalUnreadChats] = useState(0);
  const prevUnreadRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [localIsFullscreen, setLocalIsFullscreen] = useState(false);
  const [isOffline, setIsOffline] = useState(getOfflineStatus());
  const [pendingOps, setPendingOps] = useState(getPendingOperationsCount());
  
  const { branding } = useBranding();

  useEffect(() => {
    const unsubscribe = subscribeToOfflineState((offline, pendingCount) => {
      setIsOffline(offline);
      setPendingOps(pendingCount);
    });
    return unsubscribe;
  }, []);

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
    
    const isLocked = localStorage.getItem('pos_fullscreen_locked') === 'true';
    if (isLocked) {
      toast('🔒 Pantalla Bloqueada. Desactiva el bloqueo de pantalla completa primero.', {
        icon: '🔒',
        id: 'fs-locked-toast'
      });
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
    { id: 'admin', label: 'Admin', icon: Settings, roles: ['admin'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-2 py-1 flex justify-around items-center md:relative md:flex-col md:h-full md:w-20 lg:w-64 md:border-t-0 md:border-r md:justify-between md:px-2 lg:px-4 md:py-4 z-50 transition-all duration-300 md:overflow-y-auto custom-scrollbar select-none">
      {/* Desktop Logo Header */}
      <div className="hidden md:flex flex-col items-center mb-4 px-1 lg:px-2 shrink-0">
        <div className="w-10 h-10 lg:w-20 lg:h-20 mb-2 rounded-full overflow-hidden border-2 lg:border-3 border-mex-gold shadow-md transition-all duration-300 bg-white flex items-center justify-center shrink-0">
          {imageError ? (
            <ChefHat className="text-mex-brown h-5 w-5 lg:h-10 lg:w-10" />
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
        <h1 className="hidden lg:block text-base font-serif font-bold text-mex-brown text-center leading-tight truncate max-w-[200px]">
          {branding.appName}
        </h1>
      </div>

      {/* Unified flex scroll track for mobile, vertical auto-fitting track for desktop */}
      <div className="flex items-center gap-1 w-full overflow-x-auto no-scrollbar py-1 md:py-0 md:overflow-visible md:flex-col justify-between md:justify-start md:flex-1">
        
        {/* Navigation Tabs */}
        <div className="flex md:flex-col gap-1 items-center md:items-stretch shrink-0 md:shrink md:w-full">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={cn(
                "flex flex-col items-center gap-1 p-1.5 md:p-2 rounded-xl transition-all md:w-full md:px-2.5 lg:px-3.5 md:py-2.5 lg:flex-row lg:gap-3 relative shrink-0",
                activeTab === item.id 
                  ? "text-mex-green bg-mex-green/10 font-bold px-3 py-1.5 md:shadow-inner" 
                  : "text-stone-500 hover:bg-stone-100",
                item.id === 'whatsapp' && totalUnreadChats > 0 && "lg:animate-pulse"
              )}
            >
              <div className="relative shrink-0 flex items-center justify-center">
                <item.icon size={20} className={cn(
                  "transition-transform duration-200 md:h-[20px] md:w-[20px]", 
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
                "text-[9px] font-extrabold whitespace-nowrap lg:text-xs tracking-tight transition-all duration-200",
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

          {/* Compact Offline Switcher for Mobile */}
          <button
            onClick={() => {
              if (pendingOps > 0 && !isOffline) {
                syncOfflineData();
              } else {
                toggleSimulateOffline(!isOffline);
              }
            }}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl shrink-0 transition-all relative",
              isOffline ? "text-amber-600 bg-amber-50" : "text-stone-600 hover:bg-stone-50"
            )}
            title={isOffline ? "Base de datos local activa. Presiona para volver a conectar." : "Trabajar en modo local"}
          >
            {isOffline ? (
              <WifiOff size={21} className="text-amber-500 animate-pulse" />
            ) : (
              <Wifi size={21} className="text-stone-400" />
            )}
            {pendingOps > 0 && (
              <span className="absolute top-1 right-1 bg-amber-500 text-stone-950 text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white animate-bounce">
                {pendingOps}
              </span>
            )}
            <span className="text-[9px] font-extrabold whitespace-nowrap">
              {isOffline ? `Offline (${pendingOps})` : "En Línea"}
            </span>
          </button>

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

          {isPC && (
            <button
              onClick={onToggleYouTube}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl shrink-0 transition-all",
                isYouTubeOpen ? "text-red-600 bg-red-50" : "text-stone-600 hover:bg-stone-50"
              )}
              title="Abrir YouTube (Siempre Visible)"
            >
              <Youtube size={21} className={cn(isYouTubeOpen ? "animate-pulse" : "text-red-500")} />
              <span className="text-[9px] font-extrabold whitespace-nowrap">YouTube</span>
            </button>
          )}

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

      {/* Desktop Controls Panel (Vertical stack, scrollable if window height is low) */}
      <div className="hidden md:flex flex-col w-full gap-1.5 px-1 lg:px-2 pt-3 border-t border-stone-100 shrink-0">
        {/* Weather & Clock Widget for Desktop */}
        <div className="hidden lg:flex flex-col gap-1.5 mb-1">
          <WeatherClockWidget />
        </div>
        <div className="lg:hidden flex flex-col items-center gap-1 mb-1">
          <WeatherClockWidget compact />
        </div>

        {/* User Profile Card */}
        <div className="p-1.5 lg:p-2 bg-stone-50 rounded-xl border border-stone-200/80 mb-1 flex items-center justify-between gap-1.5 w-full">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-stone-200 shrink-0" title={`${userName} (${getRoleLabel(userRole)})`}>
              <img src={logoUrl} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
            <div className="hidden lg:block min-w-0">
              <p className="text-[10px] text-stone-400 font-semibold leading-none mb-0.5">{getRoleLabel(userRole)}</p>
              <p className="text-xs font-bold text-stone-700 truncate max-w-[110px]">{userName}</p>
            </div>
          </div>
          <button
            onClick={() => onLogout()}
            className="p-1 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        </div>

        {/* Walkie-Talkie Button */}
        <Button 
          variant={isWalkieOpen ? "primary" : "outline"}
          className={cn(
            "justify-center lg:justify-start gap-2.5 w-full px-0 lg:px-3 h-[36px] rounded-xl text-xs font-bold transition-all",
            isWalkieOpen 
              ? "bg-orange-500 hover:bg-orange-600 text-stone-950 border-orange-500" 
              : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
          )}
          title="Walkie-Talkie Interno"
          onClick={() => setIsWalkieOpen(!isWalkieOpen)}
        >
          <Radio size={16} className={cn(isWalkieOpen ? "animate-pulse" : "text-orange-500")} />
          <span className="hidden lg:inline">Walkie-Talkie</span>
        </Button>

        {/* YouTube Button (PC Only) */}
        {isPC && (
          <Button 
            variant={isYouTubeOpen ? "primary" : "outline"}
            className={cn(
              "justify-center lg:justify-start gap-2.5 w-full px-0 lg:px-3 h-[36px] rounded-xl text-xs font-bold transition-all",
              isYouTubeOpen 
                ? "bg-red-600 hover:bg-red-700 text-white border-red-600" 
                : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-red-600"
            )}
            title="Abrir YouTube (Siempre Visible)"
            onClick={onToggleYouTube}
          >
            <Youtube size={16} className={cn(isYouTubeOpen ? "animate-pulse" : "text-red-500")} />
            <span className="hidden lg:inline">YouTube Popup</span>
          </Button>
        )}

        {/* Fullscreen Button */}
        <Button 
          variant="outline" 
          className="justify-center lg:justify-start gap-2.5 w-full border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900 px-0 lg:px-3 h-[36px] rounded-xl text-xs font-bold"
          title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize2 size={16} className="text-mex-gold" /> : <Maximize2 size={16} className="text-mex-green" />}
          <span className="hidden lg:inline">{isFullscreen ? "Ventana Normal" : "Pantalla Completa"}</span>
        </Button>

        {/* Offline Sync Controls */}
        <div className="p-2 bg-stone-50 border border-stone-200/60 rounded-xl text-left w-full hidden md:block">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Base de Datos</span>
            <div className="flex items-center gap-1">
              <span className={cn(
                "w-2 h-2 rounded-full",
                isOffline ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
              )} />
              <span className="text-[9px] font-black uppercase text-stone-700">
                {isOffline ? "Local" : "Nube"}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSimulateOffline(!isOffline)}
              className={cn(
                "flex-1 justify-center gap-1 px-1 h-[26px] rounded-lg text-[9px] font-black uppercase tracking-wider border-stone-200",
                isOffline ? "bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-200" : "bg-white hover:bg-stone-50 text-stone-600"
              )}
              title={isOffline ? "Volver a Conectar con la Nube" : "Desconectar y Trabajar con BD Temporal"}
            >
              {isOffline ? <Wifi size={11} /> : <WifiOff size={11} />}
              <span>{isOffline ? "Conectar" : "Desconectar"}</span>
            </Button>
            
            {pendingOps > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => syncOfflineData()}
                className="flex-1 justify-center gap-1 px-1 h-[26px] rounded-lg text-[9px] font-black uppercase tracking-wider bg-mex-green hover:bg-mex-green/90 text-white animate-bounce"
                title="Sincronizar Cambios locales con la nube"
              >
                <RefreshCw size={11} className="animate-spin" />
                <span>Subir ({pendingOps})</span>
              </Button>
            )}
          </div>
          {pendingOps > 0 && (
            <p className="text-[8px] font-bold text-amber-700 mt-1 text-center leading-tight animate-pulse">
              {pendingOps} cambios locales sin subir.
            </p>
          )}
        </div>

        {/* Lock Screen Button */}
        <FullScreenLockControl />

        <Button 
          variant="ghost" 
          className="justify-center lg:justify-start gap-2.5 w-full text-stone-500 hover:text-red-600 hover:bg-red-50 px-0 lg:px-3 h-[36px] text-xs font-semibold"
          title="Cerrar Sesión"
          onClick={() => onLogout()}
        >
          <LogOut size={16} />
          <span className="hidden lg:inline">Cerrar Sesión</span>
        </Button>
      </div>
    </nav>
  );
};
