import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { Package, Plus, Search, Edit2, Trash2, AlertTriangle, X, Save, Image as ImageIcon, CheckCircle2, Copy, Upload, DollarSign } from "lucide-react";
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
    <div className="p-4 md:p-8 h-full overflow-hidden flex flex-col bg-mex-cream">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-mex-brown">Inventario</h1>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">Gestión de Productos y Stock</p>
        </div>
        <Button 
          variant="primary" 
          className="gap-2 h-12 shadow-lg shadow-mex-green/20 bg-mex-green hover:bg-mex-green/90 rounded-xl" 
          onClick={openAddModal}
        >
          <Plus size={20} />
          <span className="font-bold uppercase tracking-widest text-xs">Nuevo Producto</span>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-6 shrink-0">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-mex-green" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nombre..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl border-none bg-white shadow-sm focus:ring-2 focus:ring-mex-green/20 text-base font-medium placeholder:text-stone-300 transition-all shadow-stone-200/50"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 sm:flex-none gap-2 h-14 rounded-2xl bg-white border-none shadow-sm whitespace-nowrap px-6">
            <Package size={18} className="text-mex-gold" />
            Categorías
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 pb-24 md:pb-8 no-scrollbar">
        {/* Mobile Card Layout */}
        <div className="grid grid-cols-1 sm:hidden gap-4 pb-32">
          {filteredProducts.map(product => (
            <Card key={product.id} className="border-none shadow-md overflow-hidden transform active:scale-[0.98] transition-all bg-white rounded-2xl">
              <div className="flex">
                <div className="w-28 h-28 sm:w-32 sm:h-32 bg-stone-50 shrink-0 relative overflow-hidden border-r border-stone-100">
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-200">
                      <ImageIcon size={40} />
                    </div>
                  )}
                  {product.stock <= 5 && (
                    <div className="absolute top-0 left-0 bg-mex-red text-white p-1.5 rounded-br-xl shadow-lg animate-pulse">
                      <AlertTriangle size={16} />
                    </div>
                  )}
                </div>
                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-black text-stone-800 text-sm leading-tight truncate uppercase tracking-tighter">{product.name}</h3>
                      <p className="font-black text-mex-terracotta text-sm whitespace-nowrap">{formatCurrency(product.price)}</p>
                    </div>
                    <p className="text-[9px] text-stone-400 line-clamp-2 mt-1 italic leading-tight">
                      {product.description || 'Sin descripción detallada'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <span className={cn(
                        "text-[8px] px-2 py-0.5 rounded-lg font-black uppercase tracking-widest",
                        product.station === 'plancha' ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                      )}>
                        {product.station === 'plancha' ? 'Parrilla' : 'Cocina'}
                      </span>
                      <span className="text-[8px] px-2 py-0.5 rounded-lg font-black uppercase tracking-widest bg-stone-50 text-stone-400 border border-stone-100">
                        {categories.find(c => c.id === product.categoryId)?.name || 'General'}
                      </span>
                      {!product.available && (
                        <span className="text-[8px] px-2 py-0.5 rounded-lg font-black uppercase tracking-widest bg-red-50 text-mex-red border border-red-100">
                          Inactivo
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-50">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-black text-stone-300 uppercase tracking-widest">Existencia:</span>
                      <span className={cn(
                        "font-black text-[11px] px-2.5 py-1 rounded-full shadow-sm",
                        product.stock <= 10 ? "bg-red-50 text-mex-red border border-red-100" : "bg-stone-50 text-mex-green border border-stone-100"
                      )}>
                        {product.stock}
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      <button 
                        onClick={() => openEditModal(product)}
                        className="p-2.5 text-stone-400 hover:text-mex-green active:bg-stone-50 rounded-xl transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDuplicateProduct(product)}
                        className="p-2.5 text-stone-400 hover:text-mex-gold active:bg-stone-50 rounded-xl transition-all"
                      >
                        <Copy size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 opacity-20">
              <Package size={64} className="mb-4" />
              <p className="text-xl font-serif uppercase tracking-tighter">Sin resultados</p>
              <p className="text-xs mt-1">No se encontraron productos con ese nombre</p>
            </div>
          )}
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-lg rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200 my-auto">
            <CardHeader className="bg-mex-brown text-white rounded-t-[2rem] p-6 flex flex-row items-center justify-between">
              <div>
                <h2 className="text-xl font-serif leading-tight">
                  {editingProduct.id ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                <p className="text-[10px] text-mex-gold font-bold uppercase tracking-widest mt-1">Información de Platillo</p>
              </div>
              <button onClick={() => setShowModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </CardHeader>
            
            <form onSubmit={handleSaveProduct} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Nombre del Platillo *</label>
                  <input 
                    type="text" 
                    required
                    value={editingProduct.name || ''}
                    onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                    className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-brown focus:ring-0 outline-none transition-all font-bold"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Descripción</label>
                  <textarea 
                    value={editingProduct.description || ''}
                    onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                    className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-brown focus:ring-0 outline-none transition-all min-h-[80px] no-scrollbar text-sm"
                    placeholder="Describe el platillo..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Precio ($) *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input 
                      type="number" 
                      required
                      min="0"
                      step="0.01"
                      value={editingProduct.price || 0}
                      onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-brown focus:ring-0 outline-none transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Categoría *</label>
                  <select 
                    required
                    value={editingProduct.categoryId || ''}
                    onChange={e => setEditingProduct({...editingProduct, categoryId: e.target.value})}
                    className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-brown focus:ring-0 outline-none transition-all font-bold appearance-none cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Stock</label>
                  <input 
                    type="number" 
                    min="0"
                    value={editingProduct.stock || 0}
                    onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})}
                    className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-brown focus:ring-0 outline-none transition-all font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Estación</label>
                  <select 
                    value={editingProduct.station || 'cocina'}
                    onChange={e => setEditingProduct({...editingProduct, station: e.target.value as 'plancha' | 'cocina'})}
                    className="w-full px-5 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-brown focus:ring-0 outline-none transition-all font-bold appearance-none cursor-pointer"
                  >
                    <option value="cocina">Cocina</option>
                    <option value="plancha">Parrilla / Plancha</option>
                  </select>
                </div>

                <div className="flex items-center gap-4 py-2 sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={cn(
                      "w-10 h-6 rounded-full relative transition-colors",
                      editingProduct.available !== false ? "bg-mex-green" : "bg-stone-200"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={editingProduct.available !== false}
                        onChange={e => setEditingProduct({...editingProduct, available: e.target.checked})}
                        className="sr-only"
                      />
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                        editingProduct.available !== false ? "left-5" : "left-1"
                      )} />
                    </div>
                    <span className="text-xs font-bold text-stone-600 uppercase tracking-tighter">Disponible</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={cn(
                      "w-10 h-6 rounded-full relative transition-colors",
                      editingProduct.allowsExtraCheese === true ? "bg-mex-gold" : "bg-stone-200"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={editingProduct.allowsExtraCheese === true}
                        onChange={e => setEditingProduct({...editingProduct, allowsExtraCheese: e.target.checked})}
                        className="sr-only"
                      />
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                        editingProduct.allowsExtraCheese === true ? "left-5" : "left-1"
                      )} />
                    </div>
                    <span className="text-xs font-bold text-stone-600 uppercase tracking-tighter">Queso Extra</span>
                  </label>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Imagen del Platillo</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                      <input 
                        type="url" 
                        placeholder="URL de la imagen..."
                        value={editingProduct.imageUrl?.startsWith('data:image') ? '' : (editingProduct.imageUrl || '')}
                        onChange={e => setEditingProduct({...editingProduct, imageUrl: e.target.value})}
                        className="w-full pl-11 pr-4 py-3 rounded-2xl border border-stone-100 bg-stone-50 focus:bg-white focus:border-mex-brown focus:ring-0 outline-none transition-all text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <label className="flex-1 sm:flex-none cursor-pointer bg-stone-100 hover:bg-stone-200 text-stone-600 px-5 py-3 rounded-2xl border border-stone-200 flex items-center justify-center gap-2 transition-colors">
                        <Upload size={18} />
                        <span className="text-[10px] font-black uppercase">Subir</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleImageUpload}
                        />
                      </label>
                      {editingProduct.imageUrl && (
                        <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white shadow-md relative group/img">
                          <img 
                            src={editingProduct.imageUrl} 
                            alt="Min" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setEditingProduct({...editingProduct, imageUrl: ''})}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                          >
                            <X size={12} className="text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                  type="button"
                  variant="ghost" 
                  className="flex-1 h-12 rounded-2xl font-bold uppercase tracking-widest text-[10px]" 
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  variant="primary" 
                  className="flex-[2] h-12 rounded-2xl bg-mex-green hover:bg-mex-green/90 shadow-lg shadow-mex-green/20 font-bold uppercase tracking-widest text-[10px]"
                >
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </Card>
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
