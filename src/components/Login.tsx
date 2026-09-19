import React, { useState, useEffect, useRef } from "react";
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
  CheckCircle2,
  Eye,
  EyeOff,
  Delete,
  KeyRound,
  LogIn
} from "lucide-react";
import toast from "react-hot-toast";
import { useBranding } from "../lib/useBranding";
import { getRoleLabel } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { OfflineInstallerModal } from "./OfflineInstallerModal";
import { 
  toggleSimulateOffline, 
  getLocalCache, 
  syncUsersCacheFromFirestore, 
  subscribeToCollectionCache,
  safeStorage 
} from "../lib/offlineService";

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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showInstaller, setShowInstaller] = useState(false);
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  const pinInputRef = useRef<HTMLInputElement>(null);

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

  // Synchronize and subscribe to local users cache
  useEffect(() => {
    // Sync users from Firestore if network is available
    syncUsersCacheFromFirestore().catch(() => {});

    // Subscribe to cache updates (from admin or offline sync)
    const unsubscribe = subscribeToCollectionCache('users', (_, data) => {
      let list: User[] = Array.isArray(data) && data.length > 0 ? [...data] : [];

      if (list.length === 0) {
        try {
          const raw = safeStorage.getItem('offline_cache_col_users');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
          }
        } catch (e) {}
      }

      DEFAULT_USERS.forEach(def => {
        if (!list.some(u => 
          u.id === def.id || 
          (u.username && def.username && u.username.toLowerCase() === def.username.toLowerCase()) ||
          (u.name && def.name && u.name.toLowerCase() === def.name.toLowerCase())
        )) {
          list.push(def);
        }
      });

      const normalized = list
        .filter(u => u.active !== false)
        .map(u => ({
          ...u,
          pin: u.pin !== undefined && u.pin !== null ? String(u.pin).trim() : '',
          password: u.password !== undefined && u.password !== null ? String(u.password).trim() : '',
          username: u.username ? String(u.username).trim() : '',
          name: u.name ? String(u.name).trim() : ''
        }));

      setLocalUsers(normalized);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Helper to load all active local users
  const getOfflineUsers = React.useCallback((): User[] => {
    if (localUsers.length > 0) return localUsers;
    const cached = getLocalCache('users');
    const userList: User[] = Array.isArray(cached) && cached.length > 0 ? [...cached] : [];

    DEFAULT_USERS.forEach(def => {
      if (!userList.some(u => 
        u.id === def.id || 
        (u.username && def.username && u.username.toLowerCase() === def.username.toLowerCase()) ||
        (u.name && def.name && u.name.toLowerCase() === def.name.toLowerCase())
      )) {
        userList.push(def);
      }
    });

    return userList
      .filter(u => u.active !== false)
      .map(u => ({
        ...u,
        pin: u.pin !== undefined && u.pin !== null ? String(u.pin).trim() : '',
        password: u.password !== undefined && u.password !== null ? String(u.password).trim() : '',
        username: u.username ? String(u.username).trim() : '',
        name: u.name ? String(u.name).trim() : ''
      }));
  }, [localUsers]);

  // Set default selected user when viewing offline tab
  useEffect(() => {
    if (authTab === 'offline' && !selectedUser) {
      const users = getOfflineUsers();
      if (users.length > 0) {
        const found = username ? users.find(u => 
          u.name.toLowerCase() === username.toLowerCase() ||
          (u.username && u.username.toLowerCase() === username.toLowerCase())
        ) : users[0];
        const activeUser = found || users[0];
        setSelectedUser(activeUser);
        setUsername(activeUser.name);
        setPassword('');
      }
    }
  }, [authTab, selectedUser, username, getOfflineUsers]);

  const executeLogin = (targetUser: User) => {
    try {
      localStorage.setItem('posUser', JSON.stringify(targetUser));
    } catch (err) {}

    toast.success(`Acceso concedido: ${targetUser.name} (${getRoleLabel(targetUser.role)})`);
    onLogin(targetUser);
    setLoading(false);
  };

  const handleOfflineValidationLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const inputVal = username.trim();
    const inputPass = password.trim();

    if (!inputPass) {
      toast.error("Ingresa tu PIN personal o contraseña");
      pinInputRef.current?.focus();
      return;
    }

    setLoading(true);

    const availableUsers = getOfflineUsers();
    
    // 1. Resolve user: prioritize explicit selection or typed username/name
    let targetUser: User | undefined;
    if (selectedUser && (!inputVal || selectedUser.name.toLowerCase() === inputVal.toLowerCase() || (selectedUser.username && selectedUser.username.toLowerCase() === inputVal.toLowerCase()))) {
      targetUser = availableUsers.find(u => u.id === selectedUser.id) || selectedUser;
    }

    if (!targetUser && inputVal) {
      const inputLower = inputVal.toLowerCase();
      targetUser = availableUsers.find(u => 
        (u.username && u.username.toLowerCase() === inputLower) ||
        (u.name && u.name.toLowerCase() === inputLower) ||
        (u.email && u.email.toLowerCase() === inputLower) ||
        u.id.toLowerCase() === inputLower
      );

      if (!targetUser) {
        targetUser = availableUsers.find(u => 
          (u.name && u.name.toLowerCase().includes(inputLower)) ||
          (u.username && u.username.toLowerCase().includes(inputLower))
        );
      }
    }

    if (!targetUser && selectedUser) {
      targetUser = availableUsers.find(u => u.id === selectedUser.id) || selectedUser;
    }

    if (!targetUser) {
      toast.error(`El usuario "${inputVal || username}" no está registrado en el sistema local.`);
      setLoading(false);
      return;
    }

    if (targetUser.active === false) {
      toast.error(`La cuenta de ${targetUser.name} está desactivada.`);
      setLoading(false);
      return;
    }

    // 2. EXHAUSTIVE DEEP VALIDATION OF REGISTERED CREDENTIALS (PIN and/or Password)
    const registeredPin = targetUser.pin !== undefined && targetUser.pin !== null && targetUser.pin !== '' 
      ? String(targetUser.pin).trim() 
      : null;
    const registeredPassword = targetUser.password !== undefined && targetUser.password !== null && targetUser.password !== '' 
      ? String(targetUser.password).trim() 
      : null;

    if (!registeredPin && !registeredPassword) {
      toast.error(`El usuario ${targetUser.name} no tiene PIN ni contraseña registrados. Debe asignarse en Gestión de Personal.`);
      setLoading(false);
      return;
    }

    // Check PIN matching (exact match or 4-digit normalized padded match)
    const isPinMatch = registeredPin !== null && (
      inputPass === registeredPin ||
      (registeredPin.length <= 4 && inputPass.padStart(4, '0') === registeredPin.padStart(4, '0'))
    );

    // Check password matching
    const isPasswordMatch = registeredPassword !== null && (
      inputPass === registeredPassword
    );

    if (!isPinMatch && !isPasswordMatch) {
      toast.error(`PIN o contraseña incorrecta para ${targetUser.name}`);
      setPassword('');
      pinInputRef.current?.focus();
      setLoading(false);
      return;
    }

    // Success
    executeLogin(targetUser);
  };

  const handleNumpadPress = (val: string) => {
    if (val === 'C') {
      setPassword('');
    } else if (val === 'BACK') {
      setPassword(prev => prev.slice(0, -1));
    } else {
      if (password.length < 8) {
        setPassword(prev => prev + val);
      }
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

            {/* PRIMARY SYSTEM ACCESS BUTTONS */}
            <div className="w-full space-y-2.5 pt-1">
              {/* SECONDARY: WHATSAPP CLIENTES */}
              <button
                onClick={onEnterPortal}
                className="w-full bg-white hover:bg-stone-100 text-stone-900 border border-stone-200 rounded-2xl p-3.5 flex items-center justify-between group transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <div className="flex flex-col items-start text-left">
                  <span className="text-[9px] font-black uppercase tracking-widest text-mex-gold mb-0.5">Para Llevar</span>
                  <span className="text-sm font-black tracking-tight flex items-center gap-2 text-stone-800">
                    WHATSAPP CLIENTES
                  </span>
                </div>
                <div className="w-8 h-8 bg-stone-100 rounded-xl flex items-center justify-center group-hover:bg-stone-950 group-hover:text-white transition-all text-stone-500">
                  <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {/* AUTHENTICATION VIEW: 1st TAB ONLINE (GOOGLE) AND 2nd TAB OFFLINE (LOCAL WITH VALIDATION) */}
        {loginMode === 'auth' && (
          <motion.div
            key="auth-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md relative z-10"
          >
            <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
              {/* TOP NAVIGATION TABS: 1º ONLINE (GOOGLE) PRIMARIA | 2º OFFLINE (LOCAL) SECUNDARIA */}
              <div className="bg-stone-100 p-2 flex items-center justify-center gap-2 border-b border-stone-200">
                {/* TAB 1: ONLINE (PRIMARY) */}
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('online');
                    toggleSimulateOffline(false);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-2xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    authTab === 'online' 
                      ? "bg-stone-950 text-white shadow-md ring-2 ring-stone-950/20" 
                      : "text-stone-600 hover:bg-stone-200/70"
                  }`}
                >
                  <Wifi size={15} className={authTab === 'online' ? "text-mex-green" : ""} />
                  1. Online (Google)
                </button>

                {/* TAB 2: OFFLINE (SECONDARY) */}
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('offline');
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-2xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    authTab === 'offline' 
                      ? "bg-amber-600 text-white shadow-md ring-2 ring-amber-600/20" 
                      : "text-stone-600 hover:bg-stone-200/70"
                  }`}
                >
                  <WifiOff size={15} />
                  2. Offline (Local / PIN)
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
                      Acceso principal verificado por cuenta Google
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

                    <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/70 text-center">
                      <span className="text-[10px] font-bold text-amber-800 block">
                        ¿Estás trabajando sin conexión a internet?
                      </span>
                      <button
                        type="button"
                        onClick={() => setAuthTab('offline')}
                        className="text-[11px] font-black text-amber-700 underline uppercase tracking-wider mt-1 hover:text-amber-900 transition-colors bg-transparent border-none cursor-pointer"
                      >
                        Ir a pestaña Offline (Validación Local con PIN) →
                      </button>
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

              {/* TAB 2: OFFLINE - LOCAL ACCOUNTS WITH STRICT CREDENTIALS VALIDATION */}
              {authTab === 'offline' && (
                <div>
                  <div className="p-6 pt-5 pb-3 flex flex-col items-center text-center bg-amber-50/60 border-b border-amber-100">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mb-2 shadow-lg shadow-amber-500/30">
                      <WifiOff size={22} />
                    </div>
                    <h2 className="text-lg font-black text-stone-900 uppercase tracking-tight">
                      Validación Fuera de Línea (Local)
                    </h2>
                    <p className="text-[11px] text-amber-900/80 font-medium mt-0.5">
                      Selecciona tu usuario e ingresa tu PIN personal registrado
                    </p>
                  </div>

                  <CardContent className="p-5 space-y-3.5">
                    {/* User Selection List with Real Responsible Names */}
                    <div>
                      <div className="flex items-center justify-between mb-1 ml-0.5">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">
                          Personal Registrado ({getOfflineUsers().length}):
                        </label>
                        <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                          Base Local Sincronizada
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
                                pinInputRef.current?.focus();
                              }}
                              className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all border text-left cursor-pointer ${
                                isSelected 
                                  ? "bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-500/30" 
                                  : "bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
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
                                    @{user.username || 'personal'}
                                  </div>
                                </div>
                              </div>

                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${
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
                      <div className="p-2.5 bg-amber-50/90 rounded-2xl border-2 border-amber-300 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                            <UserIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[9px] font-black text-amber-900/80 uppercase tracking-widest block">
                              Usuario a Validar:
                            </span>
                            <span className="text-xs font-black text-stone-900 leading-tight block truncate">
                              {selectedUser.name}
                            </span>
                            <span className="text-[10px] font-bold text-amber-800">
                              @{selectedUser.username || 'personal'} • {getRoleLabel(selectedUser.role)}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shrink-0 shadow-sm">
                          {getRoleLabel(selectedUser.role)}
                        </span>
                      </div>
                    )}

                    {/* Offline Login Validation Form */}
                    <form onSubmit={handleOfflineValidationLogin} className="space-y-3 pt-0.5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                            PIN Personal o Contraseña
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-[10px] font-bold text-stone-400 hover:text-stone-700 flex items-center gap-1 bg-transparent border-none cursor-pointer"
                          >
                            {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                            <span>{showPassword ? "Ocultar" : "Mostrar"}</span>
                          </button>
                        </div>
                        <div className="relative">
                          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                          <input 
                            ref={pinInputRef}
                            type={showPassword ? "text" : "password"} 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-base font-bold focus:bg-white focus:outline-none focus:border-amber-500 text-stone-900 transition-all tracking-wider text-center"
                            placeholder="PIN de 4 dígitos o contraseña"
                            autoFocus
                            required
                          />
                          {password && (
                            <button
                              type="button"
                              onClick={() => setPassword('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 bg-transparent border-none cursor-pointer p-1"
                              title="Limpiar"
                            >
                              <Delete size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Touch Friendly PIN Numpad for Touchscreen Terminals */}
                      <div className="bg-stone-50 p-2 rounded-2xl border border-stone-200/80">
                        <div className="grid grid-cols-3 gap-1.5">
                          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BACK'].map((btn) => (
                            <button
                              key={btn}
                              type="button"
                              onClick={() => handleNumpadPress(btn)}
                              className={`h-9 rounded-xl font-black text-sm flex items-center justify-center transition-all cursor-pointer border select-none active:scale-95 ${
                                btn === 'C' 
                                  ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-100" 
                                  : btn === 'BACK'
                                    ? "bg-stone-200/70 hover:bg-stone-300 text-stone-700 border-stone-300/50"
                                    : "bg-white hover:bg-stone-100 text-stone-800 border-stone-200 shadow-sm"
                              }`}
                            >
                              {btn === 'BACK' ? <Delete size={15} /> : btn}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button 
                        type="submit"
                        className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider gap-2 shadow-lg shadow-amber-600/20 active:scale-98 transition-all mt-1 cursor-pointer border-none"
                        disabled={loading}
                      >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : "Validar PIN y Entrar"}
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

                    <div className="pt-1 flex justify-center">
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
              setAuthTab('online');
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
              setAuthTab('online');
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
