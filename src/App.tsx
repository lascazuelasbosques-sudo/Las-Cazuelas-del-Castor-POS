import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OrderView } from './components/OrderView';
import { KitchenView } from './components/KitchenView';
import { CashierView } from './components/CashierView';
import { InventoryView } from './components/InventoryView';
import { AdminView } from './components/AdminView';
import { Login } from './components/Login';
import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Toaster } from 'react-hot-toast';

import { seedDatabase } from './seed';
import { db } from './firebase';

import { Order } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState('orders');
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('waiter');
  const [loading, setLoading] = useState(true);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure user document exists
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          if (!userDoc.exists()) {
            const role = user.email === 'lascazuelasbosques@gmail.com' ? 'admin' : 'waiter';
            await setDoc(userRef, {
              name: user.displayName || user.email?.split('@')[0] || 'Usuario',
              email: user.email,
              role: role,
              active: true
            });
            setUserRole(role);
          }

          // Listen for role changes
          unsubUserDoc = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
              setUserRole(doc.data().role);
            }
          });

        } catch (error) {
          console.error("Error ensuring user document:", error);
        }
        seedDatabase(); // Only seed if empty
      } else {
        if (unsubUserDoc) unsubUserDoc();
        setUserRole('waiter');
      }
      setUser(user);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-mex-cream">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mex-brown"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login />
        <Toaster position="top-right" />
      </>
    );
  }

  const handleEditOrder = (order: Order) => {
    setOrderToEdit(order);
    setActiveTab('orders');
  };

  const renderView = () => {
    switch (activeTab) {
      case 'orders':
        return <OrderView orderToEdit={orderToEdit} clearOrderToEdit={() => setOrderToEdit(null)} />;
      case 'kitchen':
        return <KitchenView />;
      case 'cash':
        return <CashierView onEditOrder={handleEditOrder} />;
      case 'inventory':
        return <InventoryView />;
      case 'admin':
        return <AdminView />;
      default:
        return <OrderView orderToEdit={orderToEdit} clearOrderToEdit={() => setOrderToEdit(null)} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-mex-cream overflow-hidden">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={userRole} 
        userName={user?.displayName || user?.email?.split('@')[0] || 'Usuario'} 
      />
      
      <main className="flex-1 overflow-hidden pb-20 md:pb-0">
        {renderView()}
      </main>

      <Toaster position="top-right" />
    </div>
  );
}
