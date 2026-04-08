import { Utensils, ClipboardList, Package, CreditCard, Settings, LogOut, Menu, Squirrel } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/src/lib/utils";
import { auth } from "../firebase";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: string;
  userName?: string;
}

export const Navbar = ({ activeTab, setActiveTab, userRole = 'waiter', userName = 'Usuario' }: NavbarProps) => {
  const logoUrl = "https://scontent.fmex3-3.fna.fbcdn.net/v/t39.30808-6/305224800_502697315191276_5159032473398491144_n.jpg?_nc_cat=101&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=XrHd6WIU72QQ7kNvwH4YUuv&_nc_oc=AdqN0uR_hiClwhlsHD-5cWnrOZLIkwl_1rc9xLpSMyzbq0BKhUhMp2k1zhiOM0IB2rU&_nc_zt=23&_nc_ht=scontent.fmex3-3.fna&_nc_gid=cVCP6594ky4G9QxsLv3J3w&_nc_ss=7a389&oh=00_Af2UhG1KSo71QAgmxpKVLu_7coTXMMFPWzKQ6epACyTvvA&oe=69DB4A18";
  const navItems = [
    { id: 'orders', label: 'Pedidos', icon: Utensils, roles: ['admin', 'waiter', 'cashier'] },
    { id: 'kitchen', label: 'Cocina', icon: ClipboardList, roles: ['admin', 'kitchen'] },
    { id: 'inventory', label: 'Inventario', icon: Package, roles: ['admin'] },
    { id: 'cash', label: 'Caja', icon: CreditCard, roles: ['admin', 'cashier'] },
    { id: 'admin', label: 'Admin', icon: Settings, roles: ['admin'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(userRole));

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Administrador',
      waiter: 'Mesero',
      kitchen: 'Cocina',
      cashier: 'Cajero'
    };
    return roles[role] || role;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-2 flex justify-around items-center md:relative md:flex-col md:h-screen md:w-64 md:border-t-0 md:border-r md:justify-start md:gap-4 md:py-8 z-50">
      <div className="hidden md:flex flex-col items-center mb-8 px-4">
        <div className="w-24 h-24 mb-4 rounded-full overflow-hidden border-4 border-mex-gold shadow-xl">
          <img 
            src={logoUrl} 
            alt="Las Cazuelas del Castor" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <h1 className="text-xl font-serif text-mex-brown text-center leading-tight">
          Las Cazuelas<br/><span className="text-sm italic text-mex-terracotta font-sans font-bold">del Castor</span>
        </h1>
      </div>

      {filteredItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={cn(
            "flex flex-col items-center gap-1 p-2 rounded-xl transition-all md:flex-row md:w-full md:px-4 md:py-3 md:gap-3",
            activeTab === item.id 
              ? "text-mex-green bg-mex-green/10 font-semibold" 
              : "text-stone-500 hover:bg-stone-100"
          )}
        >
          <item.icon size={24} />
          <span className="text-[10px] md:text-base">{item.label}</span>
        </button>
      ))}

      <div className="hidden md:mt-auto md:flex flex-col w-full gap-2 px-4">
        <div className="p-3 bg-stone-50 rounded-lg border border-stone-100 mb-2">
          <p className="text-xs text-stone-500">{getRoleLabel(userRole)}</p>
          <p className="text-sm font-medium truncate">{userName}</p>
        </div>
        <Button 
          variant="ghost" 
          className="justify-start gap-3 w-full text-stone-500"
          onClick={() => auth.signOut()}
        >
          <LogOut size={20} />
          Cerrar Sesión
        </Button>
      </div>
    </nav>
  );
};
