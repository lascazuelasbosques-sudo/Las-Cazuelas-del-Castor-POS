import { useState, useEffect } from "react";
import { Trash2, AlertTriangle, Database, RefreshCw, ShieldAlert, X, CheckCircle2, Users, Key, Edit2, Save, Plus } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc, writeBatch, updateDoc, addDoc, getDoc, setDoc, getDocsFromServer } from "firebase/firestore";
import toast from "react-hot-toast";
import { seedDatabase } from "../seed";
import { handleFirestoreError, OperationType } from "../lib/firestoreErrorHandler";
import { User, UserRole } from "../types";
import { cn, getRoleLabel } from "@/src/lib/utils";
import { auth } from "../firebase";

export const AdminView = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    name: "",
    username: "",
    password: "",
    pin: "0000",
    role: "waiter" as UserRole,
    active: true
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
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
      pin: "0000",
      role: "waiter",
      active: true
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
      pin: user.pin || "0000",
      role: user.role,
      active: user.active
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.name || !userForm.username || (!isEditing && !userForm.password)) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }

    const usernameLower = userForm.username.toLowerCase().trim();
    
    // Check for duplicate username (excluding current user if editing)
    const isDuplicate = users.some(u => u.username?.toLowerCase() === usernameLower && u.id !== selectedUserId);
    if (isDuplicate) {
      toast.error("El nombre de usuario ya existe");
      return;
    }
    
    const toastId = toast.loading(isEditing ? "Actualizando usuario..." : "Creando usuario...");
    setLoading(true);
    try {
      // Ensure admin permissions
      if (auth.currentUser) {
        const adminDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (!adminDoc.exists() || adminDoc.data().role !== 'admin') {
          await setDoc(doc(db, "users", auth.currentUser.uid), { role: 'admin', active: true }, { merge: true });
        }
      }

      const userData = {
        ...userForm,
        username: usernameLower,
        updatedAt: new Date().toISOString()
      };

      if (isEditing && selectedUserId) {
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

  const toggleUserStatus = async (user: User) => {
    if (user.id === auth.currentUser?.uid) {
      toast.error("No puedes desactivar tu propia cuenta");
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

  const clearCollection = async (collectionName: string) => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((d) => {
        batch.delete(doc(db, collectionName, d.id));
      });
      
      await batch.commit();
      toast.success(`Colección ${collectionName} limpiada`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, collectionName);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSystem = async () => {
    setConfirmAction({
      title: "Reinicio de Fábrica",
      message: "¿ESTÁS COMPLETAMENTE SEGURO? Esto borrará TODOS los pedidos, registros de caja, productos y categorías. No se puede deshacer.",
      action: async () => {
        setLoading(true);
        try {
          const collections = ["orders", "cashLogs", "products", "categories", "counters"];
          for (const name of collections) {
            const snapshot = await getDocsFromServer(collection(db, name));
            if (snapshot.empty) continue;

            // Chunk deletions in batches of 500 (Firestore limit)
            const docs = snapshot.docs;
            for (let i = 0; i < docs.length; i += 500) {
              const batch = writeBatch(db);
              const chunk = docs.slice(i, i + 500);
              chunk.forEach((d) => {
                batch.delete(doc(db, name, d.id));
              });
              await batch.commit();
            }
          }
          await seedDatabase(true);
          toast.success("Sistema reiniciado: Pedidos, Caja, Productos y Categorías borrados.");
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, "reset-system");
        } finally {
          setLoading(false);
          setShowConfirmModal(false);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleClearTransactions = async () => {
    setConfirmAction({
      title: "Reinicio Operacional",
      message: "¿Borrar todos los pedidos y registros de caja? El menú (productos) y usuarios se mantendrán.",
      action: async () => {
        setLoading(true);
        try {
          const collections = ["orders", "cashLogs", "counters"];
          for (const name of collections) {
            const snapshot = await getDocsFromServer(collection(db, name));
            if (snapshot.empty) continue;

            // Chunk deletions in batches of 500 (Firestore limit)
            const docs = snapshot.docs;
            for (let i = 0; i < docs.length; i += 500) {
              const batch = writeBatch(db);
              const chunk = docs.slice(i, i + 500);
              chunk.forEach((d) => {
                batch.delete(doc(db, name, d.id));
              });
              await batch.commit();
            }
          }
          toast.success("Limpieza completada: Pedidos y Caja borrados.");
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, "clear-transactions");
        } finally {
          setLoading(false);
          setShowConfirmModal(false);
        }
      }
    });
    setShowConfirmModal(true);
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto flex flex-col gap-6 md:gap-8 bg-mex-cream no-scrollbar">
      <div className="flex items-center gap-4 shrink-0">
        <div className="p-4 bg-mex-brown text-white rounded-[1.5rem] shadow-xl shadow-mex-brown/20 flex flex-col items-center">
          <Database size={32} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-mex-brown">Administración</h1>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">Configuración y Seguridad</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="md:col-span-2 lg:col-span-2 border-none shadow-xl shadow-stone-200/50 rounded-[2rem] overflow-hidden">
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
              className="bg-mex-green hover:bg-mex-green/90 gap-2 h-10 px-4 rounded-xl shadow-lg shadow-mex-green/10"
              onClick={handleOpenAddModal}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nuevo Usuario</span>
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
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-800 text-sm">{u.name}</h3>
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
                        "w-3 h-3 rounded-full shadow-sm",
                        u.active ? "bg-mex-green shadow-mex-green/20" : "bg-stone-200"
                      )}
                    />
                    <button 
                      onClick={() => handleOpenEditModal(u)}
                      className="p-2 text-stone-300 hover:text-mex-green"
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
                            "flex items-center gap-2 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all",
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
                            className="text-stone-300 hover:text-mex-green h-9 w-9 rounded-xl transition-colors"
                          >
                            <Edit2 size={16} />
                          </Button>
                          {u.role !== 'admin' && (
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
                              className="text-stone-300 hover:text-mex-red h-9 w-9 rounded-xl transition-colors"
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
          <Card className="border-none shadow-xl shadow-stone-200/50 rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-white border-b border-stone-50 p-6">
              <div className="flex items-center gap-3 text-mex-terracotta">
                <div className="p-2 bg-mex-terracotta/10 rounded-xl">
                  <Trash2 size={20} />
                </div>
                <h2 className="font-black text-stone-800 uppercase tracking-tighter">Limpieza</h2>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-relaxed">
                Utiliza estas opciones para limpiar el historial al finalizar el día.
              </p>
              
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full h-14 justify-start gap-3 rounded-2xl border-none bg-stone-50 hover:bg-mex-red/5 hover:text-mex-red transition-all group font-bold text-xs"
                  onClick={handleClearTransactions}
                  disabled={loading}
                >
                  <RefreshCw size={18} className={cn("text-stone-400 group-hover:text-mex-red", loading ? "animate-spin" : "")} />
                  <span>Cierre de Día Completo</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full h-14 justify-start gap-3 rounded-2xl border-none bg-stone-50 hover:bg-mex-red/5 transition-all group font-bold text-xs"
                  onClick={() => clearCollection("cashLogs")}
                  disabled={loading}
                >
                  <Key size={18} className="text-stone-400 group-hover:text-mex-red" />
                  <span>Borrar Historial de Caja</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl shadow-stone-200/50 rounded-[2rem] overflow-hidden">
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
                    className="w-full h-10 rounded-xl text-[10px] font-black uppercase bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20"
                    onClick={handleRepairPermissions}
                    disabled={loading}
                  >
                    Reparar Permisos
                  </Button>
                </div>

                <Button 
                  variant="ghost" 
                  className="w-full h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest text-mex-red hover:bg-red-50 hover:text-red-700 transition-all border border-transparent hover:border-red-100"
                  onClick={handleResetSystem}
                  disabled={loading}
                >
                  <AlertTriangle size={18} className="mr-2" />
                  Reinicio de Fábrica
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white/40 border border-stone-100 rounded-[2.5rem] p-8 md:p-12 flex flex-col items-center text-center backdrop-blur-sm shrink-0">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-xl shadow-stone-200/30 flex items-center justify-center mb-6 text-stone-300">
          <Database size={32} />
        </div>
        <h3 className="text-xl font-serif text-stone-800 mb-2">Módulo de Reportes Avanzados</h3>
        <p className="max-w-md text-stone-500 text-sm leading-relaxed">
          Las gráficas de rendimiento y estadísticas detalladas por mesero estarán disponibles en la próxima actualización.
        </p>
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
            <CardContent className="p-8">
              <p className="text-stone-700 font-bold leading-relaxed">{confirmAction.message}</p>
              <div className="mt-6 flex items-center gap-2 p-3 bg-red-50 text-mex-red rounded-xl border border-red-100">
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
                className="flex-1 h-12 rounded-2xl bg-mex-red hover:bg-red-700 shadow-xl shadow-mex-red/20 font-black uppercase tracking-widest text-[10px]" 
                onClick={confirmAction.action}
                disabled={loading}
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
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Usuario</label>
                  <input 
                    type="text" 
                    value={userForm.username}
                    onChange={e => setUserForm({...userForm, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                    className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-green focus:ring-0 outline-none transition-all font-bold"
                    placeholder="juanp"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Rol</label>
                  <select 
                    value={userForm.role}
                    onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}
                    className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-green focus:ring-0 outline-none transition-all font-bold cursor-pointer appearance-none"
                  >
                    <option value="waiter">Mesero</option>
                    <option value="kitchen">Cocina</option>
                    <option value="cashier">Cajero</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Contraseña</label>
                  <input 
                    type="password" 
                    value={userForm.password}
                    onChange={e => setUserForm({...userForm, password: e.target.value})}
                    className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-green focus:ring-0 outline-none transition-all font-bold"
                    placeholder={isEditing ? "****" : "****"}
                  />
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
                      onChange={e => setUserForm({...userForm, active: e.target.checked})}
                    />
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all",
                      userForm.active ? "translate-x-5" : "translate-x-1"
                    )} />
                  </div>
                  <span className="text-xs font-black text-stone-600 uppercase tracking-tighter">Usuario Activo</span>
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
