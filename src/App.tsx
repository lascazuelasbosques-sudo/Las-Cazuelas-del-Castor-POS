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

  // Sync fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFull = !!(doc.fullscreenElement || 
                        doc.webkitFullscreenElement || 
                        doc.mozFullScreenElement || 
                        doc.msFullscreenElement);
      setIsFullscreen(isFull);
      if (!isFull) {
        setIsSimulatedFullscreen(false);
      }
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

  const toggleFullscreen = async () => {
    try {
      const doc = document as any;
      const docElm = document.documentElement as any;
      const currentFullscreenElm = doc.fullscreenElement ||
                                  doc.webkitFullscreenElement ||
                                  doc.mozFullScreenElement ||
                                  doc.msFullscreenElement;

      if (!currentFullscreenElm && !isSimulatedFullscreen) {
        // Try native
        try {
          if (docElm.requestFullscreen) {
            await docElm.requestFullscreen();
          } else if (docElm.webkitRequestFullscreen) {
            await docElm.webkitRequestFullscreen();
          } else if (docElm.mozRequestFullScreen) {
            await docElm.mozRequestFullScreen();
          } else if (docElm.msRequestFullscreen) {
            await docElm.msRequestFullscreen();
          } else {
            throw new Error("No native support");
          }
        } catch (nativeErr) {
          console.warn("Native fullscreen failed, falling back to simulated:", nativeErr);
          setIsSimulatedFullscreen(true);
          toast.success("¡Modo Pantalla Completa Activado!", { id: "simulated-fs-toast" });
        }
      } else {
        // Exit native or simulated
        if (currentFullscreenElm) {
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
        setIsSimulatedFullscreen(false);
      }
    } catch (err) {
      console.warn("Fullscreen toggle error:", err);
      setIsSimulatedFullscreen(!isSimulatedFullscreen);
    }
  };

  const enterFullscreen = async () => {
    try {
      const doc = document as any;
      const docElm = document.documentElement as any;
      const currentFullscreenElm = doc.fullscreenElement ||
                                  doc.webkitFullscreenElement ||
                                  doc.mozFullScreenElement ||
                                  doc.msFullscreenElement;
      if (!currentFullscreenElm && !isSimulatedFullscreen) {
        try {
          if (docElm.requestFullscreen) {
            await docElm.requestFullscreen();
          } else if (docElm.webkitRequestFullscreen) {
            await docElm.webkitRequestFullscreen();
          } else {
            throw new Error("No native support");
          }
        } catch (nativeErr) {
          // Silent fallback to simulated for auto-fullscreen
          setIsSimulatedFullscreen(true);
        }
      }
    } catch (err) {
      console.warn("Auto-fullscreen failed:", err);
      setIsSimulatedFullscreen(true);
    }
  };

  const exitFullscreen = async () => {
    try {
      const doc = document as any;
      const currentFullscreenElm = doc.fullscreenElement ||
                                  doc.webkitFullscreenElement ||
                                  doc.mozFullScreenElement ||
                                  doc.msFullscreenElement;
      if (currentFullscreenElm) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      }
      setIsSimulatedFullscreen(false);
    } catch (err) {
      console.warn("Fullscreen exit failed:", err);
      setIsSimulatedFullscreen(false);
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
        await getDoc(doc(db, 'test', 'connection'));
        console.log("Conexión con Firestore verificada");
      } catch (error: any) {
        if (error?.message?.includes('offline') || error?.code === 'unavailable') {
          console.warn("Modo Sin Conexión: Firestore funcionando en caché local offline.");
        } else {
          console.log("Comprobación de Firestore completada.");
        }
      }
    };
    testConnection();

    // 1. Load POS user from local storage
    const savedUser = localStorage.getItem('posUser');
    if (savedUser) {
      try {
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
            localStorage.setItem('posUser', JSON.stringify(parsedUser));
          }
        }
        setPosUser(parsedUser);
        setUserRole(parsedUser.role);
        if (parsedUser.role === 'kitchen' || parsedUser.role === 'parrilla') {
          setActiveTab('kitchen');
        } else {
          setActiveTab('orders');
        }
      } catch (e) {
        console.error("Error parsing saved user", e);
        localStorage.removeItem('posUser');
      }
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
          // Do not create a Firestore document for anonymous users.
          // They are authenticated just to read their actual POS user document.
          setLoading(false);
          return;
        }

        const userRef = doc(db, 'users', user.uid);
        let userDocSnap;
        try {
          userDocSnap = await getDoc(userRef);
        } catch (fetchErr: any) {
          console.warn("Offline user doc fetch fallback:", fetchErr?.message || fetchErr);
        }

        if (userDocSnap && userDocSnap.exists()) {
          const data = userDocSnap.data();
          if (!localStorage.getItem('posUser')) {
            setUserRole(data.role || 'waiter');
          }
        } else if (!userDocSnap) {
          // Offline fallback when network fails
          const savedRole = localStorage.getItem('userRole') || 'waiter';
          if (!localStorage.getItem('posUser')) {
            setUserRole(savedRole);
          }
        } else {
          // Check if this is the first user to bootstrap admin
          let isFirstUser = false;
          try {
            const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
            isFirstUser = usersSnap.empty;
          } catch (snapErr) {
            console.warn("Offline check for first user skipped:", snapErr);
          }

          const defaultRole = (user.email === 'lascazuelasbosques@gmail.com' || isFirstUser) ? 'admin' : 'waiter';
          
          try {
            await setDoc(userRef, {
              name: user.displayName || user.email?.split('@')[0] || (isFirstUser ? 'Admin Inicial' : 'Usuario'),
              email: user.email || '',
              role: defaultRole,
              active: true,
              pin: '0000'
            });
          } catch (setErr) {
            console.warn("Offline setDoc userRef skipped:", setErr);
          }

          // Only set role if not already set by POS user
          if (!localStorage.getItem('posUser')) {
            setUserRole(defaultRole);
          }
        }

        // Listen for role changes if this is the primary user
        unsubUserDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Only sync role if we don't have a POS user or if the POS user matches this UID
            if (!localStorage.getItem('posUser')) {
              setUserRole(data.role);
            }
          }
        }, (error) => {
          console.warn("User doc snapshot notification (offline mode active):", error?.message || error);
        });

        // Try to seed
        try {
          seedDatabase();
        } catch (seedErr) {
          console.warn("Seed skipped in offline mode:", seedErr);
        }
      } catch (error) {
        console.warn("Auth setup handled with offline fallback:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  // Auto fullscreen on first interaction for admin
  useEffect(() => {
    const isAdmin = (posUser && posUser.role === 'admin') || userRole === 'admin';
    if (isAdmin) {
      const handleFirstInteraction = () => {
        const doc = document as any;
        const currentFullscreenElm = doc.fullscreenElement ||
                                    doc.webkitFullscreenElement ||
                                    doc.mozFullScreenElement ||
                                    doc.msFullscreenElement;
        if (!currentFullscreenElm) {
          enterFullscreen();
        }
      };
      window.addEventListener('click', handleFirstInteraction, { once: true });
      window.addEventListener('touchstart', handleFirstInteraction, { once: true });
      return () => {
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('touchstart', handleFirstInteraction);
      };
    }
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

  return (
    <div className={`flex items-center justify-center min-h-[100dvh] w-screen bg-stone-900 transition-colors duration-500`}>
      <div className={`flex flex-col md:flex-row h-[100dvh] w-full bg-mex-cream overflow-hidden shadow-2xl relative ${(isFullscreen || isSimulatedFullscreen) ? "simulated-fullscreen !max-w-none w-screen" : "max-w-[1400px]"}`}>
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          userRole={userRole} 
          userName={posUser?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Usuario'} 
          onLogout={handleLogout}
          isFullscreen={isFullscreen || isSimulatedFullscreen}
          toggleFullscreen={toggleFullscreen}
          isWalkieOpen={isWalkieOpen}
          setIsWalkieOpen={setIsWalkieOpen}
        />
      
      <main className="flex-1 overflow-hidden relative pb-16 md:pb-0">
        <div className="absolute inset-0 overflow-hidden">
          {renderView()}
        </div>
      </main>

      <PendingOrdersNotifier userRole={userRole} />

      <WalkieTalkie posUser={posUser} isOpen={isWalkieOpen} setIsOpen={setIsWalkieOpen} />

      <Toaster position="top-right" />
      </div>
    </div>
  );
}
