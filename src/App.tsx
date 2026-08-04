import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OrderView } from './components/OrderView';
import { KitchenView } from './components/KitchenView';
import { CashierView } from './components/CashierView';
import { InventoryView } from './components/InventoryView';
import { AdminView } from './components/AdminView';
import WhatsAppInternoView from './components/WhatsAppInternoView';
import { CustomerPortal } from './components/CustomerPortal';
import { Login } from './components/Login';
import { PendingOrdersNotifier } from './components/PendingOrdersNotifier';
import { WalkieTalkie } from './components/WalkieTalkie';
import { ErrorBoundary } from './components/ErrorBoundary';
import { auth } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, query, limit } from 'firebase/firestore';
import { getDocFromServer } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { LogIn } from 'lucide-react';

import { seedDatabase } from './seed';
import { db } from './firebase';

import { Order, User as POSUser } from './types';
import { useBranding } from './lib/useBranding';
import { useDraggable } from './lib/useDraggable';

export default function App() {
  const dragExitPortal = useDraggable();
  const [activeTab, setActiveTab] = useState('orders');
  const [isWalkieOpen, setIsWalkieOpen] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [posUser, setPosUser] = useState<POSUser | null>(null);
  const [userRole, setUserRole] = useState<string>('waiter');
  const [loading, setLoading] = useState(true);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [isPortalView, setIsPortalView] = useState(false);
  const { branding } = useBranding();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSimulatedFullscreen, setIsSimulatedFullscreen] = useState(false);

  // Sync fullscreen change events & Lock status
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFull = !!(doc.fullscreenElement || 
                        doc.webkitFullscreenElement || 
                        doc.mozFullScreenElement || 
                        doc.msFullscreenElement);
      setIsFullscreen(isFull);
      if (!isFull && localStorage.getItem('pos_fullscreen_locked') !== 'true') {
        setIsSimulatedFullscreen(false);
      }
    };

    const handleLockSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.isLocked === 'boolean') {
        if (customEvent.detail.isLocked) {
          localStorage.removeItem('user_fullscreen_disabled');
          setIsSimulatedFullscreen(true);
        } else {
          localStorage.removeItem('pos_fullscreen_locked');
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    window.addEventListener("pos_lock_changed", handleLockSync);

    // Initial check for lock or simulated full screen
    if (localStorage.getItem('pos_fullscreen_locked') === 'true') {
      setIsSimulatedFullscreen(true);
    }

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      window.removeEventListener("pos_lock_changed", handleLockSync);
    };
  }, []);

  const toggleFullscreen = async () => {
    const isLocked = localStorage.getItem('pos_fullscreen_locked') === 'true';
    if (isLocked) {
      toast('🔒 Pantalla Bloqueada. Desactiva el bloqueo de pantalla completa primero.', {
        icon: '🔒',
        id: 'fs-locked-toast'
      });
      return;
    }

    const doc = document as any;
    const docElm = document.documentElement as any;
    const currentNativeFull = !!(doc.fullscreenElement ||
                                doc.webkitFullscreenElement ||
                                doc.mozFullScreenElement ||
                                doc.msFullscreenElement);

    const currentlyFull = currentNativeFull || isSimulatedFullscreen;

    if (currentlyFull) {
      // Turn OFF Fullscreen -> Go to Normal Window Mode (only via button)
      localStorage.setItem('user_fullscreen_disabled', 'true');
      setIsSimulatedFullscreen(false);
      setIsFullscreen(false);

      if (currentNativeFull) {
        try {
          const exit = doc.exitFullscreen || 
                       doc.webkitExitFullscreen || 
                       doc.mozCancelFullScreen || 
                       doc.msExitFullscreen;
          if (exit) await exit.call(doc);
        } catch (e) {
          console.warn("exitFullscreen error:", e);
        }
      }
      toast("Modo Ventana Normal", { icon: "🔲", id: "fs-toast" });
    } else {
      // Turn ON Fullscreen
      localStorage.removeItem('user_fullscreen_disabled');
      setIsSimulatedFullscreen(true);

      const req = docElm.requestFullscreen || 
                  docElm.webkitRequestFullscreen || 
                  docElm.mozRequestFullScreen || 
                  docElm.msRequestFullscreen;
      if (req) {
        try {
          await req.call(docElm);
          setIsFullscreen(true);
        } catch (e) {
          console.warn("Native fullscreen request denied, using simulated full screen:", e);
        }
      }
      toast.success("¡Pantalla Completa Activada! 📺", { id: "fs-toast" });
    }
  };

  const enterFullscreen = async () => {
    try {
      const doc = document as any;
      const docElm = document.documentElement as any;
      setIsSimulatedFullscreen(true);
      const req = docElm.requestFullscreen || 
                  docElm.webkitRequestFullscreen || 
                  docElm.mozRequestFullScreen || 
                  docElm.msRequestFullscreen;
      if (req) {
        try {
          await req.call(docElm);
          setIsFullscreen(true);
        } catch (e) {
          // Fallback to simulated full screen
        }
      }
    } catch (e) {
      setIsSimulatedFullscreen(true);
    }
  };

  const exitFullscreen = async () => {
    const isLocked = localStorage.getItem('pos_fullscreen_locked') === 'true';
    if (isLocked) {
      toast('🔒 Pantalla Bloqueada. Desactiva el bloqueo de pantalla completa primero.', {
        icon: '🔒',
        id: 'fs-locked-toast'
      });
      return;
    }

    localStorage.setItem('user_fullscreen_disabled', 'true');
    setIsSimulatedFullscreen(false);
    setIsFullscreen(false);

    try {
      const doc = document as any;
      const currentFullscreenElm = doc.fullscreenElement ||
                                  doc.webkitFullscreenElement ||
                                  doc.mozFullScreenElement ||
                                  doc.msFullscreenElement;
      if (currentFullscreenElm) {
        const exit = doc.exitFullscreen || 
                     doc.webkitExitFullscreen || 
                     doc.mozCancelFullScreen || 
                     doc.msExitFullscreen;
        if (exit) await exit.call(doc);
      }
    } catch (err) {
      console.warn("Fullscreen exit failed:", err);
    }
  };

  useEffect(() => {
    // 0. Handle automatic redirection to portal if URL params exist
    const params = new URLSearchParams(window.location.search);
    if (params.has('portal') || params.has('id') || params.has('pedido')) {
      setIsPortalView(true);
      enterFullscreen();
    }

    // Update Title and Favicon
    document.title = branding.appName;
    const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (favicon) {
      favicon.href = branding.logoUrl;
    }
  }, [branding]);

  useEffect(() => {
    // Test Firestore connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection successful");
      } catch (error: any) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.warn("Please check your Firebase configuration. The client is offline.");
        } else if (error?.message && (error.message.includes("Quota") || error.message.includes("resource-exhausted"))) {
          console.warn("Firestore quota exceeded. Operating in offline/cached mode.");
        } else {
          console.log("Firestore connection test completed.");
        }
      }
    };
    testConnection();

    // 1. Load POS user from local storage
    try {
      const savedUser = localStorage.getItem('posUser');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && parsedUser.name) {
          const nameLower = parsedUser.name.toLowerCase().trim();
          if (
            nameLower === 'abigail' || 
            nameLower === 'antonieta abigail' || 
            nameLower === 'abigail villagómez' || 
            nameLower === 'abigail villagomez' || 
            nameLower.includes('abigail')
          ) {
            parsedUser.name = 'Antonieta Abigail Villagómez';
            try { localStorage.setItem('posUser', JSON.stringify(parsedUser)); } catch (e) {}
          }
        }
        setPosUser(parsedUser);
        setUserRole(parsedUser.role);
        if (parsedUser.role === 'kitchen' || parsedUser.role === 'parrilla') {
          setActiveTab('kitchen');
        } else {
          setActiveTab('orders');
        }
      }
    } catch (e) {
      console.warn("Error reading saved user from storage", e);
      try { localStorage.removeItem('posUser'); } catch (err) {}
    }

    // 2. Handle Firebase Auth
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (!user) {
        setPosUser(null);
        localStorage.removeItem('posUser');
        setLoading(false);
        return;
      }

      // If we have a firebase user, ensure they have a document in 'users'
      try {
        if (user.isAnonymous) {
          setLoading(false);
          return;
        }

        const userRef = doc(db, 'users', user.uid);
        let userDoc;
        try {
          userDoc = await getDoc(userRef);
        } catch (dbErr: any) {
          if (dbErr?.message && (dbErr.message.includes("Quota") || dbErr.message.includes("resource-exhausted"))) {
            console.warn("Firestore quota exceeded during auth user get. Using local fallback.");
            setLoading(false);
            return;
          }
          throw dbErr;
        }
        
        if (!userDoc.exists()) {
          try {
            const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
            const isFirstUser = usersSnap.empty;
            
            const defaultRole = (user.email === 'lascazuelasbosques@gmail.com' || isFirstUser) ? 'admin' : 'waiter';
            
            await setDoc(userRef, {
              name: user.displayName || user.email?.split('@')[0] || (isFirstUser ? 'Admin Inicial' : 'Usuario'),
              email: user.email || '',
              role: defaultRole,
              active: true,
              pin: '0000'
            });
            if (!localStorage.getItem('posUser')) {
              setUserRole(defaultRole);
            }
          } catch (createErr: any) {
            console.warn("Could not create user doc due to quota/offline:", createErr);
          }
        }

        // Listen for role changes if this is the primary user
        try {
          unsubUserDoc = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
              const data = doc.data();
              if (!localStorage.getItem('posUser')) {
                setUserRole(data.role);
              }
            }
          }, (error: any) => {
            if (error?.message && (error.message.includes("Quota") || error.message.includes("resource-exhausted"))) {
              console.warn("Quota exceeded in user doc snapshot.");
            } else {
              console.error("Error in user doc snapshot:", error);
            }
          });
        } catch (snapErr) {
          console.warn("Snapshot subscription failed:", snapErr);
        }

        try {
          seedDatabase();
        } catch (e) {
          // ignore
        }
      } catch (error: any) {
        if (error?.message && (error.message.includes("Quota") || error.message.includes("resource-exhausted"))) {
          console.warn("Firestore quota exceeded in auth setup.");
        } else {
          console.error("Error in auth setup:", error);
        }
      } finally {
        setLoading(false);
      }
    });

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  // Auto fullscreen on first interaction for users unless explicitly disabled
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (localStorage.getItem('user_fullscreen_disabled') === 'true') {
        return;
      }
      const doc = document as any;
      const currentFullscreenElm = doc.fullscreenElement ||
                                  doc.webkitFullscreenElement ||
                                  doc.mozFullScreenElement ||
                                  doc.msFullscreenElement;
      if (!currentFullscreenElm) {
        enterFullscreen();
      }
    };

    if (localStorage.getItem('user_fullscreen_disabled') !== 'true') {
      enterFullscreen();
    }

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [posUser, userRole]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-mex-cream">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mex-brown"></div>
          <p className="text-mex-brown font-serif animate-pulse">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (isPortalView) {
    return (
      <>
        <div className="relative">
           <button 
             onClick={() => {
               if (dragExitPortal.hasMoved) return;
               setIsPortalView(false);
               exitFullscreen();
             }}
             className="fixed top-3 right-3 z-[100] bg-stone-950 hover:bg-stone-850 text-white font-black px-4 py-2.5 rounded-full text-[10px] flex items-center gap-2 shadow-xl border-none cursor-pointer uppercase tracking-widest transition-all active:scale-95 select-none"
             title="Salir de la Simulación"
             {...dragExitPortal.dragProps}
           >
             <span>🚪</span>
             <span>Salir</span>
           </button>
           <CustomerPortal />
        </div>
        <Toaster position="top-right" />
      </>
    );
  }

  if (!posUser) {
    return (
      <>
        <Login 
          onLogin={(u) => {
            const userToSave = { ...u };
            if (userToSave.name) {
              const nameLower = userToSave.name.toLowerCase().trim();
              if (
                nameLower === 'abigail' || 
                nameLower === 'antonieta abigail' || 
                nameLower === 'abigail villagómez' || 
                nameLower === 'abigail villagomez' || 
                nameLower.includes('abigail')
              ) {
                userToSave.name = 'Antonieta Abigail Villagómez';
              }
            }
            setPosUser(userToSave);
            setUserRole(userToSave.role);
            localStorage.setItem('posUser', JSON.stringify(userToSave));
            if (userToSave.role === 'kitchen' || userToSave.role === 'parrilla') {
              setActiveTab('kitchen');
            } else {
              setActiveTab('orders');
            }
            enterFullscreen();
          }} 
          onEnterPortal={() => {
            setIsPortalView(true);
            enterFullscreen();
          }}
        />
        <Toaster position="top-right" />
      </>
    );
  }

  const handleLogout = () => {
    auth.signOut();
    setPosUser(null);
    localStorage.removeItem('posUser');
    exitFullscreen();
  };

  const handleEditOrder = (order: Order) => {
    setOrderToEdit(order);
    setActiveTab('orders');
  };

  const renderView = () => {
    switch (activeTab) {
      case 'orders':
        return <OrderView orderToEdit={orderToEdit} clearOrderToEdit={() => setOrderToEdit(null)} userRole={userRole} />;
      case 'kitchen':
        return <KitchenView onEditOrder={handleEditOrder} userRole={userRole} onNavigateToOrders={() => setActiveTab('orders')} />;
      case 'whatsapp':
        return <WhatsAppInternoView userRole={userRole} />;
      case 'cash':
        return <CashierView onEditOrder={handleEditOrder} userRole={userRole} />;
      case 'inventory':
        return <InventoryView userRole={userRole} />;
      case 'admin':
        return <AdminView />;
      default:
        return <OrderView orderToEdit={orderToEdit} clearOrderToEdit={() => setOrderToEdit(null)} userRole={userRole} />;
    }
  };

  const isFull = isFullscreen || isSimulatedFullscreen;

  return (
    <div className={`flex items-center justify-center min-h-[100dvh] w-screen bg-stone-900 transition-all duration-300 ${
      isFull ? 'fixed inset-0 z-[999] p-0 bg-stone-950 overflow-hidden' : 'p-2 md:p-4 bg-stone-900 overflow-y-auto'
    }`}>
      <div className={`flex flex-col md:flex-row bg-mex-cream overflow-hidden relative transition-all duration-300 ${
        isFull 
          ? "w-screen h-[100dvh] !max-w-none rounded-none shadow-none" 
          : "w-full max-w-[1400px] h-[92vh] rounded-2xl shadow-2xl border border-stone-700/50"
      }`}>
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          userRole={userRole} 
          userName={posUser?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Usuario'} 
          onLogout={handleLogout}
          isFullscreen={isFull}
          toggleFullscreen={toggleFullscreen}
          isWalkieOpen={isWalkieOpen}
          setIsWalkieOpen={setIsWalkieOpen}
        />
      
      <main className="flex-1 overflow-hidden relative pb-16 md:pb-0 h-full w-full min-h-0">
        <div className="absolute inset-0 overflow-hidden">
          <ErrorBoundary>
            {renderView()}
          </ErrorBoundary>
        </div>
      </main>

      <PendingOrdersNotifier userRole={userRole} />

      <WalkieTalkie posUser={posUser} isOpen={isWalkieOpen} setIsOpen={setIsWalkieOpen} />

      <Toaster position="top-right" />
      </div>
    </div>
  );
}
