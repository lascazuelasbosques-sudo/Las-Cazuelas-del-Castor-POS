import { useState, FormEvent } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { Button } from "./Button";
import { Card, CardContent } from "./Card";
import { User } from "../types";
import { Lock, User as UserIcon, LogIn } from "lucide-react";
import toast from "react-hot-toast";

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const logoUrl = "https://scontent.fmex3-3.fna.fbcdn.net/v/t39.30808-6/305224800_502697315191276_5159032473398491144_n.jpg?_nc_cat=101&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=XrHd6WIU72QQ7kNvwH4YUuv&_nc_oc=AdqN0uR_hiClwhlsHD-5cWnrOZLIkwl_1rc9xLpSMyzbq0BKhUhMp2k1zhiOM0IB2rU&_nc_zt=23&_nc_ht=scontent.fmex3-3.fna&_nc_gid=cVCP6594ky4G9QxsLv3J3w&_nc_ss=7a389&oh=00_Af2UhG1KSo71QAgmxpKVLu_7coTXMMFPWzKQ6epACyTvvA&oe=69DB4A18";

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Ingresa usuario y contraseña");
      return;
    }

    setLoading(true);
    try {
      // Master Admin Fallback (Hardcoded for emergency/first setup)
      if (username === "admin" && password === "castor2024") {
        const masterAdmin: User = {
          id: "master-admin",
          name: "Administrador Maestro",
          username: "admin",
          role: "admin",
          active: true
        };
        onLogin(masterAdmin);
        toast.success("Bienvenido, Administrador Maestro");
        return;
      }

      // Check Firestore users
      const q = query(
        collection(db, "users"), 
        where("username", "==", username),
        where("password", "==", password),
        where("active", "==", true),
        limit(1)
      );
      
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const userData = { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
        onLogin(userData);
        toast.success(`Bienvenido, ${userData.name}`);
      } else {
        toast.error("Usuario o contraseña incorrectos");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-mex-cream p-4">
      <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden">
        <div className="bg-mex-brown p-8 flex flex-col items-center text-center text-white">
          <div className="w-24 h-24 mb-4 rounded-full overflow-hidden border-4 border-mex-gold shadow-xl">
            <img 
              src={logoUrl} 
              alt="Las Cazuelas del Castor" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-serif">Las Cazuelas del Castor</h1>
          <p className="text-mex-gold text-sm font-bold italic">Punto de Venta</p>
        </div>

        <CardContent className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-600 flex items-center gap-2">
                <UserIcon size={16} />
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-stone-100 focus:border-mex-green focus:outline-none transition-all"
                placeholder="Ingresa tu usuario"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-600 flex items-center gap-2">
                <Lock size={16} />
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-stone-100 focus:border-mex-green focus:outline-none transition-all"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <Button 
              type="submit"
              variant="primary" 
              className="w-full h-14 text-lg bg-mex-green hover:bg-mex-green/90 gap-2" 
              disabled={loading}
            >
              <LogIn size={20} />
              {loading ? "Iniciando..." : "Entrar al Sistema"}
            </Button>

            <p className="text-center text-xs text-stone-400">
              Acceso restringido a personal autorizado
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
