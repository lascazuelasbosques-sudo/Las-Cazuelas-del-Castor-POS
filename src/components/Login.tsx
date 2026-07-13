import React, { useState } from "react";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signInAnonymously } from "firebase/auth";
import { Button } from "./Button";
import { Card, CardContent } from "./Card";
import { User } from "../types";
import { auth, db } from "../firebase";
import { LogIn, User as UserIcon, Lock, RefreshCw, MessageCircle, Shield, ChefHat, Flame, ChevronRight, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useBranding } from "../lib/useBranding";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface LoginProps {
  onLogin: (user: User) => void;
  onEnterPortal: () => void;
}

const SUPER_ADMIN_EMAIL = "lascazuelasbosques@gmail.com";

export const Login = ({ onLogin, onEnterPortal }: LoginProps) => {
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<'landing' | 'credentials' | 'google'>('landing');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const { branding } = useBranding();

  const [imageError, setImageError] = useState(false);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Ingresa usuario y contraseña");
      return;
    }

    setLoading(true);
    console.log("Iniciando login con credenciales para:", username);
    try {
      // 1. We no longer need a Firebase session to read Firestore users since we allowed get/list for everyone
      console.log("Iniciando búsqueda de usuario en Firestore...");

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

      // 4. Ensure we have a Firebase session (Anonymous) to read other Firestore paths
      let firebaseUid = "";
      if (!auth.currentUser) {
        console.log("No hay usuario Firebase, iniciando sesión anónima...");
        try {
            const authResult = await signInAnonymously(auth);
            firebaseUid = authResult.user.uid;
            console.log("Sesión anónima establecida:", firebaseUid);
        } catch (authError: any) {
            console.error("No se pudo iniciar sesión anónimamente:", authError);
            if (authError.code === 'auth/operation-not-allowed' || authError.code === 'auth/admin-restricted-operation') {
                toast.error("Error: El acceso anónimo no está habilitado en Firebase. Inicia sesión con Google o pídele al Admin que lo habilite.", { duration: 8000 });
                setLoading(false);
                return;
            }
            throw authError; // propagate other errors
        }
      } else {
        firebaseUid = auth.currentUser.uid;
        console.log("Ya existe una sesión Firebase:", firebaseUid, "Anónimo:", auth.currentUser.isAnonymous);
      }

      // 5. Mirror the user document under their Firebase UID so security rules can verify their role
      if (firebaseUid) {
        console.log("Asociando sesión con el documento de usuario en Firestore...");
        const sessionUserRef = doc(db, "users", firebaseUid);
        await setDoc(sessionUserRef, {
          name: userData.name,
          username: userData.username || "",
          role: userData.role,
          active: userData.active,
          isGoogleUser: false,
          pin: userData.pin || "0000",
          password: userData.password || "",
          updatedAt: new Date().toISOString()
        });
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
      const provider = new GoogleAuthProvider();
      // CRITICAL: signInWithPopup must be called as soon as possible after user interaction.
      // Any 'await' before this call (like signing out an anonymous user) may cause the browser to block the popup.
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
      let userData: User;

      if (userDoc.exists()) {
        userData = { id: userDoc.id, ...userDoc.data() } as User;
        
        // Ensure Super Admin status is always synced
        if (isSuperAdmin && userData.role !== 'admin') {
          userData.role = 'admin';
          userData.active = true;
          await setDoc(userRef, { role: 'admin', active: true }, { merge: true });
        }

        // Update email if it's missing or changed
        if (userData.email !== user.email) {
          await setDoc(userRef, { email: user.email }, { merge: true });
          userData.email = user.email || "";
        }

        if (!userData.active) {
          toast.error("Tu cuenta está desactivada. Contacta al administrador.");
          auth.signOut();
          setLoading(false);
          return;
        }

        // Only admins can use Google Login (except super admin who is always admin)
        if (userData.role !== 'admin' && !isSuperAdmin) {
          toast.error("Esta cuenta no tiene permisos de administrador para usar Google. Usa tu Usuario y Contraseña.");
          auth.signOut();
          setLoading(false);
          return;
        }
      } else {
        // Handle new user (Only Super Admin can be auto-created if missing)
        if (isSuperAdmin) {
          userData = {
            id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || "Administrador",
            username: user.email || "",
            email: user.email || "",
            role: "admin",
            active: true,
            isGoogleUser: true
          };
          await setDoc(userRef, userData);
        } else {
          // Check if there is a pending user record with this email (created by an admin)
          const q = query(collection(db, "users"), where("email", "==", user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            // Move data from the placeholder doc to the auth.uid doc
            const placeholderDoc = querySnapshot.docs[0];
            const placeholderData = placeholderDoc.data();
            
            if (placeholderData.role !== 'admin') {
              toast.error("Solo las cuentas de Administrador pueden usar Google. Pide a un admin que te registre como tal.");
              auth.signOut();
              setLoading(false);
              return;
            }

            userData = {
              id: user.uid,
              name: placeholderData.name || user.displayName || "Administrador",
              username: placeholderData.username || user.email || "",
              email: user.email || "",
              role: placeholderData.role || "admin",
              active: placeholderData.active ?? true,
              isGoogleUser: true
            };
            
            const batch = writeBatch(db);
            batch.set(userRef, userData);
            // If the placeholder had a different ID (it was added via addDoc), delete it
            if (placeholderDoc.id !== user.uid) {
              batch.delete(placeholderDoc.ref);
            }
            await batch.commit();
          } else {
            toast.error("No tienes permisos de administrador. Contacta al administrador principal.");
            auth.signOut();
            setLoading(false);
            return;
          }
        }
      }

      onLogin(userData);
      toast.success(`Bienvenido, ${userData.name}`);
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error("Inicio de sesión cancelado");
      } else if (error.code === 'auth/popup-blocked') {
        toast.error("Ventana emergente bloqueada por el navegador. Por favor permite las ventanas emergentes o intenta abrir la app en una pestaña nueva.", { duration: 6000 });
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error("Dominio no autorizado. Debes agregar esta URL en la consola de Firebase (Authentication > Settings > Authorized domains).", { duration: 8000 });
      } else {
        toast.error("Error al iniciar sesión con Google: " + (error.message || "Error desconocido"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-4 font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-mex-gold/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-mex-green/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none -z-10" />

      <AnimatePresence mode="wait">
        {loginMode === 'landing' ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-sm flex flex-col items-center text-center space-y-12 relative z-10"
          >
            {/* BIG Logo section */}
            <div className="relative group">
              <div className="absolute inset-0 bg-mex-gold/20 rounded-3xl blur-2xl group-hover:bg-mex-gold/40 transition-all duration-700" />
              <div className="w-36 h-36 md:w-48 md:h-48 rounded-[2rem] border-8 border-white bg-white shadow-2xl flex items-center justify-center relative z-10 overflow-hidden transition-all duration-500 hover:rotate-1">
                {imageError ? (
                  <ChefHat size={72} className="text-mex-brown" />
                ) : (
                  <img 
                    src={branding.logoUrl} 
                    alt={branding.appName} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                    onError={() => {
                        console.log("Image loading error in login, falling back...");
                        setImageError(true);
                    }}
                  />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tighter leading-none font-serif">
                {branding.appName}
              </h1>
              <p className="text-stone-500 font-bold uppercase tracking-[0.2em] text-[10px]">Portal Inteligente de Pedidos</p>
            </div>

            {/* PRIMARY ACTION: WHATSAPP PORTAL */}
            <div className="w-full space-y-4">
              <button
                onClick={onEnterPortal}
                className="w-full bg-stone-950 hover:bg-mex-green text-white rounded-[2rem] p-6 flex items-center justify-between group transition-all shadow-2xl shadow-stone-200 active:scale-95 border-none cursor-pointer"
              >
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-mex-gold group-hover:text-white transition-colors mb-1">Para Llevar</span>
                  <span className="text-lg font-black tracking-tight flex items-center gap-2">
                    WHATSAPP CLIENTES
                  </span>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-white group-hover:text-mex-green transition-all">
                  <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
              
              <p className="text-[10px] text-stone-400 font-medium italic">
                Automatiza tu pedido y recíbelo sin esperas en sucursal.
              </p>
            </div>

            {/* SECONDARY DISCRETE ACTIONS (STAFF) */}
            <div className="pt-12 w-full flex flex-col items-center gap-8">
              <div className="h-px w-16 bg-stone-200" />
              <div className="flex flex-wrap justify-center gap-6">
                <button 
                  onClick={() => setLoginMode('credentials')}
                  className="flex items-center gap-2 text-[10px] font-black text-stone-400 hover:text-stone-900 uppercase tracking-widest transition-colors cursor-pointer bg-transparent border-none p-0"
                >
                  <ChefHat size={14} />
                  Cocina / Personal
                </button>
                <button 
                  onClick={() => setLoginMode('google')}
                  className="flex items-center gap-2 text-[10px] font-black text-stone-400 hover:text-stone-900 uppercase tracking-widest transition-colors cursor-pointer bg-transparent border-none p-0"
                >
                  <span className="font-serif italic lowercase font-black text-xs">g</span>
                  Admin
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="login-form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-sm relative z-10"
          >
            <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
              <div className="p-8 pt-10 pb-4 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-stone-950 text-white flex items-center justify-center mb-4">
                  <Shield size={32} />
                </div>
                <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight">Acceso Staff</h2>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">Identifícate para entrar</p>
              </div>

              <CardContent className="p-8 pt-4">
                {loginMode === 'credentials' ? (
                  <form onSubmit={handleCredentialsLogin} className="space-y-4">
                    <div className="space-y-1.5 focus-within:translate-x-1 transition-transform">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Usuario</label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                        <input 
                          type="text" 
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-stone-50 border border-stone-100 text-sm font-bold focus:bg-white focus:outline-none focus:border-stone-300 transition-all"
                          placeholder="admin"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 focus-within:translate-x-1 transition-transform">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                        <input 
                          type="password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-stone-50 border border-stone-100 text-sm font-bold focus:bg-white focus:outline-none focus:border-stone-300 transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit"
                      className="w-full h-14 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-black uppercase tracking-widest gap-2 shadow-xl shadow-stone-100 transition-all active:scale-95 border-none mt-4" 
                      disabled={loading}
                    >
                      {loading ? <RefreshCw className="animate-spin" size={20} /> : "ENTRAR"}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <Button 
                      onClick={handleGoogleLogin}
                      className="w-full h-14 bg-white border border-stone-150 text-stone-800 hover:bg-stone-50 rounded-2xl font-black uppercase tracking-widest gap-3 shadow-sm transition-all active:scale-95" 
                      disabled={loading}
                    >
                      <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                      {loading ? "Cargando..." : "Google Login"}
                    </Button>
                  </div>
                )}

                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => setLoginMode('landing')}
                    className="text-[10px] font-black text-stone-400 hover:text-stone-900 flex items-center gap-1 uppercase tracking-widest transition-all bg-transparent border-none cursor-pointer p-2"
                  >
                    <ArrowLeft size={10} />
                    Volver al Inicio
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[9px] text-stone-300 font-bold uppercase tracking-[0.3em] fixed bottom-8 text-center w-full">
        v.4.0 • SISTEMA OFICIAL CAZUELAS
      </p>
    </div>
  );
};
