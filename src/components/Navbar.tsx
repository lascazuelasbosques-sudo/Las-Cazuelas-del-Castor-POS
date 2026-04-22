import { useState, useEffect } from "react";
import { Utensils, ClipboardList, Package, CreditCard, Settings, LogOut, Menu, Squirrel } from "lucide-react";
import { Button } from "./Button";
import { cn, getRoleLabel } from "@/src/lib/utils";
import { auth, db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Order } from "../types";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: string;
  userName?: string;
  onLogout: () => void;
}

export const Navbar = ({ activeTab, setActiveTab, userRole = 'waiter', userName = 'Usuario', onLogout }: NavbarProps) => {
  const [pendingStations, setPendingStations] = useState<{plancha: boolean, cocina: boolean}>({ plancha: false, cocina: false });

  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "in", ["pending", "preparing"])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => doc.data() as Order);
      
      let hasPlancha = false;
      let hasCocina = false;

      orders.forEach(order => {
        order.items.forEach(item => {
          if (item.status !== 'completed') {
            if (item.station === 'plancha') hasPlancha = true;
            if (item.station === 'cocina' || !item.station) hasCocina = true;
          }
        });
      });

      setPendingStations({ plancha: hasPlancha, cocina: hasCocina });
    });

    return () => unsubscribe();
  }, []);

  const logoUrl = "https://scontent.fmex3-3.fna.fbcdn.net/v/t39.30808-6/305224800_502697315191276_5159032473398491144_n.jpg?_nc_cat=101&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=CxNRayDEeW8Q7kNvwFU9Nsv&_nc_oc=AdoOjXlYpF7dp9it8umJob6ZcAwUuBFAvCrJVNO2j9SC3EUZOvMN2nLdVAk26fvdOJs&_nc_zt=23&_nc_ht=scontent.fmex3-3.fna&_nc_gid=TAiJ3YiA-onkgw2dKf3Srw&_nc_ss=7a389&oh=00_Af3exLs62O6jgKBSzMrQ3Me4h893zsaVtuxLyHF4pTsrVQ&oe=69E840D8";
  const navItems = [
    { id: 'orders', label: 'Pedidos', icon: Utensils, roles: ['admin', 'waiter', 'cashier'] },
    { id: 'kitchen', label: 'Cocina', icon: ClipboardList, roles: ['admin', 'kitchen'] },
    { id: 'inventory', label: 'Inventario', icon: Package, roles: ['admin'] },
    { id: 'cash', label: 'Caja', icon: CreditCard, roles: ['admin', 'cashier', 'waiter'] },
    { id: 'admin', label: 'Admin', icon: Settings, roles: ['admin'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-2 flex justify-around items-center md:relative md:flex-col md:h-screen md:w-20 lg:w-64 md:border-t-0 md:border-r md:justify-start md:gap-4 md:px-2 lg:px-4 md:py-8 z-50 transition-all duration-300">
      <div className="hidden md:flex flex-col items-center mb-8 px-2 lg:px-4">
        <div className="w-12 h-12 lg:w-24 lg:h-24 mb-4 rounded-full overflow-hidden border-2 lg:border-4 border-mex-gold shadow-xl transition-all duration-300">
          <img 
            src={logoUrl} 
            alt="Las Cazuelas del Castor" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <h1 className="hidden lg:block text-xl font-serif text-mex-brown text-center leading-tight">
          Las Cazuelas<br/><span className="text-sm italic text-mex-terracotta font-sans font-bold">del Castor</span>
        </h1>
      </div>

      <div className="flex md:flex-col gap-2 w-full justify-around md:justify-start">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            title={item.label}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all md:w-full md:px-3 lg:px-4 md:py-3 lg:flex-row lg:gap-3 relative",
              activeTab === item.id 
                ? "text-mex-green bg-mex-green/10 font-semibold md:shadow-inner" 
                : "text-stone-500 hover:bg-stone-100"
            )}
          >
            <div className="relative shrink-0">
              <item.icon size={24} />
              {item.id === 'kitchen' && (pendingStations.cocina || pendingStations.plancha) && (
                <div className="absolute -top-1 -right-1 flex gap-0.5">
                  {pendingStations.cocina && (
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white animate-pulse" title="Pedido en Cocina" />
                  )}
                  {pendingStations.plancha && (
                    <span className="w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white animate-pulse" title="Pedido en Parrilla" />
                  )}
                </div>
              )}
            </div>
            <span className="text-[10px] md:hidden lg:inline lg:text-base whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Logout button for mobile */}
      <button
        onClick={() => {
          if (confirm("¿Cerrar sesión?")) onLogout();
        }}
        className="flex flex-col items-center gap-1 p-2 rounded-xl text-red-500 md:hidden"
      >
        <LogOut size={24} />
        <span className="text-[10px]">Salir</span>
      </button>

      <div className="hidden md:mt-auto md:flex flex-col w-full gap-2 px-2 lg:px-4">
        <div className="p-2 lg:p-3 bg-stone-50 rounded-lg border border-stone-100 mb-2 flex items-center justify-center lg:justify-start">
          <div className="hidden lg:block w-full">
            <p className="text-xs text-stone-500">{getRoleLabel(userRole)}</p>
            <p className="text-sm font-medium truncate">{userName}</p>
          </div>
          <div className="lg:hidden text-mex-green" title={`${userName} (${getRoleLabel(userRole)})`}>
            <Squirrel size={20} />
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="justify-center lg:justify-start gap-3 w-full text-stone-500 px-0 lg:px-4"
          title="Cerrar Sesión"
          onClick={() => {
            if (confirm("¿Estás seguro de que deseas cerrar sesión?")) onLogout();
          }}
        >
          <LogOut size={20} />
          <span className="hidden lg:inline">Cerrar Sesión</span>
        </Button>
      </div>
    </nav>
  );
};
