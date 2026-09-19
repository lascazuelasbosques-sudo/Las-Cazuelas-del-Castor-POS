import React, { useState } from "react";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { Button } from "./Button";
import { Card, CardContent } from "./Card";
import { User, DEFAULT_USERS } from "../types";
import { auth, db } from "../firebase";
import { 
  User as UserIcon, 
  Lock, 
  RefreshCw, 
  Shield, 
  ChefHat, 
  Flame, 
  ChevronRight, 
  ArrowLeft, 
  Power, 
  Wifi, 
  WifiOff, 
  CreditCard,
  ClipboardList,
  CheckCircle2
} from "lucide-react";
import toast from "react-hot-toast";
import { useBranding } from "../lib/useBranding";
import { motion, AnimatePresence } from "motion/react";
import { OfflineInstallerModal } from "./OfflineInstallerModal";
import { toggleSimulateOffline, getLocalCache } from "../lib/offlineService";

interface LoginProps {
  onLogin: (user: User) => void;
  onEnterPortal: () => void;
  onShutdown?: () => void;
}

const SUPER_ADMIN_EMAIL = "lascazuelasbosques@gmail.com";

export const Login = ({ onLogin, onEnterPortal, onShutdown }: LoginProps) => {
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<'landing' | 'auth'>('landing');
  const [authTab, setAuthTab] = useState<'online' | 'offline'>('online');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showInstaller, setShowInstaller] = useState(false);
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);

  const { branding } = useBranding();
  const [imageError, setImageError] = useState(false);

  React.useEffect(() => {
    const triggerFS = () => {
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

  const handleOfflineValidationLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Ingresa tu usuario y contraseña");
      return;
    }

    setLoading(true);
    const usernameLower = username.trim().toLowerCase();

    toggleSimulateOffline(true);
    let userData: User | null = null;
    
    // Check cached users in local storage first
    const cachedUsers = getLocalCache('users');
    if (Array.isArray(cachedUsers) && cachedUsers.length > 0) {
      userData = cachedUsers.find((u: any) => 
        u.username?.toLowerCase() === usernameLower && 
        (u.password === password || u.pin === password)
      ) || null;
    }

    // Check default pre-configured local users
    if (!userData) {
      userData = DEFAULT_USERS.find(u => 
        u.username?.toLowerCase() === usernameLower && 
        (u.password === password || u.pin === password)
      ) || null;
    }

    if (userData) {
      toast.success(`⚡ Bienvenido, ${userData.name} (Validación Local Exitosa)`);
      onLogin(userData);
    } else {
      toast.error("Contraseña o usuario incorrecto");
    }
    setLoading(false);
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
        if (user.email === SUPER_ADMIN_EMAIL || user.email?.includes('lascazuelasbosques@gmail.com')) {
          userData = {
            id: user.uid,
            name: user.displayName || "Super Admin",
            email: user.email || "",
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
            userData = {
              id: user.uid,
              name: user.displayName || user.email?.split('@')[0] || "Administrador",
              email: user.email || "",
              role: "admin",
              active: true,
              isGoogleUser: true
            };
            await setDoc(userRef, userData);
          }
        }
      }

      toggleSimulateOffline(false);
      onLogin(userData);
      toast.success(`Bienvenido, ${userData.name}`);
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error(error?.message || "Error al iniciar sesión con Google.");
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
                    setAuthTab('offline');
                    setUsername('cocina');
                    setPassword('');
                    setLoginMode('auth');
                  }}
                  className="flex items-center gap-1.5 text-xs font-black text-stone-600 hover:text-stone-900 uppercase tracking-widest transition-colors cursor-pointer bg-transparent border-none p-0"
                >
                  <ChefHat size={15} />
                  Cocina / Personal
                </button>
                <button 
                  onClick={() => {
                    setAuthTab('online');
                    setLoginMode('auth');
                  }}
                  className="flex items-center gap-1.5 text-xs font-black text-stone-600 hover:text-stone-900 uppercase tracking-widest transition-colors cursor-pointer bg-transparent border-none p-0"
                >
                  <Shield size={15} />
                  Admin
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* AUTHENTICATION VIEW WITH ONLINE (GOOGLE) AND OFFLINE (LOCAL ACCOUNTS WITH VALIDATION) */}
        {loginMode === 'auth' && (
          <motion.div
            key="auth-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md relative z-10"
          >
            <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
              {/* Top Navigation Tabs: Online (Google) vs Offline (Cuentas Locales) */}
              <div className="bg-stone-100 p-2 flex items-center justify-center gap-2 border-b border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('online');
                    toggleSimulateOffline(false);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-2xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    authTab === 'online' 
                      ? "bg-stone-950 text-white shadow-md" 
                      : "text-stone-600 hover:bg-stone-200/70"
                  }`}
                >
                  <Wifi size={15} className={authTab === 'online' ? "text-mex-green" : ""} />
                  Online (Google)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('offline');
                    toggleSimulateOffline(true);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-2xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    authTab === 'offline' 
                      ? "bg-amber-600 text-white shadow-md" 
                      : "text-stone-600 hover:bg-stone-200/70"
                  }`}
                >
                  <WifiOff size={15} />
                  Offline (Locales)
                </button>
              </div>

              {/* TAB 1: ONLINE - GOOGLE VALIDATION */}
              {authTab === 'online' && (
                <div>
                  <div className="p-6 pt-7 pb-4 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-stone-950 text-white flex items-center justify-center mb-3 shadow-xl shadow-stone-950/20">
                      <Shield size={32} className="text-mex-gold" />
                    </div>
                    <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight">
                      Validación En Línea
                    </h2>
                    <p className="text-xs text-stone-500 font-medium mt-1">
                      Acceso verificado por cuenta Google
                    </p>
                  </div>

                  <CardContent className="p-6 pt-2 space-y-4">
                    {/* Google Login Button */}
                    <Button 
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full h-14 bg-white border-2 border-stone-200 text-stone-800 hover:bg-stone-50 rounded-2xl font-black text-sm uppercase tracking-wider gap-3 shadow-sm hover:shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center" 
                    >
                      <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                      {loading ? "Validando cuenta Google..." : "Validar con Cuenta Google"}
                    </Button>

                    <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 text-center">
                      <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider block mb-0.5">
                        Super Admin Configurado
                      </span>
                      <span className="text-xs font-bold text-stone-700">
                        {SUPER_ADMIN_EMAIL}
                      </span>
                    </div>

                    {/* Return link */}
                    <div className="pt-2 flex justify-center">
                      <button
                        onClick={() => setLoginMode('landing')}
                        className="text-[10px] font-black text-stone-400 hover:text-stone-900 flex items-center gap-1 uppercase tracking-widest transition-all bg-transparent border-none cursor-pointer p-2"
                      >
                        <ArrowLeft size={12} />
                        Volver al Inicio
                      </button>
                    </div>
                  </CardContent>
                </div>
              )}

              {/* TAB 2: OFFLINE - LOCAL ACCOUNTS WITH CREDENTIALS VALIDATION (NO 1-CLICK BYPASS) */}
              {authTab === 'offline' && (
                <div>
                  <div className="p-6 pt-6 pb-3 flex flex-col items-center text-center bg-amber-50/50 border-b border-amber-100">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center mb-2 shadow-lg shadow-amber-500/30">
                      <WifiOff size={26} />
                    </div>
                    <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight">
                      Validación Fuera de Línea
                    </h2>
                    <p className="text-xs text-amber-900/80 font-medium mt-0.5">
                      Ingresa tus credenciales locales para validar acceso
                    </p>
                  </div>

                  <CardContent className="p-6 space-y-4">
                    {/* User Selection Quick Badges */}
                    <div>
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5 ml-0.5">
                        Seleccionar Usuario Local:
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {DEFAULT_USERS.map((user) => {
                          const isSelected = username.toLowerCase() === user.username.toLowerCase();
                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => {
                                setUsername(user.username);
                                setPassword('');
                              }}
                              className={`py-2 px-2 rounded-xl text-center font-black text-[11px] uppercase tracking-wider transition-all border cursor-pointer ${
                                isSelected 
                                  ? "bg-amber-500 text-white border-amber-600 shadow-sm" 
                                  : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-amber-50"
                              }`}
                            >
                              {user.name.split(' ')[0]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Offline Login Validation Form */}
                    <form onSubmit={handleOfflineValidationLogin} className="space-y-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">
                          Usuario
                        </label>
                        <div className="relative">
                          <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                          <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full pl-10 pr-3 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-bold focus:bg-white focus:outline-none focus:border-amber-500 text-stone-900 transition-all"
                            placeholder="admin / cocina / caja / mesero"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">
                          Contraseña o PIN
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                          <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-3 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-bold focus:bg-white focus:outline-none focus:border-amber-500 text-stone-900 transition-all"
                            placeholder="Contraseña o PIN de 4 dígitos"
                            autoFocus
                            required
                          />
                        </div>
                      </div>

                      <Button 
                        type="submit"
                        className="w-full h-13 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider gap-2 shadow-lg shadow-amber-600/20 active:scale-98 transition-all mt-2 cursor-pointer border-none"
                        disabled={loading}
                      >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : "Validar y Entrar (Offline)"}
                      </Button>
                    </form>

                    {/* Shutdown Button */}
                    {onShutdown && (
                      <button
                        onClick={() => setShowShutdownConfirm(true)}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-red-900/20 transition-all cursor-pointer border-none"
                      >
                        <Power size={16} />
                        APAGAR COMPUTADORA
                      </button>
                    )}

                    <div className="pt-2 flex justify-center">
                      <button
                        onClick={() => setLoginMode('landing')}
                        className="text-[10px] font-black text-stone-400 hover:text-stone-900 flex items-center gap-1 uppercase tracking-widest transition-all bg-transparent border-none cursor-pointer p-2"
                      >
                        <ArrowLeft size={12} />
                        Volver al Inicio
                      </button>
                    </div>
                  </CardContent>
                </div>
              )}
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
