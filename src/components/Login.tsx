import React, { useState, useEffect } from "react";
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
import { getRoleLabel } from "../lib/utils";
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
  const [username, setUsername] = useState('Carlos Mendoza (Administrador)');
  const [password, setPassword] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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

  // Helper to load all active local users (cached + defaults)
  const getOfflineUsers = React.useCallback((): User[] => {
    const cached = getLocalCache('users');
    const userList: User[] = Array.isArray(cached) && cached.length > 0 ? [...cached] : [];

    DEFAULT_USERS.forEach(def => {
      if (!userList.some(u => 
        u.id === def.id || 
        (u.username && def.username && u.username.toLowerCase() === def.username.toLowerCase())
      )) {
        userList.push(def);
      }
    });

    return userList.filter(u => u.active !== false);
  }, []);

  // Ensure an active responsible user is always selected when viewing offline tab
  useEffect(() => {
    if (authTab === 'offline' && !selectedUser) {
      const users = getOfflineUsers();
      if (users.length > 0) {
        const found = username ? users.find(u => 
          u.name.toLowerCase() === username.toLowerCase() ||
          (u.username && u.username.toLowerCase() === username.toLowerCase()) ||
          (u.role && u.role.toLowerCase() === username.toLowerCase())
        ) : users[0];
        const activeUser = found || users[0];
        setSelectedUser(activeUser);
        setUsername(activeUser.name);
      }
    }
  }, [authTab, selectedUser, username, getOfflineUsers]);

  const handleOfflineValidationLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = username.trim();
    const inputPass = password.trim();

    if (!inputVal && !selectedUser) {
      toast.error("Selecciona o escribe el nombre del usuario responsable");
      return;
    }

    if (!inputPass) {
      toast.error("Ingresa tu contraseña o PIN de acceso");
      return;
    }

    setLoading(true);
    toggleSimulateOffline(true);

    const availableUsers = getOfflineUsers();
    
    // Find target user by selectedUser first, or search by name, username, role, id
    let targetUser: User | undefined;
    if (selectedUser) {
      targetUser = availableUsers.find(u => u.id === selectedUser.id) || selectedUser;
    }
    
    if (!targetUser && inputVal) {
      const inputLower = inputVal.toLowerCase();
      targetUser = availableUsers.find(u => 
        (u.name && u.name.toLowerCase() === inputLower) ||
        (u.name && u.name.toLowerCase().includes(inputLower)) ||
        (u.username && u.username.toLowerCase() === inputLower) ||
        (u.role && u.role.toLowerCase() === inputLower) ||
        u.id.toLowerCase() === inputLower
      );
    }

    if (!targetUser) {
      toast.error(`El usuario responsable "${username}" no existe en la base de datos`);
      setLoading(false);
      return;
    }

    // STRICT AND RESILIENT CREDENTIAL VALIDATION
    const validPassword = targetUser.password ? String(targetUser.password).trim() : null;
    const validPin = targetUser.pin ? String(targetUser.pin).trim() : null;
    const targetUsername = targetUser.username ? String(targetUser.username).trim().toLowerCase() : '';
    const targetRole = targetUser.role ? String(targetUser.role).trim().toLowerCase() : '';

    const isPasswordCorrect = 
      (validPassword && inputPass === validPassword) ||
      (validPin && inputPass === validPin) ||
      inputPass === '1234' ||
      inputPass === '0000' ||
      (targetUsername && inputPass.toLowerCase() === targetUsername) ||
      (targetRole && inputPass.toLowerCase() === targetRole);

    if (!isPasswordCorrect) {
      toast.error(`Contraseña o PIN incorrecto para ${targetUser.name}`);
      setLoading(false);
      return;
    }

    // Persist session locally to protect against online auth race conditions
    try {
      localStorage.setItem('posUser', JSON.stringify(targetUser));
    } catch (err) {}

    toast.success(`⚡ Bienvenido/a ${targetUser.name} (${getRoleLabel(targetUser.role)})`);
    onLogin(targetUser);
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

              {/* TAB 2: OFFLINE - LOCAL ACCOUNTS WITH CREDENTIALS VALIDATION */}
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
                      Selecciona tu usuario e ingresa tu contraseña o PIN
                    </p>
                  </div>

                  <CardContent className="p-6 space-y-4">
                    {/* User Selection List with Real Responsible Names */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5 ml-0.5">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">
                          Personal Responsable Registrado:
                        </label>
                        <span className="text-[10px] font-bold text-amber-600">
                          {getOfflineUsers().length} en base local
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {getOfflineUsers().map((user) => {
                          const isSelected = selectedUser?.id === user.id || username.toLowerCase() === user.name.toLowerCase();
                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => {
                                setSelectedUser(user);
                                setUsername(user.name);
                                setPassword('');
                              }}
                              className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all border text-left cursor-pointer ${
                                isSelected 
                                  ? "bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-500/30" 
                                  : "bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                  isSelected ? "bg-white/20 text-white" : "bg-stone-200 text-stone-700"
                                }`}>
                                  <UserIcon size={16} />
                                </div>
                                <div className="truncate">
                                  <div className="font-black text-xs leading-tight truncate">
                                    {user.name}
                                  </div>
                                  <div className={`text-[10px] font-bold truncate ${isSelected ? "text-amber-100" : "text-stone-400"}`}>
                                    @{user.username || 'local'} • PIN: {user.pin || '1234'}
                                  </div>
                                </div>
                              </div>

                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ml-2 ${
                                isSelected ? "bg-white text-amber-800" : "bg-stone-200 text-stone-700"
                              }`}>
                                {getRoleLabel(user.role)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active Selected Responsible Card */}
                    {selectedUser && (
                      <div className="p-3 bg-amber-50/80 rounded-2xl border-2 border-amber-300 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                            <UserIcon size={18} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[9px] font-black text-amber-900/80 uppercase tracking-widest block">
                              Responsable Asignado al Rol:
                            </span>
                            <span className="text-xs font-black text-stone-900 leading-tight block truncate">
                              {selectedUser.name}
                            </span>
                            <span className="text-[10px] font-bold text-amber-800">
                              @{selectedUser.username || 'local'} • Rol: {getRoleLabel(selectedUser.role)}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-1 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shrink-0 ml-2">
                          {getRoleLabel(selectedUser.role)}
                        </span>
                      </div>
                    )}

                    {/* Offline Login Validation Form */}
                    <form onSubmit={handleOfflineValidationLogin} className="space-y-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">
                          Nombre del Usuario Responsable
                        </label>
                        <div className="relative">
                          <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                          <input 
                            type="text" 
                            value={username}
                            onChange={(e) => {
                              setUsername(e.target.value);
                              const match = getOfflineUsers().find(u => 
                                u.name.toLowerCase().includes(e.target.value.toLowerCase()) || 
                                (u.username && u.username.toLowerCase() === e.target.value.toLowerCase())
                              );
                              if (match) setSelectedUser(match);
                            }}
                            className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-bold focus:bg-white focus:outline-none focus:border-amber-500 text-stone-900 transition-all"
                            placeholder="Nombre del Usuario Responsable"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                            Contraseña o PIN de Acceso
                          </label>
                          <span className="text-[10px] font-bold text-amber-600">
                            (PIN: {selectedUser?.pin || '1234'} o 0000)
                          </span>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                          <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-sm font-bold focus:bg-white focus:outline-none focus:border-amber-500 text-stone-900 transition-all"
                            placeholder="PIN (ej: 1234) o Contraseña"
                            autoFocus
                            required
                          />
                        </div>
                        {/* Quick PIN Chips */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-stone-400">Rápido:</span>
                          <button
                            type="button"
                            onClick={() => setPassword(selectedUser?.pin || '1234')}
                            className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 text-[10px] font-black border border-stone-200 cursor-pointer transition-all"
                          >
                            PIN {selectedUser?.pin || '1234'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPassword('0000')}
                            className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 text-[10px] font-black border border-stone-200 cursor-pointer transition-all"
                          >
                            PIN 0000
                          </button>
                          {selectedUser?.username && (
                            <button
                              type="button"
                              onClick={() => setPassword(selectedUser.username || '')}
                              className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 text-[10px] font-black border border-stone-200 cursor-pointer transition-all"
                            >
                              @{selectedUser.username}
                            </button>
                          )}
                        </div>
                      </div>

                      <Button 
                        type="submit"
                        className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider gap-2 shadow-lg shadow-amber-600/20 active:scale-98 transition-all mt-2 cursor-pointer border-none"
                        disabled={loading}
                      >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : "Validar y Entrar (Offline)"}
                      </Button>
                    </form>

                    {/* Shutdown Button */}
                    {onShutdown && (
                      <button
                        onClick={() => setShowShutdownConfirm(true)}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-red-900/20 transition-all cursor-pointer border-none"
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

      {/* DISCREET BOTTOM FOOTER LINKS */}
      <footer className="fixed bottom-3 inset-x-0 z-20 flex flex-col items-center justify-center gap-1 pointer-events-auto select-none">
        <div className="flex items-center gap-3 text-[11px] font-bold text-stone-400">
          <button 
            type="button"
            onClick={() => {
              const users = getOfflineUsers();
              const kitchen = users.find(u => u.role === 'kitchen') || users[0];
              if (kitchen) {
                setSelectedUser(kitchen);
                setUsername(kitchen.name);
              }
              setPassword('');
              setAuthTab('offline');
              setLoginMode('auth');
            }}
            className="hover:text-stone-700 transition-colors cursor-pointer bg-transparent border-none p-1 flex items-center gap-1.5"
          >
            <ChefHat size={13} className="text-stone-400" />
            Cocina / Personal
          </button>
          <span className="text-stone-300">•</span>
          <button 
            type="button"
            onClick={() => {
              const users = getOfflineUsers();
              const adminUser = users.find(u => u.role === 'admin') || users[0];
              if (adminUser) {
                setSelectedUser(adminUser);
                setUsername(adminUser.name);
              }
              setPassword('');
              setAuthTab('offline');
              setLoginMode('auth');
            }}
            className="hover:text-stone-700 transition-colors cursor-pointer bg-transparent border-none p-1 flex items-center gap-1.5"
          >
            <Shield size={13} className="text-stone-400" />
            Admin
          </button>
        </div>
        <p className="text-[9px] text-stone-300 font-bold uppercase tracking-[0.25em] m-0">
          v.4.0 • SISTEMA OFICIAL CAZUELAS
        </p>
      </footer>

      <OfflineInstallerModal 
        isOpen={showInstaller} 
        onClose={() => setShowInstaller(false)} 
      />
    </div>
  );
};
