import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OrderView } from './components/OrderView';
import { KitchenView } from './components/KitchenView';
import { CashierView } from './components/CashierView';
import { InventoryView } from './components/InventoryView';
import { AdminView } from './components/AdminView';
import { Login } from './components/Login';
import { auth } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, query, limit } from 'firebase/firestore';
import { getDocFromServer } from 'firebase/firestore';
import { Toaster } from 'react-hot-toast';

import { seedDatabase } from './seed';
import { db } from './firebase';

import { Order, User as POSUser } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState('orders');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [posUser, setPosUser] = useState<POSUser | null>(null);
  const [userRole, setUserRole] = useState<string>('waiter');
  const [loading, setLoading] = useState(true);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);

  useEffect(() => {
    // Test Firestore connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection successful");
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        } else {
          console.log("Firestore connection test completed (expected missing doc error).");
        }
      }
    };
    testConnection();

    // 1. Load POS user from local storage
    const savedUser = localStorage.getItem('posUser');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setPosUser(parsedUser);
        setUserRole(parsedUser.role);
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
        setLoading(false);
        return;
      }

      // If we have a firebase user, ensure they have a document in 'users'
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          // Check if this is the first user to bootstrap admin
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
          // Only set role if not already set by POS user
          if (!localStorage.getItem('posUser')) {
            setUserRole(defaultRole);
          }
        }

        // Listen for role changes if this is the primary user
        unsubUserDoc = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            // Only sync role if we don't have a POS user or if the POS user matches this UID
            if (!localStorage.getItem('posUser')) {
              setUserRole(data.role);
            }
          }
        }, (error) => {
          console.error("Error in user doc snapshot:", error);
        });

        // Try to seed
        seedDatabase();
      } catch (error) {
        console.error("Error in auth setup:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

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

  if (!posUser) {
    return (
      <>
        <Login onLogin={(u) => {
          setPosUser(u);
          setUserRole(u.role);
          localStorage.setItem('posUser', JSON.stringify(u));
        }} />
        <Toaster position="top-right" />
      </>
    );
  }

  const handleLogout = () => {
    auth.signOut();
    setPosUser(null);
    localStorage.removeItem('posUser');
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
        return <KitchenView onEditOrder={handleEditOrder} />;
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
    <div className="flex flex-col md:flex-row h-screen bg-mex-cream overflow-hidden">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={userRole} 
        userName={posUser?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Usuario'} 
        onLogout={handleLogout}
      />
      
      <main className="flex-1 overflow-hidden pb-20 md:pb-0">
        {renderView()}
      </main>

      <Toaster position="top-right" />
    </div>
  );
}
