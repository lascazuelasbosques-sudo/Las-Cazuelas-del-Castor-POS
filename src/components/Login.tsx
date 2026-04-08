import { useState } from "react";
import { auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Button } from "./Button";
import { Card, CardContent } from "./Card";
import { Utensils, Squirrel } from "lucide-react";
import toast from "react-hot-toast";

export const Login = () => {
  const [loading, setLoading] = useState(false);
  const logoUrl = "https://scontent.fmex3-3.fna.fbcdn.net/v/t39.30808-6/305224800_502697315191276_5159032473398491144_n.jpg?_nc_cat=101&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=XrHd6WIU72QQ7kNvwH4YUuv&_nc_oc=AdqN0uR_hiClwhlsHD-5cWnrOZLIkwl_1rc9xLpSMyzbq0BKhUhMp2k1zhiOM0IB2rU&_nc_zt=23&_nc_ht=scontent.fmex3-3.fna&_nc_gid=cVCP6594ky4G9QxsLv3J3w&_nc_ss=7a389&oh=00_Af2UhG1KSo71QAgmxpKVLu_7coTXMMFPWzKQ6epACyTvvA&oe=69DB4A18";

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Bienvenido a Las Cazuelas del Castor");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-mex-cream p-4">
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardContent className="p-12 flex flex-col items-center text-center">
          <div className="w-40 h-40 mb-8 rounded-full overflow-hidden border-8 border-mex-gold shadow-2xl">
            <img 
              src={logoUrl} 
              alt="Las Cazuelas del Castor" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-4xl font-serif text-mex-brown mb-1">Las Cazuelas</h1>
          <p className="text-mex-terracotta font-bold italic mb-10">del Castor - Punto de Venta</p>
          
          <div className="w-full space-y-4">
            <Button 
              variant="primary" 
              className="w-full h-14 text-xl bg-mex-green hover:bg-mex-green/90" 
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? "Iniciando..." : "Entrar con Google"}
            </Button>
            <p className="text-xs text-stone-400">
              Acceso restringido a personal autorizado
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
