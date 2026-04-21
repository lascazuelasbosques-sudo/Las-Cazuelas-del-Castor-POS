import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { Package, Plus, Search, Edit2, Trash2, AlertTriangle, X, Save, Image as ImageIcon, CheckCircle2, Copy, Upload } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { formatCurrency, cn } from "@/src/lib/utils";
import { Product, Category } from "@/src/types";
import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, addDoc, updateDoc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firestoreErrorHandler";
import toast from "react-hot-toast";

interface InventoryViewProps {
  userRole?: string;
}

export const InventoryView = ({ userRole = 'waiter' }: InventoryViewProps) => {
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
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "products");
    });

    const unsubCat = onSnapshot(query(collection(db, "categories"), orderBy("order", "asc")), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "categories");
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

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecciona una imagen válida.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setEditingProduct(prev => prev ? { ...prev, imageUrl: dataUrl } : null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
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

  const handleDuplicateProduct = (product: Product) => {
    const { id, ...rest } = product; // Remove original ID
    setEditingProduct({
      ...rest,
      name: `${rest.name} (Copia)`
    });
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
    <div className="p-3 md:p-6 h-full overflow-hidden flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-serif text-mex-terracotta">Inventario</h1>
        <Button variant="primary" className="gap-2 h-11" onClick={openAddModal}>
          <Plus size={18} />
          Nuevo Producto
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 md:py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20 text-base"
          />
        </div>
        <Button variant="outline" className="gap-2 h-11">
          Categorías
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 pb-24 md:pb-6">
        {/* Mobile Card Layout */}
        <div className="grid grid-cols-1 sm:hidden gap-3">
          {filteredProducts.map(product => (
            <Card key={product.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-stone-800">{product.name}</h3>
                    <p className="text-xs text-stone-500 line-clamp-1">{product.description}</p>
                  </div>
                  <p className="font-bold text-mex-terracotta">{formatCurrency(product.price)}</p>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                    product.station === 'plancha' ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {product.station === 'plancha' ? 'Plancha' : 'Cocina'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-stone-100 text-stone-600">
                    {categories.find(c => c.id === product.categoryId)?.name || 'Sin categoría'}
                  </span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border",
                    product.available 
                      ? "bg-mex-green/10 text-mex-green border-mex-green/20" 
                      : "bg-stone-100 text-stone-400 border-stone-200"
                  )}>
                    {product.available ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">Stock:</span>
                    <span className={cn(
                      "font-bold text-sm",
                      product.stock <= 10 ? "text-mex-red" : "text-stone-800"
                    )}>
                      {product.stock}
                    </span>
                    {product.stock <= 10 && <AlertTriangle size={14} className="text-mex-red" />}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-9 w-9 p-0 text-stone-400 hover:text-mex-green"
                      onClick={() => openEditModal(product)}
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-9 w-9 p-0 text-stone-400 hover:text-mex-gold"
                      onClick={() => handleDuplicateProduct(product)}
                      title="Duplicar"
                    >
                      <Copy size={18} />
                    </Button>
                    {userRole === 'admin' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-9 w-9 p-0 text-stone-400 hover:text-mex-red"
                        onClick={() => handleDeleteProduct(product.id)}
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden sm:block bg-white rounded-xl border border-stone-200 overflow-hidden">
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
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-stone-400 hover:text-mex-gold"
                        onClick={() => handleDuplicateProduct(product)}
                        title="Duplicar"
                      >
                        <Copy size={16} />
                      </Button>
                      {userRole === 'admin' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-stone-400 hover:text-mex-red"
                          onClick={() => handleDeleteProduct(product.id)}
                          title="Eliminar"
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

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editingProduct.allowsExtraCheese === true}
                      onChange={e => setEditingProduct({...editingProduct, allowsExtraCheese: e.target.checked})}
                      className="w-5 h-5 rounded border-stone-300 text-mex-gold focus:ring-mex-gold"
                    />
                    <span className="text-sm font-bold text-stone-700">Permite Queso Extra</span>
                  </label>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-bold text-stone-700 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ImageIcon size={16} />
                      Imagen del Platillo (Archivo o URL)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      placeholder="URL (https://ejemplo.com/foto.jpg)"
                      value={editingProduct.imageUrl?.startsWith('data:image') ? '' : (editingProduct.imageUrl || '')}
                      onChange={e => setEditingProduct({...editingProduct, imageUrl: e.target.value})}
                      className="flex-1 px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20"
                    />
                    <label className="cursor-pointer bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-xl border border-stone-200 flex items-center gap-2 transition-colors">
                      <Upload size={18} />
                      <span className="hidden sm:inline">Subir Foto</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                  {editingProduct.imageUrl && (
                    <div className="mt-3 relative w-32 h-32 rounded-xl overflow-hidden border-2 border-stone-100 shadow-sm">
                      <img 
                        src={editingProduct.imageUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Error';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setEditingProduct({...editingProduct, imageUrl: ''})}
                        className="absolute top-1 right-1 bg-black/50 hover:bg-black text-white rounded-full p-1 transition-colors"
                        title="Quitar imagen"
                      >
                        <X size={14} />
                      </button>
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
