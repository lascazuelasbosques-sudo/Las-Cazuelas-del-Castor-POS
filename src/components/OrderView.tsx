import { useState, useEffect } from "react";
import { Search, Plus, Minus, ShoppingCart, Utensils as UtensilsIcon, History, X } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent } from "./Card";
import { formatCurrency, cn, customRound } from "@/src/lib/utils";
import { Product, Category, OrderItem, Order, OrderStatus } from "@/src/types";
import { db, auth } from "../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, where, runTransaction } from "firebase/firestore";
import toast from "react-hot-toast";

const Utensils = UtensilsIcon;

import { handleFirestoreError, OperationType } from "../lib/firestoreErrorHandler";

interface OrderViewProps {
  orderToEdit?: Order | null;
  clearOrderToEdit?: () => void;
  userRole?: string;
}

export const OrderView = ({ orderToEdit, clearOrderToEdit, userRole = 'waiter' }: OrderViewProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [tableNumber, setTableNumber] = useState('');
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderStatus, setEditingOrderStatus] = useState<OrderStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showActiveOrders, setShowActiveOrders] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);

  const TAKEAWAY_FEE_PERCENTAGE = 0.05; // 5% fee for disposables as requested

  useEffect(() => {
    const qCat = query(collection(db, "categories"), orderBy("order", "asc"));
    const unsubCat = onSnapshot(qCat, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
      if (cats.length > 0 && !selectedCategory) {
        setSelectedCategory(cats[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "categories");
    });

    const qProd = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubProd = onSnapshot(qProd, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "products");
    });

    const qActive = query(
      collection(db, "orders"), 
      where("status", "in", ["pending", "preparing", "ready", "served"]),
      orderBy("createdAt", "desc")
    );
    const unsubActive = onSnapshot(qActive, (snapshot) => {
      setActiveOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "orders");
    });

    return () => {
      unsubCat();
      unsubProd();
      unsubActive();
    };
  }, []);

  useEffect(() => {
    if (orderToEdit) {
      // If coming from Cashier to edit a specific order (e.g. to fix a mistake)
      setCart(orderToEdit.items);
      setTableNumber(orderToEdit.tableNumber === 'Para Llevar' ? '' : orderToEdit.tableNumber);
      setIsTakeaway(orderToEdit.isTakeaway);
      setNotes(orderToEdit.notes || '');
      setEditingOrderId(orderToEdit.id);
      setEditingOrderStatus(orderToEdit.status);
      setShowActiveOrders(false);
      toast.success(`Editando pedido: ${orderToEdit.folio || orderToEdit.tableNumber}`);
      
      if (clearOrderToEdit) {
        clearOrderToEdit();
      }
    }
  }, [orderToEdit]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      // Only group with pending items
      const existingPending = prev.find(item => item.productId === product.id && item.status !== 'completed');
      if (existingPending) {
        return prev.map(item => 
          item === existingPending 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1,
        status: 'pending',
        station: product.station || 'cocina'
      }];
    });
  };

  const removeFromCart = (itemToRemove: OrderItem) => {
    setCart(prev => {
      const existing = prev.find(item => item === itemToRemove);
      if (existing && existing.quantity > 1) {
        return prev.map(item => 
          item === itemToRemove 
            ? { ...item, quantity: item.quantity - 1 } 
            : item
        );
      }
      return prev.filter(item => item !== itemToRemove);
    });
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const takeawayFee = isTakeaway ? customRound(subtotal * TAKEAWAY_FEE_PERCENTAGE) : 0;
  const total = customRound(subtotal + takeawayFee);

  const handleSendOrder = async () => {
    if (!auth.currentUser) return;
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    if (!isTakeaway && !tableNumber) {
      toast.error("Por favor ingresa el número de mesa");
      return;
    }
    
    try {
      const orderData: any = {
        tableNumber: isTakeaway ? 'Para Llevar' : tableNumber,
        items: cart,
        subtotal,
        takeawayFee,
        total,
        isTakeaway,
        updatedAt: new Date().toISOString(),
        notes: notes.trim()
      };

      if (editingOrderId) {
        // Al actualizar un pedido, lo regresamos a 'pending' para que cocina 
        // pueda ver los nuevos platillos agregados.
        orderData.status = 'pending';
        await updateDoc(doc(db, "orders", editingOrderId), orderData);
        toast.success("Pedido actualizado y enviado a cocina");
      } else {
        // Generate folio
        const counterRef = doc(db, 'counters', 'orders');
        let consecutive = 1;

        try {
          await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
              transaction.set(counterRef, { count: 1 });
              consecutive = 1;
            } else {
              consecutive = counterDoc.data().count + 1;
              transaction.update(counterRef, { count: consecutive });
            }
          });
        } catch (error) {
          console.error("Error generating consecutive:", error);
          consecutive = Math.floor(Math.random() * 1000); // Fallback
        }

        const date = new Date();
        const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
        const dayLetter = days[date.getDay()];
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const paddedConsecutive = consecutive.toString().padStart(3, '0');
        const tableStr = isTakeaway ? 'LL' : tableNumber;

        orderData.folio = `${dayLetter}${hours}${minutes}-${tableStr}-${paddedConsecutive}`;
        orderData.status = 'pending';
        orderData.createdAt = new Date().toISOString();
        orderData.waiterId = auth.currentUser.uid;
        orderData.waiterName = auth.currentUser.displayName || auth.currentUser.email;
        
        await addDoc(collection(db, "orders"), orderData);
        toast.success("Pedido enviado a cocina");
      }
      
      setCart([]);
      setTableNumber('');
      setNotes('');
      setIsTakeaway(false);
      setEditingOrderId(null);
      setEditingOrderStatus(null);
      setShowCartMobile(false);
    } catch (error) {
      handleFirestoreError(error, editingOrderId ? OperationType.UPDATE : OperationType.CREATE, "orders");
    }
  };

  const loadOrder = (order: Order) => {
    // Cargamos los items existentes para poder agregar más
    setCart(order.items);
    setTableNumber(order.tableNumber === 'Para Llevar' ? '' : order.tableNumber);
    setIsTakeaway(order.isTakeaway);
    setNotes(order.notes || '');
    setEditingOrderId(order.id);
    setEditingOrderStatus(order.status);
    setShowActiveOrders(false);
    toast.success(`Editando pedido de Mesa ${order.tableNumber}`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mex-green"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full md:flex-row overflow-hidden relative">
      {/* Products Section */}
      <div className="flex-1 flex flex-col p-3 md:p-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4 md:mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar antojito..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 md:py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20 text-base"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map(cat => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSearchQuery(''); // Clear search when selecting category
                }}
                className="whitespace-nowrap px-4 py-2 h-auto"
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3 overflow-y-auto pr-1">
          {products.filter(p => {
            if (!p.available) return false;
            if (searchQuery) {
              return p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                     p.description?.toLowerCase().includes(searchQuery.toLowerCase());
            }
            return p.categoryId === selectedCategory;
          }).map(product => (
            <Card 
              key={product.id} 
              className="cursor-pointer hover:border-mex-green transition-colors group active:scale-[0.98]"
              onClick={() => addToCart(product)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-14 h-14 bg-stone-100 rounded-lg flex items-center justify-center text-stone-400 shrink-0">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                  ) : (
                    <Utensils size={24} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-stone-800 group-hover:text-mex-green truncate">{product.name}</h3>
                  <p className="text-[11px] text-stone-500 line-clamp-1">{product.description}</p>
                  <p className="font-bold text-mex-terracotta mt-0.5">{formatCurrency(product.price)}</p>
                </div>
                <div className="shrink-0">
                  <div className="w-8 h-8 rounded-full bg-mex-green/10 text-mex-green flex items-center justify-center">
                    <Plus size={18} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Mobile Cart Toggle Button */}
      <div className="md:hidden fixed bottom-24 right-4 z-40">
        <Button 
          variant="primary" 
          size="lg" 
          className="rounded-full w-14 h-14 shadow-2xl flex items-center justify-center p-0"
          onClick={() => setShowCartMobile(true)}
        >
          <div className="relative">
            <ShoppingCart size={24} />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-mex-red text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white">
                {cart.reduce((acc, item) => acc + item.quantity, 0)}
              </span>
            )}
          </div>
        </Button>
      </div>

      {/* Cart Section */}
      <div className={cn(
        "fixed inset-0 z-50 bg-white flex flex-col transition-transform duration-300 md:relative md:inset-auto md:translate-x-0 md:w-80 lg:w-96 md:border-l md:border-stone-200 md:shadow-xl",
        showCartMobile ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 border-b border-stone-100 flex flex-col gap-3 bg-stone-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ShoppingCart size={20} className="text-mex-green" />
              {editingOrderId ? 'Editar Pedido' : 'Nueva Comanda'}
            </h2>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-mex-brown gap-1 h-9 px-3"
                onClick={() => setShowActiveOrders(!showActiveOrders)}
              >
                <History size={16} />
                Activos
              </Button>
              <button 
                className="md:hidden p-2 text-stone-400 hover:text-stone-600"
                onClick={() => setShowCartMobile(false)}
              >
                <X size={24} />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-stone-200 text-xs font-bold text-stone-600">
              <input 
                type="checkbox" 
                checked={isTakeaway}
                onChange={(e) => setIsTakeaway(e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-mex-green focus:ring-mex-green"
              />
              Para Llevar
            </label>
            {!isTakeaway && (
              <input 
                type="text" 
                placeholder="Mesa #" 
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-16 px-2 py-1 text-center border border-stone-200 rounded-lg font-bold text-mex-green"
              />
            )}
          </div>
        </div>

        {showActiveOrders && (
          <div className="absolute inset-0 bg-white z-20 flex flex-col">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-mex-brown text-white">
              <h3 className="font-serif">Pedidos Activos</h3>
              <button onClick={() => setShowActiveOrders(false)}><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {activeOrders.length === 0 ? (
                <p className="text-center text-stone-400 mt-10">No hay pedidos activos</p>
              ) : (
                activeOrders.map(order => (
                  <button 
                    key={order.id}
                    onClick={() => loadOrder(order)}
                    className="w-full text-left p-3 rounded-xl border border-stone-100 hover:border-mex-green hover:bg-mex-green/5 transition-all flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-stone-800">{order.tableNumber}</p>
                      <p className="text-xs text-stone-500">{order.items.length} productos • {formatCurrency(order.total)}</p>
                    </div>
                    <Plus size={18} className="text-mex-green" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 opacity-50">
              <ShoppingCart size={48} className="mb-2" />
              <p>El carrito está vacío</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={`${item.productId}-${index}`} className={cn("flex items-center gap-3 p-2 rounded-lg", item.status === 'completed' ? "bg-stone-100 opacity-70" : "")}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("font-medium", item.status === 'completed' ? "text-stone-500 line-through" : "text-stone-800")}>{item.name}</p>
                    {item.status === 'completed' && (
                      <span className="text-[10px] bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded font-bold uppercase">Entregado</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">{formatCurrency(item.price)} c/u</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => removeFromCart(item)}
                    disabled={item.status === 'completed'}
                    className="p-1 rounded-md hover:bg-stone-200 text-stone-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-6 text-center font-bold">{item.quantity}</span>
                  <button 
                    onClick={() => {
                      const product = products.find(p => p.id === item.productId);
                      if (product) addToCart(product);
                    }}
                    disabled={item.status === 'completed'}
                    className="p-1 rounded-md hover:bg-stone-200 text-mex-green disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <p className="w-20 text-right font-bold text-stone-800">
                  {formatCurrency(item.price * item.quantity)}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-200 space-y-3">
          {isTakeaway && (
            <div className="flex justify-between items-center text-sm text-stone-600">
              <span>Desechables (5%)</span>
              <span>{formatCurrency(takeawayFee)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span className="text-mex-terracotta">{formatCurrency(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="w-full h-12" onClick={() => {
              setCart([]);
              setIsTakeaway(false);
              setTableNumber('');
              setNotes('');
              setEditingOrderId(null);
              setEditingOrderStatus(null);
              setShowCartMobile(false);
            }}>
              {editingOrderId ? 'Cancelar' : 'Limpiar'}
            </Button>
            <Button 
              variant="primary" 
              className="w-full h-12" 
              disabled={cart.length === 0 || (!isTakeaway && !tableNumber)}
              onClick={handleSendOrder}
            >
              {editingOrderId ? 'Actualizar' : 'Enviar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
