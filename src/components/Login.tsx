import React, { useState } from "react";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signInAnonymously } from "firebase/auth";
import { Button } from "./Button";
import { Card, CardContent } from "./Card";
import { User } from "../types";
import { auth, db } from "../firebase";
import { LogIn, User as UserIcon, Lock } from "lucide-react";
import toast from "react-hot-toast";

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<'google' | 'credentials'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const logoUrl = "https://scontent.fmex3-3.fna.fbcdn.net/v/t39.30808-6/305224800_502697315191276_5159032473398491144_n.jpg?_nc_cat=101&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=CxNRayDEeW8Q7kNvwFU9Nsv&_nc_oc=AdoOjXlYpF7dp9it8umJob6ZcAwUuBFAvCrJVNO2j9SC3EUZOvMN2nLdVAk26fvdOJs&_nc_zt=23&_nc_ht=scontent.fmex3-3.fna&_nc_gid=TAiJ3YiA-onkgw2dKf3Srw&_nc_ss=7a389&oh=00_Af3exLs62O6jgKBSzMrQ3Me4h893zsaVtuxLyHF4pTsrVQ&oe=69E840D8";

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Ingresa usuario y contraseña");
      return;
    }

    setLoading(true);
    console.log("Iniciando login con credenciales para:", username);
    try {
      // 1. Ensure we have a Firebase session (Anonymous) to read Firestore
      if (!auth.currentUser) {
        console.log("No hay usuario Firebase, iniciando sesión anónima...");
        await signInAnonymously(auth);
        console.log("Sesión anónima establecida:", auth.currentUser?.uid);
      } else {
        console.log("Ya existe una sesión Firebase:", auth.currentUser.uid, "Anónimo:", auth.currentUser.isAnonymous);
      }

      // 2. Query only by username to avoid composite index issues
      const usernameLower = username.trim().toLowerCase();
      console.log("Buscando usuario en Firestore:", usernameLower);
      
      const q = query(
        collection(db, "users"), 
        where("username", "==", usernameLower)
      );
      
      const querySnapshot = await getDocs(q);
      console.log("Usuarios encontrados con ese nombre:", querySnapshot.size);

      if (querySnapshot.empty) {
        toast.error("Usuario no encontrado");
        setLoading(false);
        return;
      }

      // 3. Find the user with the matching password in JS
      const userDoc = querySnapshot.docs.find(doc => {
        const data = doc.data();
        return data.password === password;
      });

      if (!userDoc) {
        console.log("Contraseña incorrecta para el usuario encontrado");
        toast.error("Contraseña incorrecta");
        setLoading(false);
        return;
      }

      const userData = { id: userDoc.id, ...userDoc.data() } as User;
      console.log("Login exitoso para:", userData.name, "Rol:", userData.role);

      if (!userData.active) {
        toast.error("Tu cuenta está desactivada. Contacta al administrador.");
        setLoading(false);
        return;
      }

      onLogin(userData);
      toast.success(`Bienvenido, ${userData.name}`);
    } catch (error: any) {
      console.error("Error detallado en login de credenciales:", error);
      
      if (error.code === 'auth/admin-restricted-operation') {
        toast.error(
          "El acceso anónimo está restringido en tu proyecto de Firebase. " +
          "Ve a la consola de Firebase > Authentication > Sign-in method y HABILITA el proveedor 'Anónimo'.", 
          { duration: 8000 }
        );
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error(
          "El inicio de sesión anónimo no está habilitado. " +
          "Debes activarlo en la consola de Firebase (Authentication > Sign-in method).",
          { duration: 8000 }
        );
      } else {
        toast.error("Error de conexión: " + (error.message || "Error desconocido"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // If we are currently anonymous (from a previous failed/partial login), sign out first
      if (auth.currentUser?.isAnonymous) {
        await auth.signOut();
      }
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      let userData: User;

      if (userDoc.exists()) {
        userData = { id: userDoc.id, ...userDoc.data() } as User;
        
        // Update email if it's missing or changed
        if (userData.email !== user.email) {
          await setDoc(userRef, { email: user.email }, { merge: true });
          userData.email = user.email || undefined;
        }

        if (!userData.active) {
          toast.error("Tu cuenta está desactivada. Contacta al administrador.");
          auth.signOut();
          setLoading(false);
          return;
        }
      } else {
        // Create new user
        const isOwner = user.email === "lascazuelasbosques@gmail.com";
        userData = {
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || "Usuario",
          username: user.email || "",
          email: user.email || undefined,
          role: isOwner ? "admin" : "waiter", // Default to waiter unless owner
          active: true,
        };
        await setDoc(userRef, userData);
      }

      onLogin(userData);
      toast.success(`Bienvenido, ${userData.name}`);
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error("Inicio de sesión cancelado");
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error("Dominio no autorizado. Debes agregar tu URL de Netlify en la consola de Firebase (Authentication > Settings > Authorized domains).", { duration: 8000 });
      } else {
        toast.error("Error al iniciar sesión con Google: " + (error.message || "Error desconocido"));
      }
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

        <CardContent className="p-8 flex flex-col items-center justify-center space-y-6">
          {loginMode === 'credentials' ? (
            <form onSubmit={handleCredentialsLogin} className="w-full space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase">Usuario</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-mex-green/20 outline-none"
                    placeholder="Tu nombre de usuario"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-mex-green/20 outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <Button 
                type="submit"
                variant="primary" 
                className="w-full h-12 text-lg bg-mex-green hover:bg-mex-green/90 gap-2 shadow-sm" 
                disabled={loading}
              >
                <LogIn size={20} />
                {loading ? "Iniciando..." : "Entrar"}
              </Button>
              
              <div className="pt-4 border-t border-stone-100">
                <Button 
                  type="button"
                  variant="ghost" 
                  className="w-full text-stone-500 hover:text-stone-800"
                  onClick={() => setLoginMode('google')}
                >
                  O usar cuenta de Google
                </Button>
              </div>
            </form>
          ) : (
            <div className="w-full space-y-4">
              <p className="text-center text-stone-600 mb-4">
                Inicia sesión con tu cuenta de Google para acceder al sistema.
              </p>

              <Button 
                onClick={handleGoogleLogin}
                variant="primary" 
                className="w-full h-14 text-lg bg-white text-stone-800 border border-stone-200 hover:bg-stone-50 gap-3 shadow-sm" 
                disabled={loading}
              >
                <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                    <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                    <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                    <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                    <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                  </g>
                </svg>
                {loading ? "Iniciando..." : "Continuar con Google"}
              </Button>

              <div className="pt-4 border-t border-stone-100">
                <Button 
                  type="button"
                  variant="ghost" 
                  className="w-full text-stone-500 hover:text-stone-800"
                  onClick={() => setLoginMode('credentials')}
                >
                  Volver a Usuario y Contraseña
                </Button>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-stone-400 mt-4">
            Acceso restringido a personal autorizado
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
