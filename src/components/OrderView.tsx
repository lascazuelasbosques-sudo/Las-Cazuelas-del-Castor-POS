import React, { useState, useEffect } from "react";
import { Search, Plus, Minus, ShoppingCart, Utensils as UtensilsIcon, History, X, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { formatCurrency, cn, customRound } from "@/src/lib/utils";
import { Product, Category, OrderItem, Order, OrderStatus } from "@/src/types";
import { db, auth } from "../firebase";
import { collection, query, orderBy, doc, where, runTransaction, arrayUnion, addDoc, updateDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { useDraggable } from "../lib/useDraggable";
import { 
  addOfflineDoc, 
  updateOfflineDoc, 
  onOfflineSnapshot,
  getOfflineStatus
} from "../lib/offlineService";

const Utensils = UtensilsIcon;

import { handleFirestoreError, OperationType } from "../lib/firestoreErrorHandler";
import { getFallbackProductImage } from "../lib/presetImages";
import { checkIsBistec } from "../lib/orderUtils";
import { isDrinkItem } from "../lib/drinkUtils";

interface OrderViewProps {
  orderToEdit?: Order | null;
  clearOrderToEdit?: () => void;
  userRole?: string;
}

export const OrderView = ({ orderToEdit, clearOrderToEdit, userRole = 'waiter' }: OrderViewProps) => {
  const getLoggedUserForLog = () => {
    let waiterName = "Mesero";
    try {
      const posUserStr = localStorage.getItem('posUser');
      if (posUserStr) {
        const parsed = JSON.parse(posUserStr);
        if (parsed && parsed.name) {
          waiterName = parsed.name;
        }
      } else {
        waiterName = auth.currentUser?.displayName || auth.currentUser?.email || "Mesero";
      }
    } catch (e) {
      waiterName = auth.currentUser?.displayName || auth.currentUser?.email || "Mesero";
    }

    if (
      waiterName.toLowerCase().trim() === 'abigail' || 
      waiterName.toLowerCase().trim() === 'antonieta abigail' || 
      waiterName.toLowerCase().trim() === 'abigail villagómez' ||
      waiterName.toLowerCase().trim() === 'abigail villagomez' ||
      waiterName.toLowerCase().includes('abigail')
    ) {
      waiterName = 'Antonieta Abigail Villagómez';
    }

    let roleLabel = "Mesero";
    if (userRole === 'admin') roleLabel = "Administrador";
    else if (userRole === 'waiter') roleLabel = "Mesero";
    else if (userRole === 'kitchen') roleLabel = "Cocina";
    else if (userRole === 'parrilla') roleLabel = "Parrilla";
    else if (userRole === 'cashier') roleLabel = "Cajero";

    return {
      userId: auth.currentUser?.uid || 'unknown',
      userName: waiterName,
      userRole: roleLabel
    };
  };

  const dragCart = useDraggable();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [tableNumber, setTableNumber] = useState('');
  const [subAccount, setSubAccount] = useState('');
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderStatus, setEditingOrderStatus] = useState<OrderStatus | null>(null);
  const [editingOrderWhatsAppUnconfirmed, setEditingOrderWhatsAppUnconfirmed] = useState<boolean>(false);
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showActiveOrders, setShowActiveOrders] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    const saved = localStorage.getItem('orderViewMode');
    return (saved === 'list' || saved === 'grid') ? saved : 'grid';
  });

  const getProductCartCount = (productId: string) => {
    return cart.filter(item => item.productId === productId).reduce((sum, item) => sum + item.quantity, 0);
  };

  const isProductPackage = (product: Product): boolean => {
    if (!product) return false;
    const nameLower = (product.name || '').toLowerCase();
    const cat = categories.find(c => c.id === product.categoryId);
    const catNameLower = cat ? (cat.name || '').toLowerCase() : '';

    return (
      nameLower.includes('paquete') ||
      nameLower.includes('combo') ||
      catNameLower.includes('paquete') ||
      catNameLower.includes('combo') ||
      product.categoryId === 'paquetes' ||
      product.categoryId === 'combo'
    );
  };

  const isCustomizableProduct = (product: Product): boolean => {
    if (isProductPackage(product)) return false;
    const nameLower = (product.name || '').toLowerCase();
    return (
      nameLower.includes('quesadilla') || 
      nameLower.includes('huarache') || 
      nameLower.includes('taco') || 
      nameLower.includes('tostada') || 
      nameLower.includes('chilaquil') || 
      nameLower.includes('gordita') || 
      nameLower.includes('enchilada') || 
      nameLower.includes('flauta') || 
      nameLower.includes('burrito') || 
      !!product.allowsExtraCheese
    );
  };

  const parseFillingsFromItemName = (name: string, productName: string): string[] => {
    let clean = name;
    clean = clean.replace(/\s*\([^)]*\)/g, '').trim();

    const prefixes = [
      'Quesadilla de ', 'Quesadillas de ',
      'Huarache de ', 'Huaraches de ',
      'Tacos de ', 'Taco de ',
      'Tostadas con ', 'Tostada con ', 'Tostadas de ', 'Tostada de ',
      'Chilaquiles con ', 'Chilaquil con ',
      'Gordita de ', 'Gorditas de ',
      'Enchiladas con ', 'Enchilada con ',
      'Flautas de ', 'Burrito de '
    ];

    for (const prefix of prefixes) {
      if (clean.toLowerCase().startsWith(prefix.toLowerCase())) {
        clean = clean.substring(prefix.length).trim();
        break;
      }
    }

    if (!clean || clean.toLowerCase() === productName.toLowerCase()) {
      return [];
    }

    return clean.split(/,|\by\b/i).map(p => p.trim()).filter(Boolean);
  };

  const handleDecrementProduct = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = [...cart].reverse().find(i => i.productId === product.id);
    if (item) {
      removeFromCart(item);
    }
  };

  const handleIncrementProduct = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCustomizableProduct(product)) {
      const customCartItems = cart.filter(i => i.productId === product.id && i.status !== 'completed');
      if (customCartItems.length > 0) {
        // Increment the last customized selection of this product directly
        const lastItem = customCartItems[customCartItems.length - 1];
        const filling = lastItem.fillings && lastItem.fillings.length > 0
          ? lastItem.fillings
          : parseFillingsFromItemName(lastItem.name, product.name);
        addToCart(product, lastItem.hasExtraCheese || false, filling, 1);
        toast.success(`+1 ${lastItem.name}`);
      } else {
        setSelectedFillings([]);
        setHasExtraCheeseOpt(false);
        setCustomizeQuantity(1);
        setProductToCustomize(product);
      }
    } else {
      addToCart(product, false);
    }
  };

  const getCategoryEmoji = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('bebida') || n.includes('refresco') || n.includes('agua')) return '🥤';
    if (n.includes('quesadilla')) return '🌮';
    if (n.includes('antojito') || n.includes('sopa') || n.includes('caldo')) return '🫓';
    if (n.includes('gordita')) return '🫓';
    if (n.includes('tostada')) return '🌮';
    if (n.includes('pambazo') || n.includes('torta')) return '🍔';
    if (n.includes('taco')) return '🌮';
    if (n.includes('sopa') || n.includes('consome')) return '🍜';
    if (n.includes('postre') || n.includes('dulce')) return '🍰';
    if (n.includes('especial')) return '⭐';
    if (n.includes('paquete') || n.includes('combo')) return '📦';
    if (n.includes('carne') || n.includes('parrilla')) return '🥩';
    return '🍽️';
  };

  useEffect(() => {
    const qCat = query(collection(db, "categories"), orderBy("order", "asc"));
    const unsubCat = onOfflineSnapshot("categories", qCat, (cats) => {
      setCategories(cats);
      setSelectedCategory(prev => prev ? prev : (cats.length > 0 ? cats[0].id : ''));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "categories");
    });

    const qProd = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubProd = onOfflineSnapshot("products", qProd, (prods) => {
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
    const unsubActive = onOfflineSnapshot("orders", qActive, (allOrders) => {
      setActiveOrders(allOrders);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "orders");
    });

    return () => {
      unsubCat();
      unsubProd();
      unsubActive();
    };
  }, []);

  const [productToCustomize, setProductToCustomize] = useState<Product | null>(null);
  const [selectedFillings, setSelectedFillings] = useState<string[]>([]);
  const [hasExtraCheeseOpt, setHasExtraCheeseOpt] = useState<boolean>(false);
  const [customizeQuantity, setCustomizeQuantity] = useState<number>(1);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  // Form states for custom items inside the "Otros" category
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemTakeaway, setCustomItemTakeaway] = useState(false);
  const [customItemStation, setCustomItemStation] = useState<'cocina' | 'plancha'>('cocina');

  const customSuggestions = [
    "Guisado",
    "Arroz",
    "Guisado con Arroz",
    "Frijoles",
    "Consomé",
    "Postre",
    "Guarnición Extra",
    "Salsa Extra"
  ];

  const handleSuggestionClick = (suggestion: string) => {
    if (!customItemName) {
      setCustomItemName(suggestion);
    } else {
      setCustomItemName(prev => {
        const trimmed = prev.trim();
        if (trimmed.endsWith(",") || trimmed.endsWith("y") || trimmed.endsWith("+") || trimmed.endsWith("-")) {
          return `${trimmed} ${suggestion}`;
        }
        return `${trimmed}, ${suggestion}`;
      });
    }
  };

  const handleAddCustomItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!customItemName.trim()) {
      toast.error("Por favor escribe el nombre o descripción de lo que llevan");
      return;
    }
    const priceNum = parseFloat(customItemPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Por favor ingresa un precio válido (mayor o igual a 0)");
      return;
    }

    let finalName = customItemName.trim();
    if (customItemTakeaway && !finalName.toLowerCase().includes("para llevar")) {
      finalName += " (Para Llevar)";
    }

    const isBistec = checkIsBistec({ name: finalName });
    const isDrink = isDrinkItem({ name: finalName }, products, categories);

    const newItem: OrderItem = {
      productId: `custom_${Date.now()}`,
      name: finalName,
      price: priceNum,
      quantity: 1,
      status: isDrink ? 'completed' : 'pending',
      station: isBistec ? 'plancha' : customItemStation,
      hasExtraCheese: false
    };

    setCart(prev => [...prev, newItem]);
    
    if (customItemTakeaway) {
      setIsTakeaway(true);
    }

    toast.success(`Agregado: ${finalName}`);
    
    // Reset form fields
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemTakeaway(false);
  };

  useEffect(() => {
    if (orderToEdit) {
      // If coming from Cashier to edit a specific order (e.g. to fix a mistake)
      setCart(orderToEdit.items);
      setTableNumber(orderToEdit.tableNumber === 'Para Llevar' ? '' : orderToEdit.tableNumber);
      setSubAccount(orderToEdit.subAccount || '');
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

  const formatFillings = (fillings: string | string[]): string => {
    if (!fillings) return '';
    const arr = (typeof fillings === 'string' ? [fillings] : fillings).filter(f => f !== 'Queso Extra');
    if (arr.length === 0) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return `${arr[0]} y ${arr[1]}`;
    return `${arr.slice(0, -1).join(', ')} y ${arr[arr.length - 1]}`;
  };

  const toggleFilling = (fillingId: string) => {
    if (fillingId === 'Queso Extra') {
      const isSelected = selectedFillings.includes('Queso Extra');
      if (isSelected) {
        setSelectedFillings(prev => prev.filter(f => f !== 'Queso Extra'));
        setHasExtraCheeseOpt(false);
      } else {
        setSelectedFillings(prev => [...prev.filter(f => f !== 'Sencillo'), 'Queso Extra']);
        setHasExtraCheeseOpt(true);
      }
      return;
    }

    if (fillingId === 'Sencillo' || fillingId === 'Tradicional') {
      if (selectedFillings.includes(fillingId)) {
        setSelectedFillings([]);
      } else {
        setSelectedFillings([fillingId]);
        setHasExtraCheeseOpt(false);
      }
      return;
    }

    setSelectedFillings(prev => {
      const withoutExclusives = prev.filter(f => f !== 'Sencillo' && f !== 'Tradicional');
      if (withoutExclusives.includes(fillingId)) {
        return withoutExclusives.filter(f => f !== fillingId);
      } else {
        return [...withoutExclusives, fillingId];
      }
    });
  };

  const toggleExtraCheeseButton = () => {
    if (hasExtraCheeseOpt) {
      setHasExtraCheeseOpt(false);
      setSelectedFillings(prev => prev.filter(f => f !== 'Queso Extra'));
    } else {
      setHasExtraCheeseOpt(true);
      if (!selectedFillings.includes('Queso Extra')) {
        setSelectedFillings(prev => [...prev.filter(f => f !== 'Sencillo'), 'Queso Extra']);
      }
    }
  };

  const handleProductClick = (product: Product) => {
    if (isCustomizableProduct(product)) {
      setSelectedFillings([]);
      setHasExtraCheeseOpt(false);
      setCustomizeQuantity(1);
      setProductToCustomize(product);
    } else {
      addToCart(product, false);
    }
  };

  const addToCart = (
    product: Product, 
    hasExtraCheese: boolean = false, 
    filling?: string | string[],
    quantityToAdd: number = 1
  ) => {
    setCart(prev => {
      const nameLower = product.name.toLowerCase();
      let baseName = product.name;

      let fillingArr: string[] = [];
      if (Array.isArray(filling)) {
        fillingArr = filling;
      } else if (typeof filling === 'string' && filling.trim()) {
        fillingArr = [filling.trim()];
      }

      const fillingStr = formatFillings(fillingArr);

      if (fillingStr) {
        if (nameLower.includes('quesadilla')) {
          baseName = `Quesadilla de ${fillingStr}`;
        } else if (nameLower.includes('huarache')) {
          baseName = `Huarache de ${fillingStr}`;
        } else if (nameLower.includes('tacos') || nameLower.includes('taco')) {
          baseName = `Tacos de ${fillingStr}`;
        } else if (nameLower.includes('tostada')) {
          baseName = `Tostadas con ${fillingStr}`;
        } else if (nameLower.includes('chilaquiles') || nameLower.includes('chilaquil')) {
          baseName = `Chilaquiles con ${fillingStr}`;
        } else if (nameLower.includes('gordita')) {
          baseName = `Gordita de ${fillingStr}`;
        } else if (nameLower.includes('enchilada')) {
          baseName = `Enchiladas con ${fillingStr}`;
        } else {
          const cleanProd = product.name.replace(/\s*\([^)]*\)/g, '');
          baseName = `${cleanProd} (${fillingStr})`;
        }
      }

      const finalName = baseName + (hasExtraCheese ? ' (Queso Extra)' : '');

      const existingPending = prev.find(item => 
        item.productId === product.id && 
        item.status !== 'completed' && 
        item.hasExtraCheese === hasExtraCheese &&
        item.name === finalName
      );
      
      if (existingPending) {
        return prev.map(item => 
          item === existingPending 
            ? { ...item, quantity: item.quantity + quantityToAdd } 
            : item
        );
      }
      const isBistec = checkIsBistec({ name: finalName, notes: (fillingStr || '') });
      const isDrink = isDrinkItem({ name: finalName, productId: product.id }, products, categories);

      return [...prev, { 
        productId: product.id, 
        name: finalName, 
        price: product.price + (hasExtraCheese ? 8 : 0), 
        quantity: quantityToAdd,
        status: isDrink ? 'completed' : 'pending',
        station: isBistec ? 'plancha' : (product.station || 'cocina'),
        hasExtraCheese,
        fillings: fillingArr
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
  const total = customRound(subtotal);

  const handleSendOrder = async () => {
    if (!auth.currentUser) return;
    if (isSending) return;
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    if (!isTakeaway && !tableNumber) {
      toast.error("Por favor ingresa el número de mesa");
      return;
    }
    
    setIsSending(true);
    try {
      const orderData: any = {
        tableNumber: isTakeaway ? 'Para Llevar' : tableNumber,
        subAccount: isTakeaway ? '' : subAccount.trim(),
        items: cart,
        subtotal,
        total,
        isTakeaway,
        updatedAt: new Date().toISOString(),
        notes: notes.trim()
      };

      if (editingOrderId) {
        // Al actualizar un pedido (agregando platillos), si la orden estaba 'ready' o 'served', pasa a 'preparing'
        // para que Cocina reciba la alerta activa de los nuevos platillos pendientes.
        orderData.status = (editingOrderStatus === 'ready' || editingOrderStatus === 'served') 
          ? 'preparing' 
          : (editingOrderStatus || 'pending');
        
        const userInfo = getLoggedUserForLog();
        const updateLog = {
          action: 'Actualización de pedido',
          timestamp: new Date().toISOString(),
          userId: userInfo.userId,
          userName: userInfo.userName,
          userRole: userInfo.userRole
        };
        orderData.movementLogs = arrayUnion(updateLog);

        await updateOfflineDoc("orders", editingOrderId, orderData);
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

        const userInfo = getLoggedUserForLog();
        const initialLog = {
          action: 'Creación de pedido',
          timestamp: new Date().toISOString(),
          userId: userInfo.userId,
          userName: userInfo.userName,
          userRole: userInfo.userRole
        };

        // Si la mesa ya tiene una orden activa, mantenemos al mismo mesero principal de esa mesa
        const existingTableOrder = !isTakeaway && tableNumber 
          ? activeOrders.find(o => !o.isTakeaway && o.tableNumber === tableNumber)
          : null;

        orderData.folio = `${dayLetter}${hours}${minutes}-${tableStr}-${paddedConsecutive}`;
        orderData.status = 'pending';
        orderData.createdAt = new Date().toISOString();
        orderData.waiterId = existingTableOrder?.waiterId || auth.currentUser.uid;
        orderData.waiterName = existingTableOrder?.waiterName || userInfo.userName;
        orderData.movementLogs = [initialLog];
        
        await addOfflineDoc("orders", orderData);
        toast.success("Pedido enviado a cocina");
      }
      
      setCart([]);
      setTableNumber('');
      setNotes('');
      setIsTakeaway(false);
      setEditingOrderId(null);
      setEditingOrderStatus(null);
      setEditingOrderWhatsAppUnconfirmed(false);
      setShowCartMobile(false);
    } catch (error) {
      handleFirestoreError(error, editingOrderId ? OperationType.UPDATE : OperationType.CREATE, "orders");
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelActiveOrder = async () => {
    if (!editingOrderId) return;
    try {
      const userInfo = getLoggedUserForLog();
      const cancelLog = {
        action: 'Cancelación de pedido (Mesero)',
        timestamp: new Date().toISOString(),
        userId: userInfo.userId,
        userName: userInfo.userName,
        userRole: userInfo.userRole
      };

      await updateOfflineDoc("orders", editingOrderId, {
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
        movementLogs: arrayUnion(cancelLog)
      });
      toast.success("Pedido cancelado correctamente");
      
      // Clear state
      setCart([]);
      setTableNumber('');
      setNotes('');
      setIsTakeaway(false);
      setEditingOrderId(null);
      setEditingOrderStatus(null);
      setEditingOrderWhatsAppUnconfirmed(false);
      setShowCartMobile(false);
      setShowConfirmCancel(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "orders");
    }
  };

  const loadOrder = (order: Order) => {
    // Cargamos los items existentes para poder agregar más
    setCart(order.items);
    setTableNumber(order.tableNumber === 'Para Llevar' ? '' : order.tableNumber);
    setSubAccount(order.subAccount || '');
    setIsTakeaway(order.isTakeaway);
    setNotes(order.notes || '');
    setEditingOrderId(order.id);
    setEditingOrderStatus(order.status);
    setEditingOrderWhatsAppUnconfirmed(order.isTakeaway && order.whatsAppConfirmed === false);
    setShowActiveOrders(false);
    toast.success(order.isTakeaway ? "Editando pedido para llevar" : `Editando pedido de Mesa ${order.tableNumber}`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mex-green"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full md:flex-row overflow-hidden relative bg-mex-cream">
      {/* Products Section */}
      <div className="flex-1 flex flex-col p-3 md:p-6 min-h-0 overflow-hidden">
        <div className="flex flex-col gap-3 mb-4 md:mb-6 shrink-0">
          <div className="flex gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar antojito..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20 text-sm md:text-base shadow-sm bg-white font-medium"
              />
            </div>
            {/* View Mode Switcher (Grid/List) */}
            <div className="flex bg-white rounded-xl border border-stone-200 p-1 shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => {
                  setViewMode('list');
                  localStorage.setItem('orderViewMode', 'list');
                }}
                className={cn(
                  "p-2 rounded-lg transition-all border-none cursor-pointer flex items-center justify-center",
                  viewMode === 'list' ? "bg-stone-100 text-mex-green font-black" : "text-stone-400 hover:text-stone-600"
                )}
                title="Vista de Lista"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.6} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('grid');
                  localStorage.setItem('orderViewMode', 'grid');
                }}
                className={cn(
                  "p-2 rounded-lg transition-all border-none cursor-pointer flex items-center justify-center",
                  viewMode === 'grid' ? "bg-stone-100 text-mex-green font-black" : "text-stone-400 hover:text-stone-600"
                )}
                title="Vista de Cuadrícula"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.6} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 scroll-smooth">
            {categories.map(cat => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSearchQuery(''); // Clear search when selecting category
                }}
                className={cn(
                  "whitespace-nowrap px-4 py-2.5 h-10 rounded-full shadow-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95",
                  selectedCategory === cat.id ? "bg-mex-green text-white" : "bg-white text-stone-600 border border-stone-200"
                )}
              >
                <span className="text-sm shrink-0">{getCategoryEmoji(cat.name)}</span>
                <span>{cat.name}</span>
              </Button>
            ))}
            <Button
              key="otros"
              variant={selectedCategory === 'otros' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => {
                setSelectedCategory('otros');
                setSearchQuery(''); // Clear search when selecting category
              }}
              className={cn(
                "whitespace-nowrap px-4 py-2.5 h-10 rounded-full shadow-sm text-xs font-bold uppercase tracking-wider border border-stone-200 flex items-center gap-1.5 transition-all active:scale-95",
                selectedCategory === 'otros' ? "bg-mex-brown text-white" : "bg-white text-stone-600 hover:bg-stone-50"
              )}
            >
              <span className="text-sm shrink-0">🍽️</span>
              <span>Otros</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 overflow-y-auto pr-1 pb-24 md:pb-6 no-scrollbar">
            {(() => {
              if (selectedCategory === 'otros') {
                return (
                  <form onSubmit={handleAddCustomItem} className="bg-white rounded-2xl border border-stone-200 p-5 md:p-8 shadow-sm space-y-6">
                    <div className="border-b border-stone-100 pb-4">
                      <h3 className="text-xl font-serif text-mex-brown font-bold flex items-center gap-2">
                        <span>🍽️</span> Registrar Platillo Especial (Otros)
                      </h3>
                      <p className="text-xs text-stone-400 mt-1">Registra guisados, arroz o porciones para llevar con descripción y precio personalizado.</p>
                    </div>

                    <div className="space-y-4">
                      {/* Description / Content Input */}
                      <div className="space-y-1.5 align-left text-left">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block px-1 text-left">¿Qué llevan? (Descripción / Nombre del platillo)</label>
                        <input
                          type="text"
                          value={customItemName}
                          onChange={(e) => setCustomItemName(e.target.value)}
                          placeholder="Ej. Guisado de Chicharrón con Arroz, Frijoles..."
                          className="w-full px-4 py-3.5 bg-stone-50 rounded-xl border border-stone-200 focus:border-mex-brown focus:bg-white focus:ring-0 outline-none transition-all text-stone-800 placeholder-stone-400 font-bold"
                          autoComplete="off"
                        />
                      </div>

                      {/* Quick Suggestions */}
                      <div className="space-y-2 text-left">
                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-wider px-1 block text-left">Sugerencias rápidas (Toca para agregar):</span>
                        <div className="flex flex-wrap gap-1.5 justify-start">
                          {customSuggestions.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => handleSuggestionClick(sug)}
                              className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-stone-50 border border-stone-200 text-stone-600 hover:bg-mex-brown/5 hover:text-mex-brown hover:border-mex-brown/20 transition-all uppercase"
                            >
                              + {sug}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Price and Options Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                        {/* Price Input */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block px-1 text-left">Precio Cobrado ($ MXN)</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-black">$</span>
                            <input
                              type="number"
                              step="any"
                              value={customItemPrice}
                              onChange={(e) => setCustomItemPrice(e.target.value)}
                              placeholder="0.00"
                              className="w-full pl-8 pr-4 py-3.5 bg-stone-50 rounded-xl border border-stone-200 focus:border-mex-brown focus:bg-white focus:ring-0 outline-none transition-all text-stone-800 font-black text-lg"
                            />
                          </div>
                        </div>

                        {/* Station Selection */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block px-1 text-left">Destino a Cocinar (Impresión)</label>
                          <div className="grid grid-cols-2 gap-2 bg-stone-50 p-1.5 rounded-xl border border-stone-200">
                            <button
                              type="button"
                              onClick={() => setCustomItemStation('cocina')}
                              className={cn(
                                "py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                customItemStation === 'cocina'
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "bg-transparent text-stone-500 hover:text-stone-700"
                              )}
                            >
                              Cocina
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomItemStation('plancha')}
                              className={cn(
                                "py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                customItemStation === 'plancha'
                                  ? "bg-orange-500 text-white shadow-sm"
                                  : "bg-transparent text-stone-500 hover:text-stone-700"
                              )}
                            >
                              Parrilla
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Checkbox for To-Go option under the custom entry */}
                      <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex items-center justify-between text-left">
                        <div className="text-left">
                          <p className="text-xs font-black text-stone-700 uppercase tracking-wide">¿Es para llevar?</p>
                          <p className="text-[10px] text-stone-400">Si se marca, agregará automáticamente "(Para Llevar)" al nombre.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={customItemTakeaway}
                            onChange={(e) => setCustomItemTakeaway(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mex-green"></div>
                        </label>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full h-14 rounded-2xl bg-mex-green hover:bg-emerald-700 font-extrabold uppercase tracking-widest text-xs shadow-lg shadow-mex-green/20"
                      >
                        Agregar Platillo Especial al Carrito
                      </Button>
                    </div>
                  </form>
                );
              }

              const currentProducts = products.filter(p => {
                if (!p.available) return false;
                if (searchQuery) {
                  const query = searchQuery.toLowerCase();
                  return (p.name && p.name.toLowerCase().includes(query)) || 
                         (p.description && p.description.toLowerCase().includes(query));
                }
                return p.categoryId === selectedCategory;
              });
              
              if (currentProducts.length === 0) {
                return (
                  <div className="flex flex-col h-full min-h-[300px] items-center justify-center text-center p-8 bg-white/50 rounded-2xl border border-stone-100 border-dashed">
                    <div className="w-16 h-16 bg-stone-100 text-stone-300 rounded-full flex items-center justify-center mb-3">
                      <Utensils size={24} />
                    </div>
                    <h3 className="font-bold text-stone-500 mb-1">Sin productos</h3>
                    <p className="text-xs text-stone-400 max-w-[200px]">No hay platillos disponibles en esta categoría o búsqueda.</p>
                  </div>
                );
              }

              if (viewMode === 'grid') {
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 pb-12">
                    {currentProducts.map(product => {
                      const qty = getProductCartCount(product.id);
                      const requiresCustomization = isCustomizableProduct(product);
                      return (
                        <div 
                          key={product.id}
                          onClick={() => handleProductClick(product)}
                          className={cn(
                            "bg-white rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col relative select-none active:scale-[0.98]",
                            qty > 0 ? "border-mex-green/40 ring-1 ring-mex-green/20 bg-emerald-50/5" : "border-stone-200"
                          )}
                        >
                          {/* Quantity Badge */}
                          {qty > 0 && (
                            <div className="absolute top-2 right-2 bg-mex-green text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-scaleIn z-10">
                              {qty}
                            </div>
                          )}

                          {/* Image Banner */}
                          <div className="h-24 sm:h-28 bg-stone-100 flex items-center justify-center overflow-hidden relative shrink-0 border-b border-stone-100">
                            <img 
                              src={product.imageUrl || getFallbackProductImage(product.name)} 
                              alt={product.name} 
                              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" 
                              referrerPolicy="no-referrer" 
                            />
                          </div>

                          {/* Card Content */}
                          <div className="p-3 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="font-extrabold text-stone-800 text-xs sm:text-sm line-clamp-2 leading-snug tracking-tight mb-1" title={product.name}>
                                {product.name}
                              </h4>
                              <p className="text-[10px] text-stone-400 line-clamp-2 leading-tight mb-2">
                                {product.description || 'Delicioso platillo tradicional mexicano hecho al momento.'}
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-1 mt-auto pt-2 border-t border-stone-50">
                              <span className="font-black text-mex-terracotta text-sm sm:text-base">
                                {formatCurrency(product.price)}
                              </span>

                              {/* Quick controls */}
                              {qty > 0 && !requiresCustomization ? (
                                <div className="flex items-center bg-stone-100 rounded-full p-0.5 shadow-inner" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDecrementProduct(product, e)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 transition-all active:scale-90 cursor-pointer"
                                    title="Restar uno"
                                  >
                                    <Minus size={12} className="stroke-[3]" />
                                  </button>
                                  <span className="w-6 text-center font-black text-xs text-stone-800">{qty}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleIncrementProduct(product, e)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-mex-green text-white hover:bg-emerald-700 transition-all active:scale-90 cursor-pointer"
                                    title="Sumar uno"
                                  >
                                    <Plus size={12} className="stroke-[3]" />
                                  </button>
                                </div>
                              ) : qty > 0 && requiresCustomization ? (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center bg-stone-100 rounded-full p-0.5 shadow-inner">
                                    <button
                                      type="button"
                                      onClick={(e) => handleDecrementProduct(product, e)}
                                      className="w-6 h-6 flex items-center justify-center rounded-full bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 transition-all active:scale-90 cursor-pointer"
                                      title="Restar uno"
                                    >
                                      <Minus size={10} className="stroke-[3]" />
                                    </button>
                                    <span className="w-5 text-center font-black text-xs text-stone-800">{qty}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => handleIncrementProduct(product, e)}
                                      className="w-6 h-6 flex items-center justify-center rounded-full bg-mex-green text-white hover:bg-emerald-700 transition-all active:scale-90 cursor-pointer"
                                      title="Agregar otro de la última elección"
                                    >
                                      <Plus size={10} className="stroke-[3]" />
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedFillings([]);
                                      setHasExtraCheeseOpt(false);
                                      setCustomizeQuantity(1);
                                      setProductToCustomize(product);
                                    }}
                                    className="px-2 py-1 text-[9px] font-black uppercase tracking-wider rounded-full bg-mex-gold/10 border border-mex-gold/30 text-mex-gold hover:bg-mex-gold/20 transition-all cursor-pointer whitespace-nowrap"
                                    title="Elegir otra opción / relleno"
                                  >
                                    + Opción
                                  </button>
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-stone-100 text-mex-green flex items-center justify-center hover:bg-mex-green hover:text-white transition-all duration-150">
                                  <Plus size={16} className="stroke-[2.5]" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // List view
              return (
                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm divide-y divide-stone-100 pb-12">
                  {currentProducts.map(product => {
                    const qty = getProductCartCount(product.id);
                    const requiresCustomization = isCustomizableProduct(product);
                    return (
                      <div 
                        key={product.id}
                        onClick={() => handleProductClick(product)}
                        className={cn(
                          "p-3 flex items-center gap-3 hover:bg-stone-50 cursor-pointer active:bg-stone-100 transition-all select-none",
                          qty > 0 ? "bg-emerald-50/5" : ""
                        )}
                      >
                        {/* Image / Icon */}
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-stone-50 rounded-xl flex items-center justify-center text-stone-300 overflow-hidden shrink-0 border border-stone-100 relative">
                          <img 
                            src={product.imageUrl || getFallbackProductImage(product.name)} 
                            alt={product.name} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                          {qty > 0 && (
                            <div className="absolute inset-0 bg-mex-green/10 flex items-center justify-center">
                              <div className="bg-mex-green text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                                {qty}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Title and details */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-extrabold text-stone-800 text-sm leading-tight truncate">
                            {product.name}
                          </h3>
                          <p className="text-[10px] sm:text-xs text-stone-400 truncate pr-2 mt-0.5 leading-snug">
                            {product.description || 'Delicioso platillo tradicional hecho al momento.'}
                          </p>
                        </div>

                        {/* Price */}
                        <div className="text-right shrink-0 px-1">
                          <span className="font-black text-mex-terracotta text-sm sm:text-base block">
                            {formatCurrency(product.price)}
                          </span>
                        </div>

                        {/* Controls */}
                        <div className="shrink-0 pl-1 pr-1" onClick={(e) => e.stopPropagation()}>
                          {qty > 0 && !requiresCustomization ? (
                            <div className="flex items-center bg-stone-100 rounded-full p-0.5 shadow-inner">
                              <button
                                type="button"
                                onClick={(e) => handleDecrementProduct(product, e)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 transition-all active:scale-90 cursor-pointer"
                              >
                                <Minus size={14} className="stroke-[3]" />
                              </button>
                              <span className="w-6 text-center font-black text-xs text-stone-800">{qty}</span>
                              <button
                                type="button"
                                onClick={(e) => handleIncrementProduct(product, e)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-mex-green text-white hover:bg-emerald-700 transition-all active:scale-90 cursor-pointer"
                              >
                                <Plus size={14} className="stroke-[3]" />
                              </button>
                            </div>
                          ) : qty > 0 && requiresCustomization ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center bg-stone-100 rounded-full p-0.5 shadow-inner">
                                <button
                                  type="button"
                                  onClick={(e) => handleDecrementProduct(product, e)}
                                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 transition-all active:scale-90 cursor-pointer"
                                  title="Restar uno"
                                >
                                  <Minus size={12} className="stroke-[3]" />
                                </button>
                                <span className="w-5 text-center font-black text-xs text-stone-800">{qty}</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleIncrementProduct(product, e)}
                                  className="w-7 h-7 flex items-center justify-center rounded-full bg-mex-green text-white hover:bg-emerald-700 transition-all active:scale-90 cursor-pointer"
                                  title="Agregar otro de la última elección"
                                >
                                  <Plus size={12} className="stroke-[3]" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFillings([]);
                                  setHasExtraCheeseOpt(false);
                                  setCustomizeQuantity(1);
                                  setProductToCustomize(product);
                                }}
                                className="h-7 px-2.5 rounded-full bg-mex-gold text-white hover:bg-yellow-600 font-bold text-[9px] uppercase tracking-wider flex items-center justify-center shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                                title="Elegir otra opción / relleno"
                              >
                                + Opción
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleProductClick(product)}
                              className="w-8 h-8 rounded-full bg-stone-100 text-mex-green hover:bg-mex-green hover:text-white flex items-center justify-center transition-all duration-150 active:scale-90"
                            >
                              <Plus size={16} className="stroke-[2.5]" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
          })()}
          </div>
        </div>
      </div>

      {/* Mobile Cart Toggle Button */}
      <div 
        className="md:hidden fixed bottom-24 right-4 z-40 select-none"
        {...dragCart.dragProps}
      >
        <Button 
          variant="primary" 
          size="lg" 
          className="rounded-full w-14 h-14 shadow-2xl flex items-center justify-center p-0"
          onClick={(e) => {
            if (dragCart.hasMoved) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            setShowCartMobile(true);
          }}
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
        "fixed inset-0 z-[60] bg-white flex flex-col transition-transform duration-300 md:relative md:inset-auto md:translate-x-0 md:w-80 lg:w-96 md:border-l md:border-stone-200 md:shadow-xl",
        showCartMobile ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 border-b border-stone-100 flex flex-col gap-3 bg-stone-50 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ShoppingCart size={20} className="text-mex-green" />
              {editingOrderId ? 'Editar Pedido' : 'Nueva Comanda'}
            </h2>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-mex-brown gap-1 h-9 px-3 bg-white border border-stone-200 shadow-sm"
                onClick={() => setShowActiveOrders(!showActiveOrders)}
              >
                <History size={16} />
                Activos
              </Button>
              <button 
                className="md:hidden p-2 text-stone-400 hover:text-stone-600 bg-white rounded-full border border-stone-200 shadow-sm"
                onClick={() => setShowCartMobile(false)}
              >
                <X size={20} />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 shadow-sm">
              <input 
                type="checkbox" 
                checked={isTakeaway}
                onChange={(e) => setIsTakeaway(e.target.checked)}
                className="w-5 h-5 rounded border-stone-300 text-mex-green focus:ring-mex-green"
              />
              Para Llevar
            </label>
            {!isTakeaway && (
              <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-stone-400 uppercase">Mesa</span>
                  <input 
                    type="text" 
                    placeholder="#" 
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-10 text-center focus:outline-none font-bold text-mex-green"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {showActiveOrders && (
          <div className="absolute inset-0 bg-white z-[70] flex flex-col">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-mex-brown text-white shrink-0">
              <h3 className="font-serif">Pedidos Activos</h3>
              <button onClick={() => setShowActiveOrders(false)} className="p-1 hover:bg-white/10 rounded-full"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {activeOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                  <History size={48} className="mb-2" />
                  <p className="text-center text-stone-400">No hay pedidos activos</p>
                </div>
              ) : (
                activeOrders.map(order => {
                  const isUnconfirmed = order.isTakeaway && order.whatsAppConfirmed === false;
                  return (
                    <button 
                      key={order.id}
                      onClick={() => loadOrder(order)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border hover:border-mex-green hover:bg-mex-green/5 transition-all flex justify-between items-center",
                        isUnconfirmed 
                          ? "border-amber-300 bg-amber-50/20" 
                          : "border-stone-100 bg-stone-50/50"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-stone-800">{order.isTakeaway ? 'PARA LLEVAR' : `MESA ${order.tableNumber}`}</p>
                          {order.subAccount && (
                            <span className="px-1.5 py-0.5 bg-blue-100/80 text-blue-800 text-[9px] font-black uppercase tracking-wider rounded border border-blue-200">
                              {order.subAccount}
                            </span>
                          )}
                          {isUnconfirmed && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-700 text-[8px] font-black uppercase tracking-wider rounded">POR CONFIRMAR (WP)</span>
                          )}
                        </div>
                        <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">{order.items.length} productos • {formatCurrency(order.total)}</p>
                      </div>
                      <Plus size={18} className={cn(isUnconfirmed ? "text-amber-600" : "text-mex-green")} />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-300 py-10">
              <ShoppingCart size={48} className="mb-2 opacity-20" />
              <p className="font-medium">El carrito está vacío</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={`${item.productId}-${index}`} className={cn("flex flex-col gap-2 p-3 rounded-xl border border-stone-100", item.status === 'completed' ? "bg-stone-50/50 opacity-60" : "bg-white shadow-sm")}>
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className={cn("font-bold text-sm leading-tight", item.status === 'completed' ? "text-stone-500 line-through" : "text-stone-800")}>{item.name}</p>
                    <p className="text-[10px] text-stone-400 font-medium mt-0.5">{formatCurrency(item.price)} c/u</p>
                    {item.status === 'completed' && (
                      <span className="text-[8px] bg-stone-200 text-stone-600 px-1 py-0.5 rounded font-bold uppercase mt-1 inline-block">Entregado</span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-stone-800 whitespace-nowrap">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-stone-50">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => removeFromCart(item)}
                      disabled={item.status === 'completed'}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-30 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                    <button 
                      onClick={() => {
                        if (item.productId.startsWith('custom_')) {
                          setCart(prev => prev.map(cartItem => 
                            cartItem === item 
                              ? { ...cartItem, quantity: cartItem.quantity + 1 } 
                              : cartItem
                          ));
                        } else {
                          const product = products.find(p => p.id === item.productId);
                          if (product) {
                            const filling = item.fillings && item.fillings.length > 0
                              ? item.fillings
                              : parseFillingsFromItemName(item.name, product.name);
                            addToCart(product, item.hasExtraCheese || false, filling, 1);
                          }
                        }
                      }}
                      disabled={item.status === 'completed'}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-mex-green/10 hover:bg-mex-green/20 text-mex-green disabled:opacity-30 transition-colors cursor-pointer"
                      title="Agregar otro de la misma selección"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  
                  {item.notes && <p className="text-[10px] text-mex-red italic truncate max-w-[150px]">"{item.notes}"</p>}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-200 space-y-3 shrink-0 mb-20 md:mb-0">
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span className="text-mex-terracotta">{formatCurrency(total)}</span>
          </div>
          {editingOrderId && (
            <Button 
              variant="outline" 
              id="btn-cancelar-pedido-completo"
              className="w-full h-11 border-dashed border-red-300 hover:bg-red-50 text-red-600 font-extrabold text-xs uppercase tracking-wider mb-2 flex items-center justify-center gap-1 bg-white cursor-pointer"
              onClick={() => setShowConfirmCancel(true)}
            >
              <Trash2 size={16} />
              Cancelar Pedido Completo
            </Button>
          )}
          {editingOrderId && editingOrderWhatsAppUnconfirmed && (
            <Button 
              variant="primary" 
              className="w-full h-12 bg-amber-600 hover:bg-amber-700 font-extrabold text-xs uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/10 cursor-pointer"
              onClick={async () => {
                if (!editingOrderId) return;
                const toastId = toast.loading("Confirmando pedido...");
                try {
                  await updateDoc(doc(db, "orders", editingOrderId), {
                    whatsAppConfirmed: true,
                    updatedAt: new Date().toISOString()
                  });
                  
                  // Notify the customer on WhatsApp if the order is from WhatsApp
                  const currentOrder = activeOrders.find(o => o.id === editingOrderId);
                  if (currentOrder && currentOrder.waiterId && currentOrder.waiterId.startsWith("whatsapp-")) {
                    const cleanPhone = currentOrder.waiterId.replace("whatsapp-", "");
                    const notificationTxt = "👨‍🍳 *ACEPTADO:* Tu pedido ya fue aceptado por Las Cazuelas y está en espera en la cocina para ser preparado. ¡Te avisamos cuando iniciemos!";
                    try {
                      await addDoc(collection(db, "chats", cleanPhone, "messages"), {
                        sender: "staff",
                        text: notificationTxt,
                        timestamp: new Date().toISOString(),
                        status: "sent"
                      });
                      await updateDoc(doc(db, "chats", cleanPhone), {
                        lastMessage: notificationTxt,
                        lastMessageAt: new Date().toISOString(),
                        unreadCount: 0
                      });
                    } catch (err) {
                      console.error("Error sending WhatsApp notification:", err);
                    }
                  }

                  toast.success("¡Pedido confirmado y enviado a cocina!", { id: toastId });
                  setEditingOrderWhatsAppUnconfirmed(false);
                  
                  // Clear state
                  setCart([]);
                  setTableNumber('');
                  setNotes('');
                  setIsTakeaway(false);
                  setEditingOrderId(null);
                  setEditingOrderStatus(null);
                  setShowCartMobile(false);
                } catch (e) {
                  toast.dismiss(toastId);
                  handleFirestoreError(e, OperationType.UPDATE, "orders");
                }
              }}
            >
              <CheckCircle2 size={16} />
              Confirmar y Mandar a Cocina (WP)
            </Button>
          )}
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
              className="w-full h-12 flex items-center justify-center gap-2" 
              disabled={isSending || cart.length === 0 || (!isTakeaway && !tableNumber)}
              onClick={handleSendOrder}
            >
              {isSending ? (
                <>
                  <Loader2 className="animate-spin text-white" size={16} />
                  <span>Enviando...</span>
                </>
              ) : (
                editingOrderId ? 'Actualizar' : 'Enviar'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Dynamic Customization Modal */}
      {productToCustomize && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md border-stone-200 shadow-xl overflow-hidden">
            <CardHeader className="bg-mex-gold text-white flex items-center justify-between py-4 px-5">
              <h3 className="text-lg font-serif font-bold tracking-tight">
                {productToCustomize.name.toLowerCase().includes('quesadilla') 
                  ? 'Personalizar Quesadilla' 
                  : `Opciones para ${productToCustomize.name}`}
              </h3>
              <button 
                onClick={() => setProductToCustomize(null)}
                className="text-white/80 hover:text-white transition-colors"
              >
                ✕
              </button>
            </CardHeader>

            <CardContent className="p-5 space-y-5 bg-stone-50 max-h-[70vh] overflow-y-auto">
              {/* Existing customized selections for this product in current cart */}
              {(() => {
                const existingForProduct = cart.filter(i => i.productId === productToCustomize.id && i.status !== 'completed');
                if (existingForProduct.length === 0) return null;

                return (
                  <div className="bg-amber-50/90 border border-amber-200 p-3 rounded-xl space-y-2">
                    <p className="text-[11px] font-black uppercase text-amber-900 tracking-wider flex items-center justify-between">
                      <span>Ya agregaste a esta comanda:</span>
                      <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-[10px]">
                        {existingForProduct.reduce((sum, item) => sum + item.quantity, 0)} piezas
                      </span>
                    </p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {existingForProduct.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-amber-200 shadow-2xs">
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-stone-800 truncate">{item.name}</p>
                            <p className="text-[10px] text-stone-400 font-medium">{formatCurrency(item.price)} c/u</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md text-[11px]">
                              x{item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const filling = item.fillings && item.fillings.length > 0
                                  ? item.fillings
                                  : parseFillingsFromItemName(item.name, productToCustomize.name);
                                addToCart(productToCustomize, item.hasExtraCheese || false, filling, 1);
                                toast.success(`+1 ${item.name}`);
                              }}
                              className="px-2 py-1 bg-mex-green text-white font-black rounded-md text-[10px] hover:bg-emerald-700 transition-all active:scale-95 cursor-pointer shadow-xs"
                              title="Agregar 1 más de esta combinación"
                            >
                              +1 Igual
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-stone-600 uppercase tracking-wider block">
                    Selecciona Ingredientes
                  </label>
                  <span className="text-[10px] bg-mex-gold/20 text-stone-800 font-bold px-2 py-0.5 rounded-full">
                    {selectedFillings.length} seleccionado{selectedFillings.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Live selection preview banner */}
                {selectedFillings.length > 0 && (
                  <div className="bg-white p-2.5 rounded-xl border border-stone-200 shadow-2xs flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold text-stone-400 uppercase mr-1">Relleno:</span>
                    {selectedFillings.map(f => (
                      <span key={f} className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-lg border border-amber-300">
                        ✓ {f}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Sencillo', label: 'Sencillo', icon: '🍽️' },
                    { id: 'Tradicional', label: 'Tradicional', icon: '🌮' },
                    { id: 'Bistec (Res)', label: 'Bistec (Res)', icon: '🥩' },
                    { id: 'Pollo', label: 'Pollo', icon: '🍗' },
                    { id: 'Longaniza', label: 'Longaniza', icon: '🌭' },
                    { id: 'Campechano (Bistec y Longaniza)', label: 'Campechano (Bistec y Longaniza)', icon: '🔥' },
                    { id: 'Queso Extra', label: 'Queso Extra (+$8)', icon: '🧀' },
                    { id: 'Chicharrón', label: 'Chicharrón', icon: '🥓' },
                    { id: 'Tinga de Pollo', label: 'Tinga de Pollo', icon: '🍗' },
                    { id: 'Tinga de Res', label: 'Tinga de Res', icon: '🥩' },
                    { id: 'Papas con Longaniza', label: 'Papas con Longaniza', icon: '🌭' },
                    { id: 'Champiñones', label: 'Champiñones', icon: '🍄' },
                    { id: 'Huevo', label: 'Huevo', icon: '🍳' },
                  ].map((filling) => {
                    const isSelected = selectedFillings.includes(filling.id);
                    return (
                      <button
                        key={filling.id}
                        type="button"
                        onClick={() => toggleFilling(filling.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all duration-150 text-left relative ${
                          isSelected
                            ? 'bg-mex-gold/15 border-mex-gold text-stone-900 font-black shadow-xs ring-2 ring-mex-gold/40'
                            : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl shrink-0">{filling.icon}</span>
                          <span className="text-xs font-bold leading-tight truncate">{filling.label}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                          isSelected ? 'bg-mex-gold text-white shadow-3xs' : 'border border-stone-300 bg-stone-100 text-transparent'
                        }`}>
                          ✓
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-stone-200/60 pt-4 space-y-3">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                  Extras
                </label>
                <button
                  type="button"
                  onClick={toggleExtraCheeseButton}
                  className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                    (hasExtraCheeseOpt || selectedFillings.includes('Queso Extra'))
                      ? 'bg-yellow-50/80 border-amber-400 text-amber-900 font-bold shadow-xs'
                      : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🧀</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Queso / Quesillo Extra</p>
                      <p className="text-[10px] text-stone-500 font-normal">Agrega doble queso fundido</p>
                    </div>
                  </div>
                  <span className="text-sm bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg font-bold">
                    +$8 pesos
                  </span>
                </button>
              </div>
            </CardContent>

            <CardFooter className="flex items-center gap-2 bg-white p-4 border-t border-stone-100">
              <Button 
                variant="outline" 
                className="px-3" 
                onClick={() => setProductToCustomize(null)}
              >
                Cancelar
              </Button>

              <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setCustomizeQuantity(prev => Math.max(1, prev - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-700 font-bold active:scale-95 cursor-pointer"
                  title="Restar cantidad"
                >
                  <Minus size={14} />
                </button>
                <span className="w-7 text-center font-black text-sm text-stone-900">{customizeQuantity}</span>
                <button
                  type="button"
                  onClick={() => setCustomizeQuantity(prev => prev + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-700 font-bold active:scale-95 cursor-pointer"
                  title="Sumar cantidad"
                >
                  <Plus size={14} />
                </button>
              </div>

              <Button 
                variant="primary" 
                disabled={selectedFillings.length === 0}
                className="flex-1 bg-mex-gold hover:bg-yellow-600 border-mex-gold text-white font-bold disabled:opacity-50 cursor-pointer text-xs" 
                onClick={() => {
                  const effectiveHasExtra = hasExtraCheeseOpt || selectedFillings.includes('Queso Extra');
                  addToCart(productToCustomize, effectiveHasExtra, selectedFillings, customizeQuantity);
                  setProductToCustomize(null);
                }}
              >
                Agregar {customizeQuantity > 1 ? `(${customizeQuantity}) ` : ''}{formatCurrency((productToCustomize.price + ((hasExtraCheeseOpt || selectedFillings.includes('Queso Extra')) ? 8 : 0)) * customizeQuantity)}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Order Cancellation Confirmation Modal */}
      {showConfirmCancel && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm border-stone-200">
            <CardHeader className="bg-mex-red text-white flex items-center gap-2">
              <Trash2 size={20} />
              <h3 className="text-lg font-serif">¿Cancelar esta comanda?</h3>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-center bg-white">
              <div className="mx-auto w-16 h-16 bg-red-50 text-mex-red rounded-full flex items-center justify-center mb-2">
                <Trash2 size={32} />
              </div>
              <p className="text-stone-700 font-medium text-sm">
                ¿Estás seguro de que deseas cancelar este pedido completo?
              </p>
              <p className="text-stone-400 text-xs leading-relaxed">
                Esta acción no borrará físicamente el registro, sino que lo marcará como "cancelado" para conservar un historial de operaciones honesto.
              </p>
            </CardContent>
            <CardFooter className="flex gap-3 bg-stone-50 border-t border-stone-100 p-4">
              <Button 
                variant="outline" 
                className="flex-1 font-bold col-span-1" 
                onClick={() => setShowConfirmCancel(false)}
              >
                No, Volver
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 gap-2 bg-mex-red hover:bg-red-700 border-mex-red text-white font-extrabold col-span-1 shadow-md shadow-red-200" 
                onClick={handleCancelActiveOrder}
              >
                Sí, Cancelar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
