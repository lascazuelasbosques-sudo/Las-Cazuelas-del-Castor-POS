import React, { useState } from "react";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signInAnonymously } from "firebase/auth";
import { Button } from "./Button";
import { Card, CardContent } from "./Card";
import { User, DEFAULT_USERS } from "../types";
import { auth, db } from "../firebase";
import { 
  LogIn, 
  User as UserIcon, 
  Lock, 
  RefreshCw, 
  MessageCircle, 
  Shield, 
  ChefHat, 
  Flame, 
  ChevronRight, 
  ArrowLeft, 
  Smartphone, 
  Power, 
  Wifi, 
  WifiOff, 
  Zap,
  CreditCard,
  ClipboardList
} from "lucide-react";
import toast from "react-hot-toast";
import { useBranding } from "../lib/useBranding";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { OfflineInstallerModal } from "./OfflineInstallerModal";
import { toggleSimulateOffline, getOfflineStatus, getLocalCache } from "../lib/offlineService";

interface LoginProps {
  onLogin: (user: User) => void;
  onEnterPortal: () => void;
  onShutdown?: () => void;
}

const SUPER_ADMIN_EMAIL = "lascazuelasbosques@gmail.com";

export const Login = ({ onLogin, onEnterPortal, onShutdown }: LoginProps) => {
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<'landing' | 'credentials' | 'google' | 'offline_select'>('landing');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showInstaller, setShowInstaller] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => getOfflineStatus());
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);

  const { branding } = useBranding();
  const [imageError, setImageError] = useState(false);

  React.useEffect(() => {
    const triggerFS = () => {
      const doc = document as any;
      const docElm = document.documentElement as any;
      const req = docElm.requestFullscreen || docElm.webkitRequestFullscreen || docElm.mozRequestFullScreen || docElm.msRequestFullscreen;
      if (req) {
        req.call(docElm).catch(() => {});
      }
    };
    triggerFS();
    window.addEventListener('click', triggerFS, { once: true });
    window.addEventListener('touchstart', triggerFS, { once: true });
    return () => {
      window.removeEventListener('click', triggerFS);
      window.removeEventListener('touchstart', triggerFS);
    };
  }, []);

  const handleQuickOfflineLogin = (user: User) => {
    toggleSimulateOffline(true);
    setIsOfflineMode(true);
    toast.success(`⚡ Sesión iniciada fuera de línea como ${user.name}`, { duration: 3500 });
    onLogin(user);
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Ingresa usuario y contraseña");
      return;
    }

    setLoading(true);
    const usernameLower = username.trim().toLowerCase();

    // IF OFFLINE MODE IS ACTIVE
    if (isOfflineMode) {
      toggleSimulateOffline(true);
      let userData: User | null = null;
      
      const cachedUsers = getLocalCache('users');
      if (Array.isArray(cachedUsers) && cachedUsers.length > 0) {
        userData = cachedUsers.find((u: any) => 
          u.username?.toLowerCase() === usernameLower && 
          (u.password === password || u.pin === password)
        ) || null;
      }

      if (!userData) {
        userData = DEFAULT_USERS.find(u => 
          u.username?.toLowerCase() === usernameLower && 
          (u.password === password || u.pin === password)
        ) || null;
      }

      if (userData) {
        toast.success(`⚡ Bienvenido, ${userData.name} (Modo Fuera de Línea)`);
        onLogin(userData);
      } else {
        toast.error("Usuario o contraseña no encontrados en modo local");
      }
      setLoading(false);
      return;
    }

    // ONLINE MODE
    try {
      let querySnapshot: any = null;
      try {
        const q = query(
          collection(db, "users"), 
          where("username", "==", usernameLower)
        );
        querySnapshot = await getDocs(q);
      } catch (err: any) {
        console.warn("Firestore query failed, falling back to local users:", err);
      }

      let userData: User | null = null;

      if (querySnapshot && !querySnapshot.empty) {
        const userDoc = querySnapshot.docs.find((doc: any) => {
          const data = doc.data();
          return data.password === password;
        });
        if (userDoc) {
          userData = { id: userDoc.id, ...userDoc.data() } as User;
        }
      }

      if (!userData) {
        // Fallback default users
        const fallback = DEFAULT_USERS.find(u => u.username?.toLowerCase() === usernameLower && u.password === password);
        if (fallback) {
          userData = fallback;
        }
      }

      if (!userData) {
        toast.error("Usuario o contraseña incorrectos");
        setLoading(false);
        return;
      }

      if (!userData.active) {
        toast.error("Tu cuenta está desactivada. Contacta al administrador.");
        setLoading(false);
        return;
      }

      toggleSimulateOffline(false);
      onLogin(userData);
      toast.success(`Bienvenido, ${userData.name}`);
    } catch (error: any) {
      console.error("Credentials login error:", error);
      toast.error("Error al entrar. Intenta en Modo Fuera de Línea.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      let userData: User | null = null;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        userData = { id: userSnap.id, ...userSnap.data() } as User;
      } else {
        if (user.email === SUPER_ADMIN_EMAIL) {
          userData = {
            id: user.uid,
            name: user.displayName || "Super Admin",
            email: user.email,
            role: "admin",
            active: true,
            isGoogleUser: true
          };
          await setDoc(userRef, userData);
        } else {
          const q = query(collection(db, "users"), where("email", "==", user.email));
          const querySnap = await getDocs(q);

          if (!querySnap.empty) {
            const placeholderDoc = querySnap.docs[0];
            const placeholderData = placeholderDoc.data() as User;

            if (!placeholderData.active) {
              toast.error("Tu cuenta está desactivada.");
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
            if (placeholderDoc.id !== user.uid) {
              batch.delete(placeholderDoc.ref);
            }
            await batch.commit();
          } else {
            toast.error("No tienes permisos de administrador.");
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
      toast.error("Error al iniciar sesión con Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-4 font-sans relative overflow-hidden select-none">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-mex-gold/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-mex-green/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none -z-10" />

      <AnimatePresence mode="wait">
        {loginMode === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-sm flex flex-col items-center text-center space-y-6 relative z-10"
          >
            {/* BIG Logo section */}
            <div className="relative group">
              <div className="absolute inset-0 bg-mex-gold/20 rounded-3xl blur-2xl group-hover:bg-mex-gold/40 transition-all duration-700" />
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] border-8 border-white bg-white shadow-2xl flex items-center justify-center relative z-10 overflow-hidden transition-all duration-500 hover:rotate-1">
                {imageError ? (
                  <ChefHat size={64} className="text-mex-brown" />
                ) : (
                  <img 
                    src={branding.logoUrl} 
                    alt={branding.appName} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                    onError={() => {
                        setImageError(true);
                    }}
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tighter leading-none font-serif">
                {branding.appName}
              </h1>
              <p className="text-stone-500 font-bold uppercase tracking-[0.2em] text-[10px]">Portal Inteligente de Pedidos</p>
            </div>

            {/* MAIN ACTION BUTTON: WHATSAPP CLIENTES */}
            <div className="w-full pt-1">
              <button
                onClick={onEnterPortal}
                className="w-full bg-stone-950 hover:bg-stone-900 text-white rounded-2xl p-4 flex items-center justify-between group transition-all shadow-xl active:scale-95 border-none cursor-pointer"
              >
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-mex-gold mb-0.5">Para Llevar</span>
                  <span className="text-base font-black tracking-tight flex items-center gap-2">
                    WHATSAPP CLIENTES
                  </span>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:text-stone-900 transition-all">
                  <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            {/* LINKS: COCINA / PERSONAL y ADMIN */}
            <div className="pt-2 w-full flex flex-col items-center gap-4">
              <div className="h-px w-16 bg-stone-200" />
              <div className="flex flex-wrap justify-center items-center gap-5">
                <button 
                  onClick={() => {
                    setLoginMode('credentials');
                  }}
                  className="flex items-center gap-1.5 text-xs font-black text-stone-500 hover:text-stone-900 uppercase tracking-widest transition-colors cursor-pointer bg-transparent border-none p-0"
                >
                  <ChefHat size={15} />
                  Cocina / Personal
                </button>
                <button 
                  onClick={() => {
                    setLoginMode('credentials');
                  }}
                  className="flex items-center gap-1.5 text-xs font-black text-stone-500 hover:text-stone-900 uppercase tracking-widest transition-colors cursor-pointer bg-transparent border-none p-0"
                >
                  <Shield size={15} />
                  Admin
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* OFFLINE SELECT USER MODE */}
        {loginMode === 'offline_select' && (
          <motion.div
            key="offline-select"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md relative z-10"
          >
            <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
              <div className="p-6 pt-8 pb-4 flex flex-col items-center text-center bg-amber-50/50 border-b border-amber-100">
                <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center mb-3 shadow-lg shadow-amber-500/30">
                  <WifiOff size={28} />
                </div>
                <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight">Acceso Fuera de Línea</h2>
                <p className="text-xs text-amber-900/80 font-medium mt-1">
                  Selecciona tu usuario para ingresar sin conexión a internet
                </p>
              </div>

              <CardContent className="p-6 space-y-3">
                <div className="grid grid-cols-1 gap-2.5">
                  {DEFAULT_USERS.map((user) => {
                    let IconComp = ChefHat;
                    let badgeColor = "bg-stone-100 text-stone-700";
                    if (user.role === 'admin') {
                      IconComp = Shield;
                      badgeColor = "bg-purple-100 text-purple-800";
                    } else if (user.role === 'cashier') {
                      IconComp = CreditCard;
                      badgeColor = "bg-emerald-100 text-emerald-800";
                    } else if (user.role === 'parrilla') {
                      IconComp = Flame;
                      badgeColor = "bg-orange-100 text-orange-800";
                    } else if (user.role === 'waiter') {
                      IconComp = ClipboardList;
                      badgeColor = "bg-blue-100 text-blue-800";
                    }

                    return (
                      <button
                        key={user.id}
                        onClick={() => handleQuickOfflineLogin(user)}
                        className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 hover:bg-amber-50/80 border border-stone-200 hover:border-amber-300 transition-all text-left cursor-pointer group active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-700 group-hover:text-amber-700 shadow-sm">
                            <IconComp size={20} />
                          </div>
                          <div>
                            <div className="font-black text-stone-900 text-sm">{user.name}</div>
                            <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                              Usuario: {user.username}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${badgeColor}`}>
                            {user.role}
                          </span>
                          <ChevronRight size={18} className="text-stone-300 group-hover:text-amber-600 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Switch to manual credentials */}
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setIsOfflineMode(true);
                      setLoginMode('credentials');
                    }}
                    className="w-full py-2.5 text-xs font-black text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all border border-amber-200 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock size={14} />
                    Ingresar con Contraseña Manual
                  </button>

                  {onShutdown && (
                    <button
                      onClick={() => setShowShutdownConfirm(true)}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-red-900/20 transition-all cursor-pointer"
                    >
                      <Power size={16} />
                      APAGAR COMPUTADORA
                    </button>
                  )}

                  <button
                    onClick={() => setLoginMode('landing')}
                    className="mt-2 text-[10px] font-black text-stone-400 hover:text-stone-900 flex items-center justify-center gap-1 uppercase tracking-widest transition-all bg-transparent border-none cursor-pointer p-2"
                  >
                    <ArrowLeft size={12} />
                    Volver al Inicio
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* CREDENTIALS LOGIN (ONLINE OR OFFLINE) */}
        {(loginMode === 'credentials' || loginMode === 'google') && (
          <motion.div
            key="login-form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-sm relative z-10"
          >
            <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
              {/* Online / Offline Toggle Banner */}
              <div className="bg-stone-100 p-2.5 flex items-center justify-center gap-2 border-b border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsOfflineMode(false);
                    toggleSimulateOffline(false);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    !isOfflineMode 
                      ? "bg-mex-green text-white shadow-sm" 
                      : "text-stone-600 hover:bg-stone-200/70"
                  }`}
                >
                  <Wifi size={14} />
                  En Línea
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOfflineMode(true);
                    toggleSimulateOffline(true);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isOfflineMode 
                      ? "bg-amber-600 text-white shadow-sm" 
                      : "text-stone-600 hover:bg-stone-200/70"
                  }`}
                >
                  <WifiOff size={14} />
                  Fuera de Línea
                </button>
              </div>

              <div className="p-6 pt-6 pb-2 flex flex-col items-center">
                <div className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center mb-3 shadow-lg ${
                  isOfflineMode ? "bg-amber-600 shadow-amber-600/30" : "bg-stone-950 shadow-stone-950/30"
                }`}>
                  {isOfflineMode ? <WifiOff size={28} /> : <Shield size={28} />}
                </div>
                <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight">
                  {isOfflineMode ? "Acceso Fuera de Línea" : "Acceso Staff"}
                </h2>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">
                  {isOfflineMode ? "Validación con datos locales" : "Identifícate para entrar al sistema"}
                </p>
              </div>

              <CardContent className="p-6 pt-2">
                {loginMode === 'credentials' ? (
                  <form onSubmit={handleCredentialsLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Usuario</label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                        <input 
                          type="text" 
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-bold focus:bg-white focus:outline-none focus:border-stone-400 transition-all text-stone-900"
                          placeholder="admin / cocina / caja"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                        <input 
                          type="password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-bold focus:bg-white focus:outline-none focus:border-stone-400 transition-all text-stone-900"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit"
                      className={`w-full h-14 text-white rounded-2xl font-black uppercase tracking-widest gap-2 shadow-xl transition-all active:scale-95 border-none mt-4 cursor-pointer ${
                        isOfflineMode ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20" : "bg-stone-900 hover:bg-stone-800 shadow-stone-900/20"
                      }`}
                      disabled={loading}
                    >
                      {loading ? <RefreshCw className="animate-spin" size={20} /> : (isOfflineMode ? "ENTRAR OFFLINE" : "ENTRAR AL SISTEMA")}
                    </Button>
                    
                    {!isOfflineMode && (
                        <Button 
                          type="button"
                          onClick={handleGoogleLogin}
                          className="w-full h-14 bg-white border border-stone-200 text-stone-800 hover:bg-stone-50 rounded-2xl font-black uppercase tracking-widest gap-3 shadow-sm transition-all active:scale-95" 
                          disabled={loading}
                        >
                          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                          {loading ? "Cargando..." : "Google Login"}
                        </Button>
                    )}
                  </form>
                ) : null}

                {/* Quick Offline Users option if in offline */}
                {isOfflineMode && (
                  <div className="mt-4 pt-4 border-t border-stone-100">
                    <p className="text-[10px] font-bold text-stone-400 text-center uppercase tracking-wider mb-2">
                      O entra con 1 clic:
                    </p>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {DEFAULT_USERS.slice(0, 4).map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleQuickOfflineLogin(u)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-black hover:bg-amber-100 transition-all cursor-pointer"
                        >
                          {u.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shutdown Button */}
                {onShutdown && (
                  <button
                    onClick={() => setShowShutdownConfirm(true)}
                    className="mt-5 w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-red-900/20 transition-all cursor-pointer"
                  >
                    <Power size={16} />
                    APAGAR COMPUTADORA
                  </button>
                )}

                <div className="mt-4 flex justify-center">
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

      {/* SHUTDOWN CONFIRMATION MODAL */}
      {showShutdownConfirm && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <div className="bg-stone-900 border-2 border-red-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-950 border border-red-800 text-red-500 flex items-center justify-center mx-auto shadow-inner">
              <Power size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">¿Apagar Computadora?</h3>
              <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
                El sistema cerrará la sesión de forma segura y guardará los datos locales para que puedas apagar la computadora.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowShutdownConfirm(false)}
                className="w-full bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700 py-2.5 rounded-xl font-bold text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  setShowShutdownConfirm(false);
                  onShutdown?.();
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-black text-xs shadow-lg shadow-red-900/40"
              >
                Sí, Apagar
              </Button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[9px] text-stone-300 font-bold uppercase tracking-[0.3em] fixed bottom-6 text-center w-full">
        v.4.0 • SISTEMA OFICIAL CAZUELAS
      </p>

      <OfflineInstallerModal 
        isOpen={showInstaller} 
        onClose={() => setShowInstaller(false)} 
      />
    </div>
  );
};
