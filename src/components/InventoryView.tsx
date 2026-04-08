import { useState, useEffect, FormEvent } from "react";
import { Package, Plus, Search, Edit2, Trash2, AlertTriangle, X, Save, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { formatCurrency, cn } from "@/src/lib/utils";
import { Product, Category } from "@/src/types";
import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, addDoc, updateDoc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firestoreErrorHandler";
import toast from "react-hot-toast";

export const InventoryView = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    const unsubProd = onSnapshot(query(collection(db, "products"), orderBy("name", "asc")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    });

    const unsubCat = onSnapshot(query(collection(db, "categories"), orderBy("order", "asc")), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    });

    return () => {
      unsubProd();
      unsubCat();
    };
  }, []);

  const handleDeleteProduct = async (id: string) => {
    setConfirmAction({
      title: "Eliminar Producto",
      message: "¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.",
      action: async () => {
        try {
          await deleteDoc(doc(db, "products", id));
          toast.success("Producto eliminado");
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, "products");
        } finally {
          setShowConfirmModal(false);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.price || !editingProduct?.categoryId) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    try {
      const price = parseFloat(editingProduct.price?.toString() || '0');
      const stock = parseInt(editingProduct.stock?.toString() || '0');

      if (isNaN(price) || price < 0) {
        toast.error("Precio inválido");
        return;
      }

      const productData = {
        ...editingProduct,
        price: price,
        stock: isNaN(stock) ? 0 : stock,
        name: editingProduct.name?.trim(),
        description: editingProduct.description?.trim(),
        station: editingProduct.station || 'cocina',
      };

      if (editingProduct.id) {
        const { id, ...data } = productData;
        await updateDoc(doc(db, "products", id), data);
        toast.success("Producto actualizado");
      } else {
        await addDoc(collection(db, "products"), {
          ...productData,
          available: editingProduct.available ?? true,
        });
        toast.success("Producto creado");
      }
      setShowModal(false);
      setEditingProduct(null);
    } catch (error) {
      handleFirestoreError(error, editingProduct?.id ? OperationType.UPDATE : OperationType.CREATE, "products");
    }
  };

  const openAddModal = () => {
    setEditingProduct({
      name: '',
      description: '',
      price: 0,
      categoryId: categories[0]?.id || '',
      stock: 50,
      available: true,
      imageUrl: ''
    });
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mex-green"></div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-hidden flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif text-mex-terracotta">Gestión de Inventario</h1>
        <Button variant="primary" className="gap-2" onClick={openAddModal}>
          <Plus size={18} />
          Nuevo Producto
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar en inventario..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20"
          />
        </div>
        <Button variant="outline" className="gap-2">
          Categorías
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-20 md:pb-6">
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase">Producto</th>
                <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase">Categoría</th>
                <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase">Precio</th>
                <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase">Stock</th>
                <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-medium text-stone-800">{product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                        product.station === 'plancha' ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {product.station === 'plancha' ? 'Plancha' : 'Cocina'}
                      </span>
                      <p className="text-xs text-stone-400 truncate max-w-xs">{product.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-stone-600">
                    {categories.find(c => c.id === product.categoryId)?.name || 'Sin categoría'}
                  </td>
                  <td className="px-4 py-4 font-medium text-stone-800">{formatCurrency(product.price)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-bold",
                        product.stock <= 10 ? "text-mex-red" : "text-stone-800"
                      )}>
                        {product.stock}
                      </span>
                      {product.stock <= 10 && <AlertTriangle size={14} className="text-mex-red" />}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase border",
                      product.available 
                        ? "bg-mex-green/10 text-mex-green border-mex-green/20" 
                        : "bg-stone-100 text-stone-400 border-stone-200"
                    )}>
                      {product.available ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-stone-400 hover:text-mex-green"
                        onClick={() => openEditModal(product)}
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-stone-400 hover:text-mex-red"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {showModal && editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
            <div className="bg-mex-brown p-4 flex items-center justify-between text-white">
              <h2 className="text-xl font-serif">
                {editingProduct.id ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button onClick={() => setShowModal(false)} className="hover:bg-white/10 p-1 rounded-full">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-bold text-stone-700">Nombre del Producto *</label>
                  <input 
                    type="text" 
                    required
                    value={editingProduct.name || ''}
                    onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-bold text-stone-700">Descripción</label>
                  <textarea 
                    value={editingProduct.description || ''}
                    onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20 min-h-[80px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-stone-700">Precio ($) *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    value={editingProduct.price || 0}
                    onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-stone-700">Categoría *</label>
                  <select 
                    required
                    value={editingProduct.categoryId || ''}
                    onChange={e => setEditingProduct({...editingProduct, categoryId: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20 bg-white"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-stone-700">Stock Inicial</label>
                  <input 
                    type="number" 
                    min="0"
                    value={editingProduct.stock || 0}
                    onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-stone-700">Estación de Preparación</label>
                  <select 
                    value={editingProduct.station || 'cocina'}
                    onChange={e => setEditingProduct({...editingProduct, station: e.target.value as 'plancha' | 'cocina'})}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20 bg-white"
                  >
                    <option value="cocina">Cocina</option>
                    <option value="plancha">Plancha</option>
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editingProduct.available !== false}
                      onChange={e => setEditingProduct({...editingProduct, available: e.target.checked})}
                      className="w-5 h-5 rounded border-stone-300 text-mex-green focus:ring-mex-green"
                    />
                    <span className="text-sm font-bold text-stone-700">Disponible</span>
                  </label>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-bold text-stone-700 flex items-center gap-2">
                    <ImageIcon size={16} />
                    URL de la Imagen (Foto)
                  </label>
                  <input 
                    type="url" 
                    placeholder="https://ejemplo.com/foto.jpg"
                    value={editingProduct.imageUrl || ''}
                    onChange={e => setEditingProduct({...editingProduct, imageUrl: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20"
                  />
                  {editingProduct.imageUrl && (
                    <div className="mt-2 w-20 h-20 rounded-lg overflow-hidden border border-stone-200">
                      <img 
                        src={editingProduct.imageUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Error';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                  type="button"
                  variant="ghost" 
                  className="flex-1" 
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  variant="primary" 
                  className="flex-1 gap-2"
                >
                  <Save size={18} />
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            </CardContent>
            <CardFooter className="flex gap-2 p-4 bg-stone-50">
              <Button variant="ghost" className="flex-1" onClick={() => setShowConfirmModal(false)}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 gap-2 bg-mex-red hover:bg-red-700" 
                onClick={confirmAction.action}
              >
                <CheckCircle2 size={18} />
                Confirmar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
