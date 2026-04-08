import { useState } from "react";
import { Trash2, AlertTriangle, Database, RefreshCw, ShieldAlert, X, CheckCircle2 } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc, writeBatch } from "firebase/firestore";
import toast from "react-hot-toast";
import { seedDatabase } from "../seed";
import { handleFirestoreError, OperationType } from "../lib/firestoreErrorHandler";

export const AdminView = () => {
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
  } | null>(null);

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
    </div>
  );
};
