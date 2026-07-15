import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Trash2, AlertTriangle, Database, RefreshCw, ShieldAlert, X, CheckCircle2, Users, Key, Edit2, Save, Plus, TrendingUp, Calendar, BarChart3, Image as ImageIcon, Upload, Download, FileJson, TrendingDown, DollarSign, Award, Clock } from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  AreaChart, 
  Area 
} from "recharts";
import { Button } from "./Button";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc, writeBatch, updateDoc, addDoc, getDoc, setDoc, getDocsFromServer } from "firebase/firestore";
import toast from "react-hot-toast";
import { seedDatabase, restoreDeletedProducts } from "../seed";
import { handleFirestoreError, OperationType } from "../lib/firestoreErrorHandler";
import { User, UserRole, CashLog } from "../types";
import { formatCurrency, cn, getRoleLabel } from "@/src/lib/utils";
import { auth } from "../firebase";

const SUPER_ADMIN_EMAIL = "lascazuelasbosques@gmail.com";

export const AdminView = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [cashLogs, setCashLogs] = useState<CashLog[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'stats' | 'users' | 'branding' | 'backup'>('stats');
  const [productPeriod, setProductPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');

  // --- STATS COMPUTATION FOR DAY, WEEK, MONTH ---
  const statsData = React.useMemo(() => {
    // Exclude cancelled logs
    const validLogs = cashLogs.filter(log => !log.cancelled);

    // Sum revenue and expenses
    const totalRevenue = validLogs.filter(log => log.type === 'income').reduce((acc, l) => acc + l.amount, 0);
    const totalExpenses = validLogs.filter(log => log.type === 'expense').reduce((acc, l) => acc + l.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    // Filter by periods
    const now = new Date();
    const todayStr = now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - 7);

    const startOfMonth = new Date();
    startOfMonth.setMonth(now.getMonth() - 1);

    // Day stats
    const salesToday = validLogs
      .filter(log => log.type === 'income' && new Date(log.timestamp).toDateString() === todayStr)
      .reduce((acc, l) => acc + l.amount, 0);

    const salesYesterday = validLogs
      .filter(log => log.type === 'income' && new Date(log.timestamp).toDateString() === yesterdayStr)
      .reduce((acc, l) => acc + l.amount, 0);

    // Week stats
    const salesThisWeek = validLogs
      .filter(log => log.type === 'income' && new Date(log.timestamp) >= startOfWeek)
      .reduce((acc, l) => acc + l.amount, 0);

    // Month stats
    const salesThisMonth = validLogs
      .filter(log => log.type === 'income' && new Date(log.timestamp) >= startOfMonth)
      .reduce((acc, l) => acc + l.amount, 0);

    // Transaction & average ticket
    const totalTransactions = validLogs.filter(log => log.type === 'income').length;
    const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Payment methods grouping
    const methodPayments: Record<string, number> = {
      'Efectivo': 0,
      'Tarjeta': 0,
      'Transferencia': 0,
      'Crédito': 0
    };

    validLogs.filter(log => log.type === 'income').forEach(log => {
      const pLower = log.reason.toLowerCase();
      const method = log.paymentMethod || (pLower.includes('tarjeta') ? 'card' : pLower.includes('transferencia') ? 'transfer' : (pLower.includes('crédito') || pLower.includes('credito') ? 'credit' : 'cash'));
      if (method === 'card') {
        methodPayments['Tarjeta'] += log.amount;
      } else if (method === 'transfer') {
        methodPayments['Transferencia'] += log.amount;
      } else if (method === 'credit') {
        methodPayments['Crédito'] += log.amount;
      } else {
        methodPayments['Efectivo'] += log.amount;
      }
    });

    const paymentMethodStats = Object.keys(methodPayments).map(key => ({
      name: key,
      value: methodPayments[key]
    })).filter(item => item.value > 0);

    // Daily sales trend (last 7 calendar days)
    const dailyTrendMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      dailyTrendMap[d.toDateString()] = 0;
    }

    validLogs.filter(log => log.type === 'income').forEach(log => {
      const logDate = new Date(log.timestamp);
      const dateKey = logDate.toDateString();
      if (dailyTrendMap[dateKey] !== undefined) {
        dailyTrendMap[dateKey] += log.amount;
      }
    });

    const dailyTrendStats = Object.keys(dailyTrendMap).map(key => {
      const dateObj = new Date(key);
      const dayLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      return {
        date: dayLabel,
        ventas: dailyTrendMap[key]
      };
    });

    // Weekly sales trend (last 4 weeks)
    const weeklyTrendMap = [
      { name: 'Sem. 4 atrás', limitMin: 28, limitMax: 21, value: 0 },
      { name: 'Sem. 3 atrás', limitMin: 21, limitMax: 14, value: 0 },
      { name: 'Hace 2 Sem.', limitMin: 14, limitMax: 7, value: 0 },
      { name: 'Esta Sem.', limitMin: 7, limitMax: 0, value: 0 }
    ];

    validLogs.filter(log => log.type === 'income').forEach(log => {
      const logDate = new Date(log.timestamp);
      const diffTime = Math.abs(now.getTime() - logDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      weeklyTrendMap.forEach(week => {
        if (diffDays > week.limitMax && diffDays <= week.limitMin) {
          week.value += log.amount;
        }
      });
    });

    const weeklyTrendStats = weeklyTrendMap.map(w => ({
      name: w.name,
      ventas: w.value
    }));

    // Function to calculate top selling products for a given subset of logs
    const getTopSellingForLogs = (logs: CashLog[]) => {
      const map: Record<string, { quantity: number, revenue: number }> = {};
      logs.filter(log => log.type === 'income' && log.itemsSummary).forEach(log => {
        log.itemsSummary?.forEach(item => {
          const name = item.name;
          if (!map[name]) {
            map[name] = { quantity: 0, revenue: 0 };
          }
          map[name].quantity += item.quantity;
          map[name].revenue += (item.quantity * item.price);
        });
      });
      return Object.keys(map).map(key => ({
        name: key,
        cantidad: map[key].quantity,
        monto: map[key].revenue
      })).sort((a, b) => b.cantidad - a.cantidad);
    };

    const logsToday = validLogs.filter(log => new Date(log.timestamp).toDateString() === todayStr);
    const logsThisWeek = validLogs.filter(log => new Date(log.timestamp) >= startOfWeek);
    const logsThisMonth = validLogs.filter(log => new Date(log.timestamp) >= startOfMonth);

    const topSellingToday = getTopSellingForLogs(logsToday);
    const topSellingWeek = getTopSellingForLogs(logsThisWeek);
    const topSellingMonth = getTopSellingForLogs(logsThisMonth);
    const topSellingAll = getTopSellingForLogs(validLogs);

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      salesToday,
      salesYesterday,
      salesThisWeek,
      salesThisMonth,
      averageTicket,
      paymentMethodStats,
      dailyTrendStats,
      weeklyTrendStats,
      topSellingProducts: topSellingAll.slice(0, 5),
      topSellingToday,
      topSellingWeek,
      topSellingMonth,
      topSellingAll
    };
  }, [cashLogs]);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [brandingSettings, setBrandingSettings] = useState({ logoUrl: "", appName: "Las Cazuelas del Castor" });
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    name: "",
    username: "",
    password: "",
    email: "",
    pin: "0000",
    role: "waiter" as UserRole,
    active: true,
    isGoogleUser: false
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [verificationInput, setVerificationInput] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
    requireVerification?: boolean;
    verificationPhrase?: string;
  } | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchCashLogs();
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const docSnap = await getDoc(doc(db, "settings", "branding"));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBrandingSettings({
          logoUrl: data.logoUrl || "",
          appName: data.appName || "Las Cazuelas del Castor"
        });
        // Remove the hardcoded fetch of data.logoUrl to avoid showing the old logo in preview 
      }
    } catch (error) {
      console.error("Error fetching branding:", error);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 500) {
        toast.error("Imagen demasiado grande (máximo 500KB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveBranding = async () => {
    const toastId = toast.loading("Guardando configuración...");
    try {
      await setDoc(doc(db, "settings", "branding"), {
        logoUrl: logoPreview || brandingSettings.logoUrl,
        appName: brandingSettings.appName,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success("Configuración guardada", { id: toastId });
    } catch (error) {
      toast.error("Error al guardar", { id: toastId });
    }
  };

  const fetchCashLogs = async () => {
    try {
      const snap = await getDocs(collection(db, "cashLogs"));
      setCashLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashLog)));
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      const fetchedUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      
      // Cleanup: Delete Admins that are NOT Google Users (and not the Super Admin email)
      const invalidAdmins = fetchedUsers.filter(u => u.role === 'admin' && !u.isGoogleUser && u.email !== SUPER_ADMIN_EMAIL);
      
      let baseUsers = fetchedUsers;
      if (invalidAdmins.length > 0) {
        toast.error(`Se detectaron y eliminaron ${invalidAdmins.length} administradores sin cuenta de Google vinculada.`);
        const batch = writeBatch(db);
        invalidAdmins.forEach(u => {
          batch.delete(doc(db, "users", u.id));
        });
        await batch.commit();
        baseUsers = fetchedUsers.filter(u => !invalidAdmins.some(ia => ia.id === u.id));
      }

      // De-duplicate users: group by username or email
      const grouped: { [key: string]: User[] } = {};
      baseUsers.forEach(u => {
        const key = (u.username || u.email || u.name || "").trim().toLowerCase();
        if (!key) return;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(u);
      });

      const toDelete: User[] = [];
      const toKeep: User[] = [];

      Object.keys(grouped).forEach(key => {
        const list = grouped[key];
        if (list.length <= 1) {
          toKeep.push(list[0]);
          return;
        }

        // Find primary to keep (Google user or has createdAt or has a short ID)
        let primary = list.find(u => u.isGoogleUser);
        if (!primary) {
          primary = list.find(u => (u as any).createdAt);
        }
        if (!primary) {
          primary = list.find(u => u.id.length <= 20); // Firestore auto IDs are 20, session auth IDs are 28
        }
        if (!primary) {
          primary = list[0];
        }

        toKeep.push(primary);
        list.forEach(u => {
          if (u.id !== primary.id) {
            toDelete.push(u);
          }
        });
      });

      if (toDelete.length > 0) {
        console.log("Detectados duplicados para eliminar:", toDelete.map(u => `${u.name} (${u.id})`));
        const batch = writeBatch(db);
        toDelete.forEach(u => {
          batch.delete(doc(db, "users", u.id));
        });
        await batch.commit();
        toast.success(`Se limpiaron ${toDelete.length} cuentas duplicadas automáticamente.`, { id: "dedup-toast" });
        setUsers(baseUsers.filter(u => !toDelete.some(td => td.id === u.id)));
      } else {
        setUsers(baseUsers);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      handleFirestoreError(error, OperationType.GET, "users");
    }
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setSelectedUserId(null);
    setUserForm({
      name: "",
      username: "",
      password: "",
      email: "",
      pin: "0000",
      role: "waiter",
      active: true,
      isGoogleUser: false
    });
    setShowUserModal(true);
  };

  const handleOpenEditModal = (user: User) => {
    setIsEditing(true);
    setSelectedUserId(user.id);
    setUserForm({
      name: user.name,
      username: user.username || "",
      password: user.password || "",
      email: user.email || "",
      pin: user.pin || "0000",
      role: user.role,
      active: user.active,
      isGoogleUser: !!user.isGoogleUser
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.name) {
      toast.error("El nombre es obligatorio");
      return;
    }

    if (userForm.role === 'admin' && !userForm.email) {
      toast.error("Los administradores deben tener un correo de Google");
      return;
    }

    if (userForm.role !== 'admin' && (!userForm.username || (!isEditing && !userForm.password))) {
      toast.error("Usuario y contraseña obligatorios para Staff");
      return;
    }

    const usernameLower = userForm.username.toLowerCase().trim();
    const emailLower = userForm.email.toLowerCase().trim();
    
    // Check for duplicates
    const isDuplicateUser = userForm.role !== 'admin' && users.some(u => u.username?.toLowerCase() === usernameLower && u.id !== selectedUserId);
    const isDuplicateEmail = userForm.role === 'admin' && users.some(u => u.email?.toLowerCase() === emailLower && u.id !== selectedUserId);

    if (isDuplicateUser) {
      toast.error("El nombre de usuario ya existe");
      return;
    }
    if (isDuplicateEmail) {
      toast.error("El correo ya está registrado");
      return;
    }
    
    const toastId = toast.loading(isEditing ? "Actualizando usuario..." : "Creando usuario...");
    setLoading(true);
    try {
      const userData = {
        ...userForm,
        username: userForm.role === 'admin' ? "" : usernameLower,
        email: emailLower,
        isGoogleUser: userForm.role === 'admin',
        updatedAt: new Date().toISOString()
      };

      if (isEditing && selectedUserId) {
        // Protect Super Admin
        const userToEdit = users.find(u => u.id === selectedUserId);
        if (userToEdit?.email === SUPER_ADMIN_EMAIL && (userData.role !== 'admin' || !userData.active)) {
          toast.error("No puedes quitar privilegios ni desactivar al Administrador Principal", { id: toastId });
          setLoading(false);
          return;
        }

        await updateDoc(doc(db, "users", selectedUserId), userData);
        toast.success("Usuario actualizado exitosamente", { id: toastId });
      } else {
        await addDoc(collection(db, "users"), {
          ...userData,
          createdAt: new Date().toISOString()
        });
        toast.success("Usuario creado exitosamente", { id: toastId });
      }

      setShowUserModal(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast.error("Error al guardar usuario", { id: toastId });
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, "users");
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    const toastId = toast.loading("Preparando respaldo...");
    try {
      const collections = ["categories", "products", "orders", "users", "cashLogs", "settings", "counters"];
      const backupData: any = {};

      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        backupData[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `respaldo_pos_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Respaldo descargado exitosamente", { id: toastId });
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Error al exportar datos", { id: toastId });
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("¡ATENCIÓN! Importar datos sobrescribirá registros existentes con el mismo ID. ¿Deseas continuar?")) return;

    const toastId = toast.loading("Importando datos...");
    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const backupData = JSON.parse(event.target?.result as string);
          const collections = Object.keys(backupData);

          for (const colName of collections) {
            const batch = writeBatch(db);
            const docs = backupData[colName];
            
            if (Array.isArray(docs)) {
              docs.forEach((docData: any) => {
                const { id, ...data } = docData;
                const docRef = doc(db, colName, id);
                batch.set(docRef, data);
              });
              await batch.commit();
            }
          }

          toast.success("Datos importados exitosamente", { id: toastId });
          fetchUsers();
          fetchCashLogs();
          fetchBranding();
        } catch (err) {
          console.error("Parse/Commit error:", err);
          toast.error("Archivo de respaldo inválido", { id: toastId });
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Error al importar datos", { id: toastId });
      setLoading(false);
    }
  };

  const toggleUserStatus = async (user: User) => {
    if (user.id === auth.currentUser?.uid) {
      toast.error("No puedes desactivar tu propia cuenta");
      return;
    }

    if (user.email === SUPER_ADMIN_EMAIL) {
      toast.error("No se puede desactivar al Administrador Principal");
      return;
    }

    const newStatus = !user.active;
    try {
      await updateDoc(doc(db, "users", user.id), { active: newStatus });
      toast.success(`Usuario ${newStatus ? 'activado' : 'desactivado'}`);
      fetchUsers();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "users");
    }
  };

  const handleRepairPermissions = async () => {
    const toastId = toast.loading("Reparando permisos...");
    try {
      if (!auth.currentUser) throw new Error("No hay sesión de Firebase activa");
      
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        role: 'admin',
        active: true,
        repairedAt: new Date().toISOString()
      }, { merge: true });
      
      toast.success("Permisos reparados. Intenta de nuevo.", { id: toastId });
      fetchUsers();
    } catch (error) {
      console.error("Repair error:", error);
      toast.error("No se pudieron reparar los permisos automáticamente.", { id: toastId });
    }
  };



  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto flex flex-col gap-6 md:gap-8 bg-mex-cream no-scrollbar animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-mex-brown text-white rounded-[1.5rem] shadow-xl shadow-mex-brown/20 flex flex-col items-center">
            <Database size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-serif text-mex-brown">Administración</h1>
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">Configuración y Reportes de Ventas</p>
          </div>
        </div>
      </div>

      {/* Elegant sub navigation tabs to separate concerns professionally */}
      <div className="flex gap-1.5 p-1 bg-stone-100/80 rounded-2xl self-start max-w-full overflow-x-auto no-scrollbar shrink-0 border border-stone-200/40">
        <button
          onClick={() => setActiveAdminTab('stats')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
            activeAdminTab === 'stats'
              ? "bg-stone-900 text-white shadow-md"
              : "text-stone-500 hover:text-stone-800"
          )}
        >
          <BarChart3 size={15} />
          Estadísticas
        </button>
        <button
          onClick={() => setActiveAdminTab('users')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
            activeAdminTab === 'users'
              ? "bg-stone-900 text-white shadow-md"
              : "text-stone-500 hover:text-stone-800"
          )}
        >
          <Users size={15} />
          Usuarios
        </button>
        <button
          onClick={() => setActiveAdminTab('branding')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
            activeAdminTab === 'branding'
              ? "bg-stone-900 text-white shadow-md"
              : "text-stone-500 hover:text-stone-800"
          )}
        >
          <ImageIcon size={15} />
          Identidad / Marca
        </button>
        <button
          onClick={() => setActiveAdminTab('backup')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
            activeAdminTab === 'backup'
              ? "bg-stone-900 text-white shadow-md"
              : "text-stone-500 hover:text-stone-800"
          )}
        >
          <Database size={15} />
          Respaldo y Sist.
        </button>
      </div>

      {/* STATS PANEL */}
      {activeAdminTab === 'stats' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-400">
          {/* Quick stats grid / bento cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-none shadow-md rounded-[1.5rem] bg-white overflow-hidden p-5 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Ventas de Hoy</p>
                <h3 className="text-2xl font-black text-stone-800 font-serif mt-1">{formatCurrency(statsData.salesToday)}</h3>
              </div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-extrabold text-mex-green bg-green-50 px-2 py-1 rounded-lg w-fit">
                <TrendingUp size={12} />
                <span>Hoy vs Ayer ({formatCurrency(statsData.salesYesterday)})</span>
              </div>
            </Card>

            <Card className="border-none shadow-md rounded-[1.5rem] bg-white overflow-hidden p-5 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Ventas (7 Días)</p>
                <h3 className="text-2xl font-black text-stone-800 font-serif mt-1">{formatCurrency(statsData.salesThisWeek)}</h3>
              </div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-extrabold text-mex-brown bg-mex-cream/60 px-2 py-1 rounded-lg w-fit">
                <Calendar size={12} />
                <span>Esta Semana</span>
              </div>
            </Card>

            <Card className="border-none shadow-md rounded-[1.5rem] bg-white overflow-hidden p-5 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Ventas (30 Días)</p>
                <h3 className="text-2xl font-black text-stone-800 font-serif mt-1">{formatCurrency(statsData.salesThisMonth)}</h3>
              </div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-extrabold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg w-fit">
                <TrendingUp size={12} />
                <span>Mes Actual</span>
              </div>
            </Card>

            <Card className="border-none shadow-md rounded-[1.5rem] bg-white overflow-hidden p-5 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Ticket Promedio</p>
                <h3 className="text-2xl font-black text-stone-800 font-serif mt-1">{formatCurrency(statsData.averageTicket)}</h3>
              </div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-extrabold text-mex-gold bg-amber-50 px-2 py-1 rounded-lg w-fit">
                <DollarSign size={12} />
                <span>Valor Medio</span>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales trend bar chart */}
            <Card className="lg:col-span-2 border-none shadow-xl rounded-[2rem] bg-white p-6">
              <h3 className="text-[12px] font-black uppercase tracking-wider text-stone-800 mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-mex-green" />
                Ventas de los Últimos 7 Días
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData.dailyTrendStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                    <XAxis dataKey="date" stroke="#a8a29e" fontSize={10} tickLine={false} />
                    <YAxis stroke="#a8a29e" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      formatter={(value: any) => [formatCurrency(Number(value)), 'Ventas']} 
                      contentStyle={{ background: '#1c1917', borderRadius: '12px', border: 'none', color: '#fff' }} 
                    />
                    <Bar dataKey="ventas" fill="#aa7c5f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Payment methods allocation */}
            <Card className="border-none shadow-xl rounded-[2rem] bg-white p-6">
              <h3 className="text-[12px] font-black uppercase tracking-wider text-stone-800 mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-mex-gold" />
                Métodos de Pago Utilizados
              </h3>
              <div className="h-64 flex flex-col justify-between">
                {statsData.paymentMethodStats.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-stone-400">Sin datos de cobros</div>
                ) : (
                  <>
                    <div className="flex-1 h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statsData.paymentMethodStats}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {statsData.paymentMethodStats.map((entry, index) => {
                              const colors = ['#835e46', '#22c55e', '#a855f7', '#f59e0b'];
                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                            })}
                          </Pie>
                          <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {statsData.paymentMethodStats.map((entry, index) => {
                        const colors = ['#835e46', '#22c55e', '#a855f7', '#f59e0b'];
                        return (
                          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                            <span className="text-stone-500">{entry.name}:</span>
                            <span className="font-extrabold text-stone-700">{formatCurrency(entry.value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Weekly trends bar chart */}
            <Card className="border-none shadow-xl rounded-[2rem] bg-white p-6">
              <h3 className="text-[12px] font-black uppercase tracking-wider text-stone-800 mb-4 flex items-center gap-2">
                <Calendar size={16} className="text-purple-600" />
                Ventas Mensuales (Semanales)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData.weeklyTrendStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                    <XAxis dataKey="name" stroke="#a8a29e" fontSize={10} tickLine={false} />
                    <YAxis stroke="#a8a29e" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Ventas']} />
                    <Bar dataKey="ventas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Top Products Rankings based on processed cashLogs itemsSummaries with Day/Week/Month selection */}
            <Card className="lg:col-span-2 border-none shadow-xl rounded-[2rem] bg-white p-6 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <h3 className="text-[12px] font-black uppercase tracking-wider text-stone-800 flex items-center gap-2">
                    <Award size={16} className="text-mex-gold" />
                    Platillos Más Vendidos (Estadísticas)
                  </h3>
                  
                  {/* Period selection tabs */}
                  <div className="flex bg-stone-100 p-1 rounded-xl gap-1 self-start sm:self-auto border border-stone-200/50">
                    <button
                      onClick={() => setProductPeriod('today')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                        productPeriod === 'today'
                          ? "bg-stone-900 text-white shadow-sm"
                          : "text-stone-500 hover:text-stone-850"
                      )}
                    >
                      Hoy
                    </button>
                    <button
                      onClick={() => setProductPeriod('week')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                        productPeriod === 'week'
                          ? "bg-stone-900 text-white shadow-sm"
                          : "text-stone-500 hover:text-stone-850"
                      )}
                    >
                      Semana
                    </button>
                    <button
                      onClick={() => setProductPeriod('month')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                        productPeriod === 'month'
                          ? "bg-stone-900 text-white shadow-sm"
                          : "text-stone-500 hover:text-stone-850"
                      )}
                    >
                      Mes
                    </button>
                    <button
                      onClick={() => setProductPeriod('all')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                        productPeriod === 'all'
                          ? "bg-stone-900 text-white shadow-sm"
                          : "text-stone-500 hover:text-stone-850"
                      )}
                    >
                      Histórico
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const activeProducts = productPeriod === 'today'
                      ? statsData.topSellingToday
                      : productPeriod === 'week'
                        ? statsData.topSellingWeek
                        : productPeriod === 'month'
                          ? statsData.topSellingMonth
                          : statsData.topSellingAll;

                    if (activeProducts.length === 0) {
                      return (
                        <div className="py-20 text-center text-xs text-stone-400 font-semibold uppercase tracking-widest">
                          No hay ventas registradas en este período con detalle de productos todavía
                        </div>
                      );
                    }

                    const maxQuantity = Math.max(...activeProducts.map(p => p.cantidad), 1);

                    return activeProducts.slice(0, 7).map((p, index) => {
                      const percentage = (p.cantidad / maxQuantity) * 100;
                      return (
                        <div key={p.name} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shadow-xs shrink-0",
                                index === 0 ? "bg-amber-500" : index === 1 ? "bg-stone-400" : index === 2 ? "bg-amber-700" : "bg-purple-500"
                              )}>
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-bold text-stone-800 text-xs sm:text-sm">{p.name}</p>
                                <p className="text-[10px] text-stone-400 font-extrabold uppercase tracking-wide mt-0.5">
                                  {p.cantidad} {p.cantidad === 1 ? 'porción vendida' : 'porciones vendidas'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-mex-brown font-serif text-sm sm:text-base">{formatCurrency(p.monto)}</p>
                              <p className="text-[8px] font-extrabold text-stone-400 uppercase tracking-widest mt-0.5">Monto total</p>
                            </div>
                          </div>
                          
                          {/* Beautiful, minimalist indicator progress bar */}
                          <div className="w-full bg-stone-200/60 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                index === 0 ? "bg-amber-500" : index === 1 ? "bg-stone-400" : index === 2 ? "bg-amber-700" : "bg-purple-500"
                              )} 
                              style={{ width: `${percentage}%` }} 
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* USERS PANEL */}
      {activeAdminTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-450">
          <Card className="lg:col-span-2 border-none shadow-xl shadow-stone-200/50 rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-white border-b border-stone-50 p-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-mex-green/10 text-mex-green rounded-xl">
                  <Users size={20} />
                </div>
                <h2 className="font-black text-stone-800 uppercase tracking-tighter">Usuarios</h2>
              </div>
              <Button 
                variant="primary" 
                size="sm" 
                className="bg-mex-green hover:bg-mex-green/90 gap-2 h-10 px-4 rounded-xl shadow-lg shadow-mex-green/10 cursor-pointer"
                onClick={handleOpenAddModal}
              >
                <Plus size={16} />
                <span>Nuevo Usuario</span>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile Cards for Users */}
              <div className="sm:hidden divide-y divide-stone-50">
                {users.map(u => (
                  <div key={u.id} className="p-4 flex items-center justify-between group active:bg-stone-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-black text-white shadow-sm",
                        u.role === 'admin' ? "bg-mex-brown" : "bg-stone-200"
                      )}>
                        {(u.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-stone-800 text-sm">{u.name || 'Usuario'}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-stone-400 font-bold uppercase">@{u.username}</span>
                          <span className={cn(
                            "text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter",
                            u.role === 'admin' ? "bg-stone-800 text-white" : "bg-stone-50 text-stone-400"
                          )}>
                            {getRoleLabel(u.role)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => toggleUserStatus(u)}
                        className={cn(
                          "w-3 h-3 rounded-full shadow-sm cursor-pointer",
                          u.active ? "bg-mex-green shadow-mex-green/20" : "bg-stone-200"
                        )}
                      />
                      <button 
                        onClick={() => handleOpenEditModal(u)}
                        className="p-2 text-stone-300 hover:text-mex-green cursor-pointer"
                      >
                        <Edit2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] text-stone-400 font-bold uppercase tracking-widest border-b border-stone-50">
                      <th className="px-6 py-4">Nombre / Usuario</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4">PIN</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {users.map(u => (
                      <tr key={u.id} className="group hover:bg-stone-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-stone-800">{u.name}</p>
                          <p className="text-xs text-stone-400">@{u.username || 'sin_usuario'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-tighter shadow-sm",
                            u.role === 'admin' ? "bg-mex-brown text-white" : "bg-white text-stone-500 border border-stone-100"
                          )}>
                            {getRoleLabel(u.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => toggleUserStatus(u)}
                            className={cn(
                              "flex items-center gap-2 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all cursor-pointer",
                              u.active ? "bg-mex-green/10 text-mex-green" : "bg-red-50 text-mex-red"
                            )}
                          >
                            <div className={cn("w-1.5 h-1.5 rounded-full", u.active ? "bg-mex-green animate-pulse" : "bg-mex-red")} />
                            {u.active ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-bold text-stone-500 bg-stone-50 px-3 py-1 rounded-lg border border-stone-100">
                            {u.pin || '0000'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenEditModal(u)}
                              className="text-stone-300 hover:text-mex-green h-9 w-9 rounded-xl transition-colors cursor-pointer"
                            >
                              <Edit2 size={16} />
                            </Button>
                            {u.role !== 'admin' && u.email !== SUPER_ADMIN_EMAIL && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setConfirmAction({
                                    title: "Eliminar Usuario",
                                    message: `¿Estás seguro de eliminar a ${u.name}? Esta acción no se puede deshacer.`,
                                    action: async () => {
                                      await deleteDoc(doc(db, "users", u.id));
                                      toast.success("Usuario eliminado");
                                      fetchUsers();
                                      setShowConfirmModal(false);
                                    }
                                  });
                                  setShowConfirmModal(true);
                                }}
                                className="text-stone-300 hover:text-mex-red h-9 w-9 rounded-xl transition-colors cursor-pointer"
                              >
                                <Trash2 size={16} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-none shadow-xl shadow-stone-200/50 rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="bg-white border-b border-stone-50 p-6">
                <div className="flex items-center gap-3 text-stone-700">
                  <div className="p-2 bg-stone-100 rounded-xl">
                    <ShieldAlert size={20} />
                  </div>
                  <h2 className="font-black text-stone-800 uppercase tracking-tighter">Sistema</h2>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-4">
                  <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                    <p className="text-[8px] font-black text-orange-400 uppercase tracking-widest mb-2">Seguridad</p>
                    <Button 
                      variant="primary" 
                      className="w-full h-10 rounded-xl text-[10px] font-black uppercase bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20 cursor-pointer"
                      onClick={handleRepairPermissions}
                      disabled={loading}
                    >
                      Reparar Permisos
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* BRANDING PANEL */}
      {activeAdminTab === 'branding' && (
        <Card className="border-none shadow-lg shadow-stone-200/50 rounded-[2.5rem] overflow-hidden bg-white p-8 animate-in fade-in zoom-in-95 duration-400">
          <div className="mb-6 flex items-center gap-3">
            <div className="p-2 bg-mex-gold/10 text-mex-gold rounded-xl">
              <ImageIcon size={20} />
            </div>
            <h2 className="text-xl font-serif text-stone-800">Identidad de la Marca</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-mex-gold shadow-xl bg-mex-cream flex items-center justify-center relative group">
                {(logoPreview || (brandingSettings.logoUrl && (brandingSettings.logoUrl.startsWith('data:image/') || brandingSettings.logoUrl.includes('logo_las_cazuelas_del_castor'))) || "/logo_las_cazuelas_del_castor.jpg") ? (
                  <img src={logoPreview || (brandingSettings.logoUrl && (brandingSettings.logoUrl.startsWith('data:image/') || brandingSettings.logoUrl.includes('logo_las_cazuelas_del_castor')) ? brandingSettings.logoUrl : "/logo_las_cazuelas_del_castor.jpg")} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={48} className="text-stone-300" />
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <Upload size={24} className="text-white" />
                </label>
              </div>
              <p className="text-[10px] font-black uppercase text-stone-400">Click para subir logo</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Nombre del Sistema</label>
                <input
                  type="text"
                  value={brandingSettings.appName}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, appName: e.target.value })}
                  className="w-full bg-stone-50 border-stone-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-mex-gold/20"
                  placeholder="Ej. Las Cazuelas del Castor"
                />
              </div>
              <Button 
                variant="primary" 
                className="w-full h-12 bg-mex-brown hover:bg-mex-brown/90 rounded-xl font-black uppercase tracking-widest text-[10px] cursor-pointer"
                onClick={saveBranding}
              >
                Guardar Cambios
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* BACKUP PANEL */}
      {activeAdminTab === 'backup' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-400">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mex-terracotta/10 text-mex-terracotta rounded-xl">
              <Database size={20} />
            </div>
            <h2 className="text-xl font-serif text-stone-800">Sistema y Respaldo de Datos</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-none shadow-md rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex gap-4 items-center">
                  <div className="p-3 bg-stone-100 text-stone-500 rounded-2xl">
                    <Download size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-800">Exportar Datos</h3>
                    <p className="text-xs text-stone-400">Descarga un respaldo completo (JSON)</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  className="h-10 px-4 rounded-xl font-black uppercase tracking-widest text-[10px] bg-stone-50 hover:bg-stone-100 cursor-pointer"
                  onClick={handleExportData}
                >
                  Exportar
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex gap-4 items-center">
                  <div className="p-3 bg-stone-100 text-stone-500 rounded-2xl">
                    <Upload size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-800">Importar Datos</h3>
                    <p className="text-xs text-stone-400">Restaura datos desde un archivo</p>
                  </div>
                </div>
                <label className="cursor-pointer">
                  <input type="file" accept=".json" className="hidden" onChange={handleImportData} />
                  <div className="h-10 px-4 flex items-center justify-center rounded-xl font-black uppercase tracking-widest text-[10px] bg-stone-50 hover:bg-stone-100 text-stone-700 transition-colors">
                    Importar
                  </div>
                </label>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Info Card - Original position, but updated content */}
      <div className="bg-white/40 border border-stone-150 rounded-[2.5rem] p-6 flex flex-col items-center text-center backdrop-blur-sm shrink-0 mb-8 mt-4">
        <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Fin de Administración e Reportes</p>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl border-none overflow-hidden animate-in fade-in zoom-in-95">
            <CardHeader className="bg-mex-red text-white p-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle size={24} />
                <h3 className="text-xl font-serif">Confirmar</h3>
              </div>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <p className="text-stone-700 font-bold leading-relaxed">{confirmAction.message}</p>
              
              {confirmAction.requireVerification && confirmAction.verificationPhrase && (
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-black uppercase text-stone-500 tracking-wider">
                    Escribe <span className="text-mex-red font-black underline">"{confirmAction.verificationPhrase}"</span> para verificar y proceder:
                  </label>
                  <input
                    type="text"
                    value={verificationInput}
                    onChange={(e) => setVerificationInput(e.target.value)}
                    placeholder={`Escribe ${confirmAction.verificationPhrase}`}
                    className="w-full text-center tracking-widest uppercase font-black px-4 py-3 border-2 border-stone-200 focus:border-mex-red focus:outline-none rounded-xl text-stone-800 text-sm"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 p-3 bg-red-50 text-mex-red rounded-xl border border-red-100">
                <ShieldAlert size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Atención: Irreversible</span>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3 p-6 bg-stone-50">
              <Button 
                variant="ghost" 
                className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]" 
                onClick={() => setShowConfirmModal(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 h-12 rounded-2xl bg-mex-red hover:bg-red-700 shadow-xl shadow-mex-red/20 font-black uppercase tracking-widest text-[10px] disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={confirmAction.action}
                disabled={loading || (confirmAction.requireVerification && verificationInput.trim().toUpperCase() !== confirmAction.verificationPhrase?.toUpperCase())}
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <span>Confirmar</span>}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* User Modal (Add/Edit) */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-md rounded-[2.5rem] shadow-2xl border-none overflow-hidden my-auto animate-in fade-in zoom-in-95">
            <CardHeader className="bg-mex-green text-white p-8 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-2xl font-serif leading-tight">
                  {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h3>
                <p className="text-[10px] text-mex-gold font-bold uppercase tracking-widest mt-1">Acceso al Sistema</p>
              </div>
              <button 
                onClick={() => setShowUserModal(false)}
                className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Nombre Completo</label>
                    <input 
                      type="text" 
                      value={userForm.name}
                      onChange={e => setUserForm({...userForm, name: e.target.value})}
                      className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-green focus:ring-0 outline-none transition-all font-bold"
                      placeholder="Ej. Juan Pérez"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Rol</label>
                    <select 
                      value={userForm.role}
                      onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}
                      disabled={isEditing && userForm.email === SUPER_ADMIN_EMAIL}
                      className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-green focus:ring-0 outline-none transition-all font-bold cursor-pointer appearance-none disabled:opacity-50"
                    >
                      <option value="waiter">Mesero</option>
                      <option value="kitchen">Cocina</option>
                      <option value="parrilla">Parrilla</option>
                      <option value="cashier">Cajero</option>
                      <option value="admin">Administrador (Google)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">PIN (4 Dígitos)</label>
                    <input 
                      type="text" 
                      maxLength={4}
                      value={userForm.pin}
                      onChange={e => setUserForm({...userForm, pin: e.target.value.replace(/\D/g, '')})}
                      className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-green focus:ring-0 outline-none font-mono font-bold text-center text-lg tracking-widest"
                      placeholder="0000"
                    />
                  </div>

                  {userForm.role === 'admin' ? (
                    <div className="space-y-1.5 col-span-2">
                       <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Correo de Google</label>
                       <input 
                         type="email" 
                         value={userForm.email}
                         onChange={e => setUserForm({...userForm, email: e.target.value.toLowerCase()})}
                         disabled={isEditing && userForm.email === SUPER_ADMIN_EMAIL}
                         className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-green focus:ring-0 outline-none transition-all font-bold disabled:opacity-50"
                         placeholder="nombre@gmail.com"
                       />
                       <p className="text-[9px] text-stone-400 mt-1 px-1">Los administradores deben iniciar sesión mediante su cuenta de Google.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Cta. de Usuario</label>
                        <input 
                          type="text" 
                          value={userForm.username}
                          onChange={e => setUserForm({...userForm, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                          className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-green focus:ring-0 outline-none transition-all font-bold"
                          placeholder="juanp"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Contraseña</label>
                        <input 
                          type="password" 
                          value={userForm.password}
                          onChange={e => setUserForm({...userForm, password: e.target.value})}
                          className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-green focus:ring-0 outline-none transition-all font-bold"
                          placeholder={isEditing ? "(Sin cambios)" : "****"}
                        />
                      </div>
                    </>
                  )}
                </div>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={cn(
                    "w-10 h-6 rounded-full relative transition-all shadow-inner",
                    userForm.active ? "bg-mex-green" : "bg-stone-200"
                  )}>
                    <input 
                      type="checkbox" 
                      className="sr-only"
                      checked={userForm.active}
                      disabled={isEditing && userForm.email === SUPER_ADMIN_EMAIL}
                      onChange={e => setUserForm({...userForm, active: e.target.checked})}
                    />
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all",
                      userForm.active ? "translate-x-5" : "translate-x-1",
                      isEditing && userForm.email === SUPER_ADMIN_EMAIL && "opacity-50"
                    )} />
                  </div>
                  <span className="text-xs font-black text-stone-600 uppercase tracking-tighter">
                    {userForm.email === SUPER_ADMIN_EMAIL ? "Administrador Principal (Siempre Activo)" : "Usuario Activo"}
                  </span>
                </label>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3 p-8 bg-stone-50">
              <Button 
                variant="ghost" 
                className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]" 
                onClick={() => setShowUserModal(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-[2] h-12 rounded-2xl bg-mex-green hover:bg-mex-green/90 shadow-xl shadow-mex-green/20 font-black uppercase tracking-widest text-[10px]" 
                onClick={handleSaveUser}
                disabled={loading}
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <span>{isEditing ? "Guardar Cambios" : "Crear Usuario"}</span>}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
