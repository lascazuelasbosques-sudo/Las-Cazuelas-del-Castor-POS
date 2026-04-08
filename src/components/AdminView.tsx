import { useState, useEffect } from "react";
import { Trash2, AlertTriangle, Database, RefreshCw, ShieldAlert, X, CheckCircle2, Users, Key, Edit2, Save } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc, writeBatch, updateDoc, addDoc, getDoc, setDoc } from "firebase/firestore";
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
      title: "Reiniciar Sistema Completo",
      message: "¿ESTÁS COMPLETAMENTE SEGURO? Esto borrará TODOS los pedidos, registros de caja, productos y categorías. No se puede deshacer.",
      action: async () => {
        setLoading(true);
        try {
          const collections = ["orders", "cashLogs", "products", "categories"];
          for (const name of collections) {
            const snapshot = await getDocs(collection(db, name));
            const batch = writeBatch(db);
            snapshot.docs.forEach((d) => {
              batch.delete(doc(db, name, d.id));
            });
            if (snapshot.size > 0) {
              await batch.commit();
            }
          }
          await seedDatabase(true);
          toast.success("Sistema reiniciado completamente");
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
      title: "Limpiar Caja y Pedidos",
      message: "¿Borrar todos los pedidos y registros de caja? El menú (productos) se mantendrá.",
      action: async () => {
        setLoading(true);
        try {
          const collections = ["orders", "cashLogs"];
          for (const name of collections) {
            const snapshot = await getDocs(collection(db, name));
            const batch = writeBatch(db);
            snapshot.docs.forEach((d) => {
              batch.delete(doc(db, name, d.id));
            });
            if (snapshot.size > 0) {
              await batch.commit();
            }
          }
          toast.success("Pedidos y caja limpiados");
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
    <div className="p-6 h-full overflow-y-auto flex flex-col gap-8 bg-mex-cream">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-mex-brown text-white rounded-2xl shadow-lg">
          <Database size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-serif text-mex-brown">Panel de Administración</h1>
          <p className="text-stone-500">Mantenimiento y configuración del sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="md:col-span-2 border-mex-green/20">
          <CardHeader className="bg-mex-green/5 border-b border-mex-green/10 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 text-mex-green">
              <Users size={20} />
              <h2 className="font-bold uppercase tracking-wider">Gestión de Usuarios</h2>
            </div>
            <Button 
              variant="primary" 
              size="sm" 
              className="bg-mex-green hover:bg-mex-green/90 gap-2"
              onClick={handleOpenAddModal}
            >
              <Users size={16} />
              Nuevo Usuario
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-stone-100 text-xs text-stone-400 uppercase tracking-widest">
                    <th className="pb-3 font-bold">Nombre / Usuario</th>
                    <th className="pb-3 font-bold">Rol</th>
                    <th className="pb-3 font-bold">Estado</th>
                    <th className="pb-3 font-bold">PIN</th>
                    <th className="pb-3 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {users.map(u => (
                    <tr key={u.id} className="group hover:bg-stone-50/50 transition-colors">
                      <td className="py-4">
                        <p className="font-bold text-stone-800">{u.name}</p>
                        <p className="text-xs text-stone-400">@{u.username || 'sin_usuario'}</p>
                      </td>
                      <td className="py-4">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                          u.role === 'admin' ? "bg-mex-brown text-white" : "bg-stone-100 text-stone-600"
                        )}>
                          {getRoleLabel(u.role)}
                        </span>
                      </td>
                      <td className="py-4">
                        <button 
                          onClick={() => toggleUserStatus(u)}
                          className={cn(
                            "flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-1 rounded-lg transition-all",
                            u.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"
                          )}
                        >
                          <div className={cn("w-1.5 h-1.5 rounded-full", u.active ? "bg-green-600" : "bg-red-600")} />
                          {u.active ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="py-4">
                        <span className="font-mono text-sm text-stone-500 bg-stone-100 px-2 py-1 rounded">
                          {u.pin || '0000'}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleOpenEditModal(u)}
                            className="text-stone-400 hover:text-mex-green"
                          >
                            <Edit2 size={16} />
                          </Button>
                          {u.role !== 'admin' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
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
                              className="text-stone-400 hover:text-mex-red"
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

        <Card className="border-mex-terracotta/20">
          <CardHeader className="bg-mex-terracotta/5 border-b border-mex-terracotta/10">
            <div className="flex items-center gap-2 text-mex-terracotta">
              <Trash2 size={20} />
              <h2 className="font-bold uppercase tracking-wider">Limpieza de Datos</h2>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-stone-600">
              Utiliza estas opciones para limpiar el historial de ventas al finalizar el día o para corregir errores masivos.
            </p>
            
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 border-stone-200 hover:bg-mex-red/5 hover:text-mex-red hover:border-mex-red/30"
                onClick={handleClearTransactions}
                disabled={loading}
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                Limpiar Caja y Pedidos (Cierre de Día)
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 border-stone-200 hover:bg-mex-red/5 hover:text-mex-red hover:border-mex-red/30"
                onClick={() => clearCollection("cashLogs")}
                disabled={loading}
              >
                <Trash2 size={18} />
                Solo Borrar Historial de Caja
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 border-stone-200 hover:bg-mex-red/5 hover:text-mex-red hover:border-mex-red/30"
                onClick={() => clearCollection("orders")}
                disabled={loading}
              >
                <Trash2 size={18} />
                Solo Borrar Pedidos
              </Button>
              
              <p className="text-[10px] text-stone-400 italic">
                * Esto borrará todas las comandas y el historial de ingresos/egresos de hoy.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200">
          <CardHeader className="bg-stone-50 border-b border-stone-100">
            <div className="flex items-center gap-2 text-stone-700">
              <ShieldAlert size={20} />
              <h2 className="font-bold uppercase tracking-wider">Mantenimiento de Sistema</h2>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-xs font-bold text-amber-800 uppercase mb-1">Permisos de Admin</p>
                <p className="text-[10px] text-amber-600 mb-2">Restaura tu rol de administrador si pierdes acceso.</p>
                <Button 
                  variant="outline" 
                  className="w-full h-9 text-xs gap-2 border-amber-200 text-amber-700 hover:bg-amber-100"
                  onClick={handleRepairPermissions}
                  disabled={loading}
                >
                  <RefreshCw size={14} />
                  Reparar Mis Permisos
                </Button>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-bold text-blue-800 uppercase mb-1">Sincronizar Usuarios</p>
                <p className="text-[10px] text-blue-600 mb-2">Asegura que todos tengan usuario y contraseña (defecto: 1234).</p>
                <Button 
                  variant="outline" 
                  className="w-full h-9 text-xs gap-2 border-blue-200 text-blue-700 hover:bg-blue-100"
                  onClick={async () => {
                    const toastId = toast.loading("Sincronizando...");
                    try {
                      const snap = await getDocs(collection(db, "users"));
                      const batch = writeBatch(db);
                      let count = 0;
                      snap.forEach(uDoc => {
                        const data = uDoc.data();
                        const updates: any = {};
                        let changed = false;
                        if (!data.username) { updates.username = data.name.toLowerCase().replace(/\s/g, ''); changed = true; }
                        if (!data.password) { updates.password = "1234"; changed = true; }
                        if (data.active === undefined) { updates.active = true; changed = true; }
                        if (changed) { batch.update(uDoc.ref, updates); count++; }
                      });
                      await batch.commit();
                      toast.success(`${count} usuarios actualizados`, { id: toastId });
                      fetchUsers();
                    } catch (e) { toast.error("Error al sincronizar", { id: toastId }); }
                  }}
                  disabled={loading}
                >
                  <Users size={14} />
                  Sincronizar Credenciales
                </Button>
              </div>

              <div className="pt-2">
                <Button 
                  variant="ghost" 
                  className="w-full h-9 text-xs gap-2 text-mex-red hover:bg-red-50"
                  onClick={handleResetSystem}
                  disabled={loading}
                >
                  <AlertTriangle size={14} />
                  Reiniciar Sistema
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/50 border-dashed border-2 border-stone-200">
        <CardContent className="p-12 flex flex-col items-center justify-center text-center opacity-40">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
            <Database size={32} />
          </div>
          <h3 className="text-xl font-serif mb-2">Más funciones próximamente</h3>
          <p className="max-w-md">
            Reportes de ventas por mesero, gráficas de rendimiento, gestión de usuarios y roles, y configuración de tickets.
          </p>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4">
          <Card className="w-full max-w-md border-mex-red/30 shadow-2xl">
            <CardHeader className="bg-mex-red text-white flex flex-row items-center justify-between">
              <h3 className="text-xl font-serif flex items-center gap-2">
                <AlertTriangle size={20} />
                {confirmAction.title}
              </h3>
              <button onClick={() => setShowConfirmModal(false)}><X size={24}/></button>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-stone-700 font-medium">{confirmAction.message}</p>
              <p className="text-xs text-mex-red mt-4 font-bold uppercase tracking-widest">Esta acción es irreversible</p>
            </CardContent>
            <CardFooter className="flex gap-2 p-4 bg-stone-50">
              <Button variant="ghost" className="flex-1" onClick={() => setShowConfirmModal(false)}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 gap-2 bg-mex-red hover:bg-red-700" 
                onClick={confirmAction.action}
                disabled={loading}
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                Confirmar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* User Modal (Add/Edit) */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="bg-mex-green text-white flex flex-row items-center justify-between">
              <h3 className="text-xl font-serif flex items-center gap-2">
                <Users size={20} />
                {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button onClick={() => setShowUserModal(false)}><X size={24}/></button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-stone-500 uppercase">Nombre Completo</label>
                  <input 
                    type="text" 
                    value={userForm.name}
                    onChange={e => setUserForm({...userForm, name: e.target.value})}
                    className="w-full px-3 py-2 rounded border border-stone-200 focus:ring-2 focus:ring-mex-green/20 outline-none"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase">Usuario</label>
                  <input 
                    type="text" 
                    value={userForm.username}
                    onChange={e => setUserForm({...userForm, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                    className="w-full px-3 py-2 rounded border border-stone-200 focus:ring-2 focus:ring-mex-green/20 outline-none"
                    placeholder="Ej. juanp"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase">Rol</label>
                  <select 
                    value={userForm.role}
                    onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}
                    className="w-full px-3 py-2 rounded border border-stone-200 focus:ring-2 focus:ring-mex-green/20 outline-none bg-white"
                  >
                    <option value="waiter">Mesero</option>
                    <option value="kitchen">Cocina</option>
                    <option value="cashier">Cajero</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase">Contraseña</label>
                  <input 
                    type="text" 
                    value={userForm.password}
                    onChange={e => setUserForm({...userForm, password: e.target.value})}
                    className="w-full px-3 py-2 rounded border border-stone-200 focus:ring-2 focus:ring-mex-green/20 outline-none"
                    placeholder={isEditing ? "Dejar vacío para no cambiar" : "Mínimo 4 caracteres"}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase">PIN de Acceso</label>
                  <input 
                    type="text" 
                    maxLength={4}
                    value={userForm.pin}
                    onChange={e => setUserForm({...userForm, pin: e.target.value.replace(/\D/g, '')})}
                    className="w-full px-3 py-2 rounded border border-stone-200 focus:ring-2 focus:ring-mex-green/20 outline-none font-mono"
                    placeholder="0000"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="user-active"
                  checked={userForm.active}
                  onChange={e => setUserForm({...userForm, active: e.target.checked})}
                  className="w-4 h-4 text-mex-green rounded border-stone-300 focus:ring-mex-green"
                />
                <label htmlFor="user-active" className="text-sm font-medium text-stone-700 cursor-pointer">
                  Usuario Activo (Permitir acceso)
                </label>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 p-4 bg-stone-50">
              <Button variant="ghost" className="flex-1" onClick={() => setShowUserModal(false)}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 bg-mex-green hover:bg-mex-green/90" 
                onClick={handleSaveUser}
                disabled={loading}
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : (isEditing ? "Guardar Cambios" : "Crear Usuario")}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
