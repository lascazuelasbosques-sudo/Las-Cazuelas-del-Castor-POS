import { useState, useEffect } from "react";
import { Trash2, AlertTriangle, Database, RefreshCw, ShieldAlert, X, CheckCircle2, Users, Key, Edit2, Save } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc, writeBatch, updateDoc, addDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { seedDatabase } from "../seed";
import { handleFirestoreError, OperationType } from "../lib/firestoreErrorHandler";
import { User, UserRole } from "../types";
import { cn } from "@/src/lib/utils";

export const AdminView = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newPin, setNewPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    password: "",
    role: "waiter" as UserRole
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
    }
  };

  const handleUpdateUser = async (userId: string) => {
    if (newPassword && newPassword.length < 4) {
      toast.error("La contraseña debe tener al menos 4 caracteres");
      return;
    }
    setLoading(true);
    try {
      const updates: any = {};
      if (newPassword) updates.password = newPassword;
      if (newPin) updates.pin = newPin;
      
      await updateDoc(doc(db, "users", userId), updates);
      toast.success("Usuario actualizado");
      setEditingUser(null);
      setNewPassword("");
      setNewPin("");
      fetchUsers();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "users");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.username || !newUser.password) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }
    
    const toastId = toast.loading("Creando usuario...");
    setLoading(true);
    try {
      await addDoc(collection(db, "users"), {
        ...newUser,
        pin: "0000", // Default PIN for new users
        active: true,
        createdAt: new Date().toISOString()
      });
      toast.success("Usuario creado exitosamente", { id: toastId });
      setShowAddUserModal(false);
      setNewUser({ name: "", username: "", password: "", role: "waiter" });
      fetchUsers();
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error("Error al crear usuario. Verifica tus permisos.", { id: toastId });
      handleFirestoreError(error, OperationType.CREATE, "users");
    } finally {
      setLoading(false);
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
              onClick={() => setShowAddUserModal(true)}
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
                    <th className="pb-3 font-bold">Contraseña / PIN</th>
                    <th className="pb-3 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {users.map(u => (
                    <tr key={u.id} className="group">
                      <td className="py-4">
                        <p className="font-bold text-stone-800">{u.name}</p>
                        <p className="text-xs text-stone-400">@{u.username || 'sin_usuario'}</p>
                      </td>
                      <td className="py-4">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                          u.role === 'admin' ? "bg-mex-brown text-white" : "bg-stone-100 text-stone-600"
                        )}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4">
                        {editingUser?.id === u.id ? (
                          <div className="flex flex-col gap-2">
                            <input 
                              type="text" 
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              placeholder="Nueva Contraseña"
                              className="w-32 px-2 py-1 text-xs rounded border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20"
                            />
                            <input 
                              type="text" 
                              maxLength={4}
                              value={newPin}
                              onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                              placeholder="Nuevo PIN (4 dig)"
                              className="w-32 px-2 py-1 text-xs rounded border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20"
                            />
                          </div>
                        ) : (
                          <div className="text-xs text-stone-500">
                            <p>Pass: {u.password ? '****' : <span className="text-mex-red">No establecida</span>}</p>
                            <p>PIN: {u.pin || '1234'}</p>
                          </div>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        {editingUser?.id === u.id ? (
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => { setEditingUser(null); setNewPassword(""); setNewPin(""); }}
                              className="text-stone-400"
                            >
                              <X size={16} />
                            </Button>
                            <Button 
                              variant="primary" 
                              size="sm" 
                              onClick={() => handleUpdateUser(u.id)}
                              disabled={loading}
                              className="bg-mex-green hover:bg-mex-green/90"
                            >
                              <Save size={16} />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => { setEditingUser(u); setNewPassword(u.password || ""); setNewPin(u.pin || ""); }}
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
                                    message: `¿Estás seguro de eliminar a ${u.name}?`,
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
                        )}
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

        <Card className="border-mex-red/20">
          <CardHeader className="bg-mex-red/5 border-b border-mex-red/10">
            <div className="flex items-center gap-2 text-mex-red">
              <ShieldAlert size={20} />
              <h2 className="font-bold uppercase tracking-wider">Zona de Peligro</h2>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-stone-600">
              Estas acciones son irreversibles. Úsalas solo si deseas configurar el sistema desde cero.
            </p>
            
            <Button 
              variant="primary" 
              className="w-full gap-3 bg-mex-red hover:bg-red-700"
              onClick={handleResetSystem}
              disabled={loading}
            >
              <AlertTriangle size={18} />
              Reiniciar Sistema Completo
            </Button>
            
            <p className="text-[10px] text-mex-red font-bold">
              ATENCIÓN: Se borrarán productos, categorías y todas las ventas.
            </p>
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

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="bg-mex-green text-white flex flex-row items-center justify-between">
              <h3 className="text-xl font-serif flex items-center gap-2">
                <Users size={20} />
                Nuevo Usuario
              </h3>
              <button onClick={() => setShowAddUserModal(false)}><X size={24}/></button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase">Nombre Completo</label>
                <input 
                  type="text" 
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full px-3 py-2 rounded border border-stone-200 focus:ring-2 focus:ring-mex-green/20 outline-none"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase">Nombre de Usuario</label>
                <input 
                  type="text" 
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                  className="w-full px-3 py-2 rounded border border-stone-200 focus:ring-2 focus:ring-mex-green/20 outline-none"
                  placeholder="Ej. juanp"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase">Contraseña</label>
                <input 
                  type="text" 
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  className="w-full px-3 py-2 rounded border border-stone-200 focus:ring-2 focus:ring-mex-green/20 outline-none"
                  placeholder="Mínimo 4 caracteres"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase">Rol</label>
                <select 
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                  className="w-full px-3 py-2 rounded border border-stone-200 focus:ring-2 focus:ring-mex-green/20 outline-none bg-white"
                >
                  <option value="waiter">Mesero</option>
                  <option value="kitchen">Cocina / Plancha</option>
                  <option value="cashier">Cajero</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 p-4 bg-stone-50">
              <Button variant="ghost" className="flex-1" onClick={() => setShowAddUserModal(false)}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 bg-mex-green hover:bg-mex-green/90" 
                onClick={handleAddUser}
                disabled={loading}
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : "Crear Usuario"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
