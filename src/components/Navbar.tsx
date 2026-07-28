import { useState, useEffect, useRef } from "react";
import { Utensils, ClipboardList, Package, CreditCard, Settings, LogOut, Menu, ChefHat, MessageSquare, Bell, Maximize2, Minimize2, Radio, Globe } from "lucide-react";
import { Button } from "./Button";
import { cn, getRoleLabel } from "@/src/lib/utils";
import { auth, db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Order } from "../types";
import { useBranding } from "../lib/useBranding";
import { PWAInstallBanner } from "./PWAInstallBanner";
import { WeatherClockWidget } from "./WeatherClockWidget";
import { FullScreenLockControl } from "./FullScreenLockControl";
import { ChromeIcon } from "./DesktopBrowserWidget";
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
  isBrowserOpen?: boolean;
  setIsBrowserOpen?: (open: boolean) => void;
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
  isBrowserOpen = false,
  setIsBrowserOpen
}: NavbarProps) => {
  const [pendingStations, setPendingStations] = useState<{plancha: boolean, cocina: boolean}>({ plancha: false, cocina: false });
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
  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "in", ["pending", "preparing", "ready", "served"])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => doc.data() as Order);
      
      let hasPlancha = false;
      let hasCocina = false;
      let unpaidCount = 0;

      orders.forEach(order => {
        // Ignore unconfirmed WhatsApp orders so they don't light up the kitchen badges before being accepted
        if (order.isTakeaway && order.whatsAppConfirmed === false) {
          return;
        }

        // Increment count of active unpaid orders (excluding those marked as paid/cancelled)
        const isPaid = order.isPaid || order.status === 'paid';
        if (!isPaid) {
          unpaidCount++;
        }

        // Only show kitchen alerts for pending or preparing orders
        if (order.status === 'pending' || order.status === 'preparing') {
          const activeItems = order.items.filter(item => item.status !== 'cancelled' && item.status !== 'completed');
          const activePlanchaSpecific = activeItems.some(i => i.station === 'plancha');
          const activeCocinaSpecific = activeItems.some(i => i.station === 'cocina' || !i.station);

          activeItems.forEach(item => {
            if (item.station === 'plancha') {
              hasPlancha = true;
            } else if (item.station === 'cocina' || !item.station) {
              hasCocina = true;
            } else if (item.station === 'comun') {
              if (activePlanchaSpecific && !activeCocinaSpecific) {
                hasPlancha = true;
              } else {
                hasCocina = true;
              }
            }
          });
        }
      });

      setPendingStations({ plancha: hasPlancha, cocina: hasCocina });
      setUnpaidPaymentsCount(unpaidCount);
    });

    return () => unsubscribe();
  }, []);

  // Monitor WhatsApp Chats
  useEffect(() => {
    // We need to mirror the logic from WhatsAppInternoView to only count "Active" chats
    const unsubChats = onSnapshot(collection(db, "chats"), (chatSnapshot) => {
      const unsubOrders = onSnapshot(collection(db, "orders"), (orderSnapshot) => {
        const activeOrdersMap = new Map();
        orderSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.isTakeaway) {
            activeOrdersMap.set(doc.id, data);
          }
        });

        let count = 0;
        chatSnapshot.forEach(doc => {
          const data = doc.data();
          if (!data.unreadCount || data.unreadCount <= 0) return;

          // Check if this chat would be filtered out
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
        
        // Play sound if count increased
        if (count > prevUnreadRef.current) {
          audioRef.current?.play().catch(e => console.log("Audio play blocked by browser", e));
        }
        prevUnreadRef.current = count;
      }, (err) => {
        console.warn("Error listening to orders:", err);
      });

      return () => unsubOrders();
    }, (err) => {
      console.warn("Error listening to chats:", err);
    });

    return () => unsubChats();
  }, []);

  const [imageError, setImageError] = useState(false);
  const logoUrl = branding.logoUrl;
  const navItems = [
    { id: 'orders', label: 'Pedidos', icon: Utensils, roles: ['admin', 'waiter', 'cashier', 'kitchen', 'parrilla'] },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, roles: ['admin', 'cashier', 'waiter'] },
    { id: 'kitchen', label: userRole === 'parrilla' ? 'Parrilla' : 'Cocina', icon: ClipboardList, roles: ['admin', 'kitchen', 'parrilla'] },
    { id: 'inventory', label: 'Comidas', icon: ChefHat, roles: ['admin'] },
    { id: 'cash', label: 'Caja', icon: CreditCard, roles: ['admin', 'cashier', 'waiter'] },
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
                  item.id === 'whatsapp' && totalUnreadChats > 0 && "animate-bounce text-emerald-600"
                )} />
                
                {/* Kitchen Badges */}
                {item.id === 'kitchen' && (pendingStations.cocina || pendingStations.plancha) && (
                  <div className="absolute -top-1 -right-1 flex gap-0.5">
                    {pendingStations.cocina && (
                      <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full border border-white animate-pulse" title="Pedido en Cocina" />
                    )}
                    {pendingStations.plancha && (
                      <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-orange-500 rounded-full border border-white animate-pulse" title="Pedido en Parrilla" />
                    )}
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
            onClick={() => setIsBrowserOpen && setIsBrowserOpen(!isBrowserOpen)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl shrink-0 transition-all",
              isBrowserOpen ? "text-amber-500 bg-amber-50" : "text-stone-600 hover:bg-stone-50"
            )}
            title="Navegador Web Chrome"
          >
            <ChromeIcon size={21} />
            <span className="text-[9px] font-extrabold whitespace-nowrap">Chrome</span>
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
        <div className="hidden lg:block mb-1">
          <WeatherClockWidget />
        </div>
        <div className="lg:hidden flex justify-center mb-1">
          <WeatherClockWidget compact />
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
          variant={isWalkieOpen ? "default" : "outline"}
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

        {/* Navegador Web Chrome PC Button for Desktop */}
        <Button 
          variant={isBrowserOpen ? "default" : "outline"}
          className={cn(
            "justify-center lg:justify-start gap-3 w-full px-0 lg:px-4 h-[40px] rounded-xl text-xs font-bold transition-all",
            isBrowserOpen 
              ? "bg-amber-500 hover:bg-amber-600 text-stone-950 border-amber-500" 
              : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
          )}
          title="Navegador Web Chrome Flotante PC"
          onClick={() => setIsBrowserOpen && setIsBrowserOpen(!isBrowserOpen)}
        >
          <ChromeIcon size={18} />
          <span className="hidden lg:inline">Navegador Chrome</span>
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
