import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, User, Phone, MapPin, Mail, BookOpen, Search, Send, 
  Check, CheckCheck, Trash2, Edit2, Plus, Minus, ShoppingBag, 
  ArrowLeft, Clock, MessageCircle, ExternalLink, SlidersHorizontal, 
  Sparkles, CheckCircle2, DollarSign, Filter, RefreshCw, X, FileText, AlertCircle, Loader2,
  ChevronRight, ShieldCheck, ChefHat, Package, Bike
} from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader } from "./Card";
import { db } from "../firebase";
import { 
  collection, query, orderBy, onSnapshot, addDoc, setDoc, 
  updateDoc, deleteDoc, doc, where, limit, runTransaction, getDocs,
  increment
} from "firebase/firestore";
import { Order, Product, Category, Client, ChatChannel, ChatMessage } from "../types";
import { formatCurrency, cn } from "@/src/lib/utils";
import toast from "react-hot-toast";
import { useBranding } from "../lib/useBranding";
import { getFallbackProductImage } from "../lib/presetImages";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

import { auth as firebaseAuth } from "../firebase";

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth.currentUser ? firebaseAuth.currentUser.uid : "unauthenticated-client-or-staff",
      isAnonymous: firebaseAuth.currentUser ? firebaseAuth.currentUser.isAnonymous : null
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface WhatsAppInternoProps {
  userRole: string;
  mode?: 'staff' | 'client';
}

export default function WhatsAppInternoView({ userRole, mode = 'staff' }: WhatsAppInternoProps) {
  const { branding } = useBranding();
  // Navigation tabs: 'chat' | 'clients' | 'portal_sim'
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'clients' | 'portal_sim'>(mode === 'client' ? 'portal_sim' : 'chat');

  // --- Real-time Data States (Firestore) ---
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [chats, setChats] = useState<ChatChannel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [chatToDelete, setChatToDelete] = useState<ChatChannel | null>(null);
  
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [staffMobileView, setStaffMobileView] = useState<'list' | 'chat'>('list');

  // Message compose input
  const [newMessageText, setNewMessageText] = useState("");
  
  // Chat viewport scroll ref
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // --- Client Management Modal/Form State ---
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientFormName, setClientFormName] = useState("");
  const [clientFormPhone, setClientFormPhone] = useState("");
  const [clientFormEmail, setClientFormEmail] = useState("");
  const [clientFormAddress, setClientFormAddress] = useState("");
  const [clientFormNotes, setClientFormNotes] = useState("");

  // --- Customer Portal Simulator State (The ordering form for clients) ---
  const [portalStep, setPortalStep] = useState<'auth' | 'menu' | 'cart' | 'chat' | 'success'>('auth');
  const [portalClientName, setPortalClientName] = useState("");
  const [portalClientPhone, setPortalClientPhone] = useState("");
  const [portalClientAddress, setPortalClientAddress] = useState("");
  const [portalCart, setPortalCart] = useState<{ product: Product; quantity: number; notes: string }[]>([]);
  const [portalNotes, setPortalNotes] = useState("");
  const [portalMenuCategory, setPortalMenuCategory] = useState("");
  const [createdOrderFolio, setCreatedOrderFolio] = useState("");
  const [portalSearchProduct, setPortalSearchProduct] = useState("");
  const [lastWhatsAppText, setLastWhatsAppText] = useState("");
  const [portalActiveOrderId, setPortalActiveOrderId] = useState<string>("");
  const [isPortalSending, setIsPortalSending] = useState(false);

  // --- Session Persistence logic ---
  useEffect(() => {
    if (mode === 'client') {
      const savedName = localStorage.getItem('portal_client_name');
      const savedPhone = localStorage.getItem('portal_client_phone');
      const savedAddress = localStorage.getItem('portal_client_address') || "";
      
      if (savedName && savedPhone) {
        setPortalClientName(savedName);
        setPortalClientPhone(savedPhone);
        setPortalClientAddress(savedAddress);
        
        // Auto-login to menu step, allowing user to place order first
        setPortalStep(currentStep => currentStep === 'auth' ? 'menu' : currentStep);

        const cleanedPhone = savedPhone.replace(/\D/g, "");
        const clientOrders = activeOrders
          .filter(o => o.isTakeaway && o.waiterId === `whatsapp-${cleanedPhone}`)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        const mostRecentOrder = clientOrders[0];
        const isOngoing = mostRecentOrder && !(
          mostRecentOrder.status === 'cancelled' ||
          mostRecentOrder.status === 'paid' ||
          mostRecentOrder.status === 'finished' ||
          mostRecentOrder.isPaid ||
          (mostRecentOrder.isDelivered && mostRecentOrder.isPaid)
        );

        if (isOngoing) {
          setPortalActiveOrderId(mostRecentOrder.id);
        } else {
          // If the most recent order is cancelled or completed, we do NOT want it to be active for the customer when they re-enter or are on login steps.
          setPortalActiveOrderId(prevId => {
            if (portalStep === 'auth' || portalStep === 'menu' || !portalStep) {
              return "";
            }
            return prevId;
          });
        }
      }
    }
  }, [mode, activeOrders, portalStep]);
  const [portalMessages, setPortalMessages] = useState<ChatMessage[]>([]);
  const [portalNewMessageText, setPortalNewMessageText] = useState("");
  const portalMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // --- Active Order Detail Sidebar (Inside Operator panel) ---
  const selectedChat = chats.find(c => c.id === selectedChatId);
  const selectedChatActiveOrder = activeOrders.find(o => o.id === selectedChat?.activeOrderId);

  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  useEffect(() => {
    setCancellingOrderId(null);
  }, [selectedChatId]);

  // 1. Fetch products & categories
  useEffect(() => {
    const unsubCats = onSnapshot(query(collection(db, "categories"), orderBy("order", "asc")), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
      if (cats.length > 0 && !portalMenuCategory) {
        setPortalMenuCategory(cats[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "categories");
    });

    const unsubProds = onSnapshot(query(collection(db, "products"), orderBy("name", "asc")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products");
    });

    const unsubClients = onSnapshot(query(collection(db, "clients"), orderBy("createdAt", "desc")), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "clients");
    });

    const unsubChats = onSnapshot(query(collection(db, "chats"), orderBy("lastMessageAt", "desc")), (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatChannel)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "chats");
    });

    // Listen to takeaway active orders
    const unsubOrders = onSnapshot(
      query(collection(db, "orders"), where("isTakeaway", "==", true)), 
      (snapshot) => {
        setActiveOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "orders");
      }
    );

    return () => {
      unsubCats();
      unsubProds();
      unsubClients();
      unsubChats();
      unsubOrders();
    };
  }, []);

  // 2. Fetch messages when a chat is selected
  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    const unsubMessages = onSnapshot(
      query(collection(db, "chats", selectedChatId, "messages"), orderBy("timestamp", "asc")),
      (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
        
        // Auto mark as read (clear unread count on staff open)
        // We also check against the database directly if needed, but here we do it based on the document
        const chatInList = chats.find(c => c.id === selectedChatId);
        if (chatInList && chatInList.unreadCount > 0) {
          updateDoc(doc(db, "chats", selectedChatId), {
            unreadCount: 0
          }).catch(err => console.error("Error resetting unreadCount:", err));
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `chats/${selectedChatId}/messages`);
      }
    );

    return () => unsubMessages();
  }, [selectedChatId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen to portal messages in real-time
  useEffect(() => {
    if (!portalClientPhone || portalStep !== 'chat') {
      setPortalMessages([]);
      return;
    }
    const cleanPhone = portalClientPhone.replace(/\D/g, "");
    const unsub = onSnapshot(
      query(collection(db, "chats", cleanPhone, "messages"), orderBy("timestamp", "asc")),
      (snapshot) => {
        setPortalMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
      },
      (error) => {
        console.error("Error listening to portal messages:", error);
      }
    );
    return () => unsub();
  }, [portalClientPhone, portalStep]);

  // Scroll to bottom on portal messages update
  useEffect(() => {
    portalMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [portalMessages]);

  // Preset quick message templates for WhatsApp staff operator
  const quickTemplates = [
    "🍳 ¡Hola! Recibimos tu pedido. Ya se encuentra en cocina en preparación.",
    "🔔 ¡Tu pedido de Las Cazuelas está listo para retirar! Puedes pasar por él.",
    "🌟 ¡Muchas gracias por tu compra! Tu pedido fue entregado e ingresado a caja.",
    "Hola, ¿cómo estás? Te compartimos nuestro menú digital actual para ordenar. 🧾",
    "Sentimos el retraso, en un momento te confirmamos."
  ];

  // --- Handlers: Clients Directory ---
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientFormName || !clientFormPhone) {
      toast.error("Nombre y Teléfono son requeridos");
      return;
    }

    const formattedPhone = clientFormPhone.replace(/\D/g, "");
    if (formattedPhone.length < 10) {
      toast.error("El teléfono debe contar con al menos 10 dígitos numéricos");
      return;
    }

    try {
      if (selectedClient) {
        // Update
        const clientRef = doc(db, "clients", selectedClient.id);
        await updateDoc(clientRef, {
          name: clientFormName,
          phone: formattedPhone,
          email: clientFormEmail,
          address: clientFormAddress,
          notes: clientFormNotes,
        });
        toast.success("Cliente actualizado exitosamente");
      } else {
        // Create
        const clientRef = doc(db, "clients", formattedPhone);
        await setDoc(clientRef, {
          id: formattedPhone,
          name: clientFormName,
          phone: formattedPhone,
          email: clientFormEmail,
          address: clientFormAddress,
          notes: clientFormNotes,
          createdAt: new Date().toISOString(),
          orderCount: 0,
          totalPaid: 0
        });
        toast.success("Cliente registrado con éxito");
      }
      setIsClientFormOpen(false);
      setSelectedClient(null);
      clearClientForm();
    } catch (err) {
      handleFirestoreError(err, selectedClient ? OperationType.UPDATE : OperationType.CREATE, "clients");
    }
  };

  const handleEditClientClick = (client: Client) => {
    setSelectedClient(client);
    setClientFormName(client.name);
    setClientFormPhone(client.phone);
    setClientFormEmail(client.email || "");
    setClientFormAddress(client.address || "");
    setClientFormNotes(client.notes || "");
    setIsClientFormOpen(true);
  };

  const clearClientForm = () => {
    setSelectedClient(null);
    setClientFormName("");
    setClientFormPhone("");
    setClientFormEmail("");
    setClientFormAddress("");
    setClientFormNotes("");
  };

  const handleConfirmDeleteClient = async () => {
    if (!clientToDelete) return;
    try {
      await deleteDoc(doc(db, "clients", clientToDelete.id));
      toast.success("Cliente eliminado exitosamente");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `clients/${clientToDelete.id}`);
    } finally {
      setClientToDelete(null);
    }
  };

  const handleConfirmDeleteChat = async () => {
    if (!chatToDelete) return;
    try {
      // Deleting subcollection messages
      const messagesRef = collection(db, "chats", chatToDelete.id, "messages");
      const msgsSnap = await getDocs(messagesRef);
      const deletePromises = msgsSnap.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);

      // Delete main chat document
      await deleteDoc(doc(db, "chats", chatToDelete.id));
      toast.success("Conversación eliminada exitosamente");
      
      if (selectedChatId === chatToDelete.id) {
        setSelectedChatId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chats/${chatToDelete.id}`);
    } finally {
      setChatToDelete(null);
    }
  };

  // --- Handlers: WhatsApp Chat Box ---
  const handleSendMessage = async () => {
    if (!selectedChatId || !newMessageText.trim()) return;
    const txt = newMessageText.trim();
    setNewMessageText("");

    try {
      // Add message
      await addDoc(collection(db, "chats", selectedChatId, "messages"), {
        sender: "staff",
        text: txt,
        timestamp: new Date().toISOString(),
        status: "sent"
      });

      // Update Channel last message
      await updateDoc(doc(db, "chats", selectedChatId), {
        lastMessage: txt,
        lastMessageAt: new Date().toISOString()
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${selectedChatId}/messages`);
    }
  };

  // Click quick response templates
  const applyTemplate = (txt: string) => {
    setNewMessageText(txt);
  };

  // Trigger Client chat window directly from clients section
  const handleStartChatFromClient = async (client: Client) => {
    try {
      const chatId = client.phone;
      const initialMsg = "¡Hola! Bienvenido a nuestro canal de WhatsApp para llevar. ¿En qué podemos ayudarte hoy? 🍳";
      
      await setDoc(doc(db, "chats", chatId), {
        id: chatId,
        clientName: client.name,
        clientPhone: client.phone,
        lastMessage: initialMsg,
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
        status: 'open'
      }, { merge: true });

      // Add actual message document so client and operator can see the chat history immediately
      await addDoc(collection(db, "chats", chatId, "messages"), {
        sender: "staff",
        text: initialMsg,
        timestamp: new Date().toISOString(),
        status: "sent"
      });

      setSelectedChatId(chatId);
      setActiveSubTab('chat');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "chats");
    }
  };

  // --- Handlers: CLIENT SIMULATOR PORTAL (PLACING ORDERS) ---
  const handleClientPortalAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalClientPhone) {
      toast.error("Por favor ingresa tu número de WhatsApp");
      return;
    }

    const cleanedPhone = portalClientPhone.replace(/\D/g, "");
    if (cleanedPhone.length < 10) {
      toast.error("Por favor ingresa un número de teléfono de 10 dígitos válido");
      return;
    }

    // Check if customer is already registered (in list)
    const existingClient = clients.find(c => c.phone === cleanedPhone);

    let finalName = portalClientName;
    let finalAddress = portalClientAddress;

    if (existingClient) {
      finalName = existingClient.name;
      finalAddress = existingClient.address || "";
      setPortalClientName(finalName);
      setPortalClientAddress(finalAddress);
    } else {
      // If NOT registered, we MUST have name and address/location filled out
      if (!finalName.trim() || !finalAddress.trim()) {
        toast.error("Por favor completa tu Nombre y Ubicación para registrarte.");
        return;
      }
    }

    // Save to local storage for session persistence
    localStorage.setItem('portal_client_name', finalName);
    localStorage.setItem('portal_client_phone', cleanedPhone);
    localStorage.setItem('portal_client_address', finalAddress);

    // Save/Get client record
    try {
      const clientDocRef = doc(db, "clients", cleanedPhone);
      
      if (!existingClient) {
        // Register new customer in database
        await setDoc(clientDocRef, {
          id: cleanedPhone,
          name: finalName,
          phone: cleanedPhone,
          address: finalAddress,
          createdAt: new Date().toISOString(),
          orderCount: 0,
          totalPaid: 0,
        });
      }

      // Check if client has an ONGOING active order (takeaway order not yet finished)
      // Keep track of it so we can offer a tracking button in the menu, but always land on 'menu' first as requested.
      const clientOrders = activeOrders
        .filter(o => o.isTakeaway && o.waiterId === `whatsapp-${cleanedPhone}`)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const mostRecentOrder = clientOrders[0];
      const isOngoing = mostRecentOrder && !(
        mostRecentOrder.status === 'cancelled' ||
        mostRecentOrder.status === 'paid' ||
        mostRecentOrder.status === 'finished' ||
        mostRecentOrder.isPaid ||
        (mostRecentOrder.isDelivered && mostRecentOrder.isPaid)
      );

      if (isOngoing) {
        setPortalActiveOrderId(mostRecentOrder.id);
      } else {
        setPortalActiveOrderId("");
      }
      
      setPortalStep('menu');
      toast.success(`¡Bienvenido, ${finalName}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "clients");
    }
  };

  const addToPortalCart = (product: Product) => {
    const existing = portalCart.find(item => item.product.id === product.id);
    if (existing) {
      setPortalCart(portalCart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setPortalCart([...portalCart, { product, quantity: 1, notes: "" }]);
    }
    toast.success(`${product.name} agregado`);
  };

  const updatePortalCartQty = (prodId: string, delta: number) => {
    setPortalCart(portalCart.map(item => {
      if (item.product.id === prodId) {
        const nextQty = item.quantity + delta;
        return nextQty > 0 ? { ...item, quantity: nextQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const updatePortalCartNotes = (prodId: string, notes: string) => {
    setPortalCart(portalCart.map(item => 
      item.product.id === prodId ? { ...item, notes } : item
    ));
  };

  const totalPortalCartPrice = portalCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  // Submit client order from portal simulator
  const handlePortalSubmitOrder = async () => {
    if (portalCart.length === 0) {
      toast.error("Tu carrito de pedido está vacío");
      return;
    }
    if (isPortalSending) return;

    const cleanPhone = portalClientPhone.replace(/\D/g, "");

    setIsPortalSending(true);
    try {
      toast.loading("Enviando orden...", { id: "p-order" });
      
      // Get consecutivo
      let consecutive = 1;
      // Standard POS consecutive
      const counterRef = doc(db, "counters", "orders");
      try {
        await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (counterDoc.exists()) {
            consecutive = (counterDoc.data().count || 0) + 1;
            transaction.update(counterRef, { count: consecutive });
          } else {
            transaction.set(counterRef, { count: 1 });
            consecutive = 1;
          }
        });
      } catch (e) {
        consecutive = Math.floor(Math.random() * 900) + 100;
      }

      // Format custom folio
      const date = new Date();
      const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
      const dayLetter = days[date.getDay()];
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const paddedConsecutive = consecutive.toString().padStart(3, '0');
      const folio = `${dayLetter}${hours}${minutes}-LL-${paddedConsecutive}`;

      // Build Order format
      const clientItems = portalCart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        notes: item.notes || "",
        status: 'pending' as const,
        station: item.product.station || 'cocina' as const
      }));

      const orderData = {
        folio,
        tableNumber: "LL", // Takeaway code
        status: "pending",
        items: clientItems,
        total: totalPortalCartPrice,
        isTakeaway: true,
        takeawayFee: 0,
        clientName: portalClientName,
        clientAddress: portalClientAddress,
        notes: portalNotes || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        waiterId: `whatsapp-${cleanPhone}`,
        waiterName: `📱 Clte: ${portalClientName}`,
        whatsAppConfirmed: false,
        isDelivered: false,
        isPaid: false,
      };

      // 1. Add order doc
      const orderRef = await addDoc(collection(db, "orders"), orderData);
      
      toast.success("¡Pedido enviado con éxito!", { id: "p-order" });
      
      // Auto-clear unread if the chat was reused
      await updateDoc(doc(db, "chats", cleanPhone), {
        unreadCount: 0
      }).catch(() => {});
      
      // 2. Increment client orders counts
      const clientDocRef = doc(db, "clients", cleanPhone);
      await runTransaction(db, async (transaction) => {
        const clientDoc = await transaction.get(clientDocRef);
        if (clientDoc.exists()) {
          const currentCount = clientDoc.data().orderCount || 0;
          const currentPaidTotal = clientDoc.data().totalPaid || 0;
          transaction.update(clientDocRef, {
            orderCount: currentCount + 1,
            totalPaid: currentPaidTotal + totalPortalCartPrice
          });
        }
      });

      // 3. Generate beautiful WhatsApp receipt summary text
      let menuSummaryString = "";
      portalCart.forEach(item => {
        menuSummaryString += `•  ${item.quantity}x ${item.product.name} - $${item.product.price * item.quantity} pesos ${item.notes ? `(Nota: ${item.notes})` : ""}\n`;
      });
      
      const trackingUrl = `${window.location.origin}/?portal&id=${orderRef.id}`;
      const whatsappFormattedText = `*🔔 NUEVO PEDIDO PARA LLEVAR*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Cliente:* ${portalClientName}\n📞 *WhatsApp:* ${cleanPhone}\n📍 *Ubicación:* ${portalClientAddress || 'No especificada'}\n🧾 *Folio:* ${folio}\n━━━━━━━━━━━━━━━━━━━━\n📋 *Detalle del Pedido:*\n${menuSummaryString}\n💰 *TOTAL:* $${totalPortalCartPrice} pesos\n📌 *Notas:* ${portalNotes || 'Ninguna'}\n\n*🔍 RASTREA TU PEDIDO AQUÍ:*\n${trackingUrl}\n\n*¡Listo! Tu pedido ha sido enviado a cocina. Te enviaremos los datos para pago por transferencia en cuanto esté listo.* 🙏`;

      // 4. Create chat record
      await setDoc(doc(db, "chats", cleanPhone), {
        id: cleanPhone,
        clientName: portalClientName,
        clientPhone: cleanPhone,
        lastMessage: `🛒 Folio ${folio} por $${totalPortalCartPrice} pesos.`,
        lastMessageAt: new Date().toISOString(),
        unreadCount: 1,
        status: 'open',
        activeOrderId: orderRef.id
      }, { merge: true });

      // 5. Build chat message doc
      await addDoc(collection(db, "chats", cleanPhone, "messages"), {
        sender: "client",
        text: whatsappFormattedText,
        timestamp: new Date().toISOString(),
        status: "sent",
        orderId: orderRef.id
      });

      setCreatedOrderFolio(folio);
      setLastWhatsAppText(whatsappFormattedText);
      setPortalActiveOrderId(orderRef.id);
      setPortalStep('success');
      setPortalCart([]);
      setPortalNotes("");
      
      toast.success("¡Pedido creado y enviado vía WhatsApp simulado!", { id: "p-order" });
    } catch (err) {
      toast.dismiss("p-order");
      handleFirestoreError(err, OperationType.CREATE, "orders");
    } finally {
      setIsPortalSending(false);
    }
  };

  const handleSendPortalMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!portalNewMessageText.trim() || !portalClientPhone) return;

    const cleanPhone = portalClientPhone.replace(/\D/g, "");
    const msgText = portalNewMessageText;
    setPortalNewMessageText("");

    try {
      // 1. Add message document to direct subcollection
      await addDoc(collection(db, "chats", cleanPhone, "messages"), {
        sender: "client",
        text: msgText,
        timestamp: new Date().toISOString(),
        status: "sent"
      });

      // 2. Updated chat channel meta so staff operator is notified
      await updateDoc(doc(db, "chats", cleanPhone), {
        lastMessage: msgText,
        lastMessageAt: new Date().toISOString(),
        unreadCount: increment(1)
      });
    } catch (err) {
      console.error("Error sending client portal message:", err);
    }
  };

  // --- Quick change order status helper inside the Chat view ---
  const handleQuickUpdateOrderStatus = async (orderId: string, nextStatus: Order['status']) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: nextStatus,
        whatsAppConfirmed: true, // Mark confirmed when accepted or changed
        updatedAt: new Date().toISOString()
      });
      toast.success(`Órden de entrega actualizada a: ${nextStatus}`);

      // Send a text notifications informing the client about this status change automatically
      let notificationTxt = "";
      if (nextStatus === 'preparing') {
        notificationTxt = `🍳 *CONSIGNACIÓN:* Tu pedido de ${branding.appName} ya se encuentra en cocina y ya lo están preparando.`;
      } else if (nextStatus === 'ready') {
        notificationTxt = `🔔 *AVISO:* ¡Felicidades! Tu pedido de ${branding.appName} ya se encuentra listo para retirar en local.\n\n*🏦 DATOS PARA TRANSFERENCIA :*\n🏦 *Banco:* BBVA\n👤 *Nombre:* Antonieta Abigail Villagómez\n💳 *CTA:* 4152 3135 1505 5627\n\n*¡Listo! Por favor envíanos tu comprobante de pago.* 🙏`;
      } else if (nextStatus === 'served') {
        notificationTxt = "🚗 *ENTREGADO:* Tu pedido ha sido entregado oficialmente. ¡Muchisimas gracias!";
      } else if (nextStatus === 'paid') {
        notificationTxt = "💳 *CIERRE:* Recibimos tu pago correctamente. El pedido está completado y liquidado.";
      }

      if (notificationTxt && selectedChatId) {
        await addDoc(collection(db, "chats", selectedChatId, "messages"), {
          sender: "staff",
          text: notificationTxt,
          timestamp: new Date().toISOString(),
          status: "sent"
        });
        await updateDoc(doc(db, "chats", selectedChatId), {
          lastMessage: notificationTxt,
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  // --- Toggle delivery or payment separately for WhatsApp orders ---
  const handleToggleDeliveryOrPayment = async (orderId: string, type: 'delivery' | 'payment') => {
    try {
      const orderDoc = activeOrders.find(o => o.id === orderId);
      if (!orderDoc) return;

      const currentDelivered = !!(orderDoc.isDelivered || orderDoc.status === 'served' || orderDoc.status === 'paid' && orderDoc.isDelivered);
      const currentPaid = !!(orderDoc.isPaid || orderDoc.status === 'paid');

      let nextDelivered = currentDelivered;
      let nextPaid = currentPaid;

      if (type === 'delivery') {
        nextDelivered = true;
      } else if (type === 'payment') {
        nextPaid = true;
      }

      // Determine next overall order status
      let nextStatus: Order['status'] = 'ready';
      if (nextDelivered && nextPaid) {
        nextStatus = 'paid';
      } else if (nextDelivered) {
        nextStatus = 'served';
      } else if (nextPaid) {
        nextStatus = 'paid';
      }

      await updateDoc(doc(db, "orders", orderId), {
        isDelivered: nextDelivered,
        isPaid: nextPaid,
        status: nextStatus,
        whatsAppConfirmed: true,
        updatedAt: new Date().toISOString()
      });

      toast.success(
        type === 'delivery' 
          ? "¡Pedido marcado como ENTREGADO!" 
          : "¡Pedido marcado como PAGADO / LIQUIDADO!"
      );

      // Send a text notifications informing the client about this status change automatically
      let notificationTxt = "";
      if (nextDelivered && nextPaid) {
        notificationTxt = "✅ ¡Muchas gracias! Tu pedido ha sido ENTREGADO y COBRADO correctamente. Esperamos verte pronto en Las Cazuelas. 🙏";
      } else if (type === 'delivery') {
        notificationTxt = "🚗 *ENTREGADO:* Tu pedido ya fue entregado. Recuerda liquidar tu transferencia si aún no lo has hecho. ¡Muchas gracias!";
      } else if (type === 'payment') {
        notificationTxt = "💳 *CIERRE DE PAGO:* Hemos recibido el registro de tu pago de transferencia con éxito. ¡Muchas gracias!";
      }

      if (notificationTxt && selectedChatId) {
        await addDoc(collection(db, "chats", selectedChatId, "messages"), {
          sender: "staff",
          text: notificationTxt,
          timestamp: new Date().toISOString(),
          status: "sent"
        });
        await updateDoc(doc(db, "chats", selectedChatId), {
          lastMessage: notificationTxt,
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  // --- Cancel an order from the control panel ---
  const handleCancelOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: 'cancelled',
        whatsAppConfirmed: true, // Mark resolved
        updatedAt: new Date().toISOString()
      });

      setCancellingOrderId(null);
      toast.error("¡Pedido cancelado y notificado al cliente!");

      const notificationTxt = "❌ *PEDIDO CANCELADO:* Tu pedido en Las Cazuelas ha sido cancelado por la mesa de control. Si tienes dudas, por favor contáctanos por aquí.";

      if (notificationTxt && selectedChatId) {
        await addDoc(collection(db, "chats", selectedChatId, "messages"), {
          sender: "staff",
          text: notificationTxt,
          timestamp: new Date().toISOString(),
          status: "sent"
        });
        await updateDoc(doc(db, "chats", selectedChatId), {
          lastMessage: notificationTxt,
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  // --- Explicitly accept a WhatsApp order, releasing it to the Kitchen as Pending ---
  const handleAcceptOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        whatsAppConfirmed: true,
        updatedAt: new Date().toISOString()
      });
      toast.success("¡Pedido aceptado! Enviado a cocina como pendiente.");

      const notificationTxt = "👨‍🍳 *ACEPTADO:* Tu pedido ya fue aceptado por Las Cazuelas y está en espera en la cocina para ser preparado. ¡Te avisamos cuando iniciemos!";

      if (notificationTxt && selectedChatId) {
        await addDoc(collection(db, "chats", selectedChatId, "messages"), {
          sender: "staff",
          text: notificationTxt,
          timestamp: new Date().toISOString(),
          status: "sent"
        });
        await updateDoc(doc(db, "chats", selectedChatId), {
          lastMessage: notificationTxt,
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  // --- Filtering lists ---
  const filteredChats = chats.filter(c => {
    const matchesSearch = c.clientName.toLowerCase().includes(chatSearch.toLowerCase()) || 
                          c.clientPhone.includes(chatSearch);
    if (!matchesSearch) return false;

    // "solo entonces cerrar la sesion y borrar de la mesa de control"
    if (c.activeOrderId) {
      const orderDoc = activeOrders.find(o => o.id === c.activeOrderId);
      if (orderDoc) {
        const isCancelled = orderDoc.status === 'cancelled';
        const isCompleted = (orderDoc.isDelivered || orderDoc.status === 'served') && 
                            (orderDoc.isPaid || orderDoc.status === 'paid');
        if (isCancelled || isCompleted) {
          return false; // Hide completed or cancelled sessions from mesa de control
        }
      }
    }
    return true;
  });

  const filteredClients = clients.filter(cl => 
    cl.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
    cl.phone.includes(clientSearch)
  );

  return (
    <div className="flex flex-col h-full bg-stone-100 font-sans text-stone-800" id="whatsapp-root">
      {/* View Header Tabs */}
      {mode !== 'client' && (
      <div className="bg-white border-b border-stone-200 px-6 py-4 shrink-0 flex flex-wrap items-center justify-between gap-4 shadow-sm z-10" id="whatsapp-header animate-in fade-in">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-white p-2.5 rounded-2xl flex items-center justify-center shadow-md">
            <MessageSquare size={24} />
          </div>
          <div>
            <h1 className="text-xl font-serif font-black text-stone-900 leading-none">{branding.appName}</h1>
            <p className="text-xs text-stone-500 mt-1">Canal de Pedidos para Llevar y Portal de Autoregistro</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-stone-100 p-1.5 rounded-2xl border border-stone-200">
          <button
            onClick={() => setActiveSubTab('chat')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              activeSubTab === 'chat' 
                ? "bg-white text-emerald-600 shadow-sm" 
                : "text-stone-600 hover:bg-stone-50"
            )}
          >
            <MessageSquare size={14} />
            Mesa de Control Chat
            {filteredChats.reduce((acc, c) => acc + c.unreadCount, 0) > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] min-w-4.5 h-4.5 px-1 font-bold rounded-full flex items-center justify-center animate-pulse">
                {filteredChats.reduce((acc, c) => acc + c.unreadCount, 0)}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveSubTab('clients')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              activeSubTab === 'clients' 
                ? "bg-white text-emerald-600 shadow-sm" 
                : "text-stone-600 hover:bg-stone-50"
            )}
          >
            <User size={14} />
            Clientes Registrados
          </button>

          <button
            onClick={() => setActiveSubTab('portal_sim')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              activeSubTab === 'portal_sim' 
                ? "bg-white text-emerald-600 shadow-sm border border-emerald-100" 
                : "text-stone-600 hover:bg-stone-50"
            )}
          >
            <Sparkles size={14} className="text-emerald-500 animate-spin-slow" />
            📱 Portal Cliente (Comprar)
          </button>
        </div>
      </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-stone-50">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="animate-spin text-stone-400" size={32} />
            <p className="text-stone-500 text-sm">Cargando base de datos de WhatsApp...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          
          {/* ==================== TAB: MESSENGER CONTROL CENTER ==================== */}
          {activeSubTab === 'chat' && (
            <div className="h-full flex flex-col lg:flex-row overflow-hidden">
              
              {/* Left Bar: Chats List */}
              <div className={cn(
                "w-full lg:w-80 border-r border-stone-200 bg-white flex flex-col shrink-0",
                staffMobileView === 'chat' && "hidden lg:flex"
              )}>
                <div className="p-4 border-b border-stone-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-stone-400" size={16} />
                    <input
                      type="text"
                      className="w-full bg-stone-100 pl-10 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all border border-stone-200"
                      placeholder="Buscar chat o teléfono..."
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-stone-100 pr-1">
                  {filteredChats.map((channel) => {
                    const isActive = selectedChatId === channel.id;
                    const activeOrderForChat = activeOrders.find(o => o.id === channel.activeOrderId);
                    const hasActiveOrder = !!activeOrderForChat && 
                      activeOrderForChat.status !== 'cancelled' && 
                      !((activeOrderForChat.isDelivered || activeOrderForChat.status === 'served') && (activeOrderForChat.isPaid || activeOrderForChat.status === 'paid'));
                    const isPendingApproval = hasActiveOrder && activeOrderForChat?.whatsAppConfirmed === false;

                    return (
                      <div
                        key={channel.id}
                        className={cn(
                          "w-full text-left p-4 flex items-start justify-between gap-3 transition-colors relative group",
                          isActive ? "bg-stone-100" : "hover:bg-stone-50",
                          isPendingApproval && !isActive && "bg-amber-50/50"
                        )}
                      >
                        <div 
                          onClick={() => {
                            setSelectedChatId(channel.id);
                            setStaffMobileView('chat');
                          }}
                          className="flex-1 min-w-0 cursor-pointer flex items-start gap-3"
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold font-serif shrink-0 border",
                            isPendingApproval 
                              ? "bg-amber-100 text-amber-800 border-amber-200 animate-pulse" 
                              : "bg-emerald-100 text-emerald-800 border-emerald-200"
                          )}>
                            {channel.clientName.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-stone-900 truncate">{channel.clientName}</span>
                              <span className="text-[10px] text-stone-400">
                                {channel.lastMessageAt ? new Date(channel.lastMessageAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ""}
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-400 truncate mt-1">
                              {channel.clientPhone}
                            </div>
                            <div className="text-xs text-stone-600 truncate mt-1 flex items-center gap-1.5 font-medium italic">
                              {channel.lastMessage}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {hasActiveOrder && (
                                <span className={cn(
                                  "inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded border uppercase",
                                  isPendingApproval 
                                    ? "bg-amber-100 text-amber-700 border-amber-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-100"
                                )}>
                                  <ShoppingBag size={8} /> 
                                  {isPendingApproval ? "Esperando Aprobación" : "Pedido Activo"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0 self-center">
                          {channel.unreadCount > 0 && (
                            <div className="bg-emerald-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-sm animate-bounce">
                              {channel.unreadCount}
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatToDelete(channel);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg border border-transparent hover:border-red-100 cursor-pointer"
                            title="Eliminar Conversación"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredChats.length === 0 && (
                    <div className="p-8 text-center text-stone-400 flex flex-col items-center gap-2">
                      <MessageCircle size={32} className="text-stone-300" />
                      <p className="text-xs">Sin conversaciones activas</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Middle Section: WhatsApp Chat Messenger Window */}
              <div className={cn(
                "flex-1 bg-stone-50 flex flex-col overflow-hidden relative",
                staffMobileView === 'list' && "hidden lg:flex"
              )}>
                {selectedChat ? (
                  <>
                    {/* Chat Header */}
                    <div className="bg-white border-b border-stone-200 px-4 lg:px-6 py-4 shrink-0 flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setStaffMobileView('list')}
                          className="lg:hidden p-2 -ml-2 text-stone-400 hover:text-stone-600 active:bg-stone-100 rounded-full"
                        >
                          <ArrowLeft size={20} />
                        </button>
                        <div className="flex items-center gap-3">
                          <div className="hidden xs:flex w-11 h-11 bg-stone-800 text-stone-100 rounded-full items-center justify-center font-bold">
                            {selectedChat.clientName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-stone-900 flex items-center gap-1.5">
                              {selectedChat.clientName}
                              <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full border border-emerald-100">WhatsApp</span>
                            </h4>
                            <span className="text-[11px] text-stone-400 font-mono">{selectedChat.clientPhone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`https://api.whatsapp.com/send?phone=52${selectedChat.clientPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-3 py-2 rounded-xl border border-emerald-600 shadow-sm transition-all focus:outline-none no-underline"
                        >
                          <MessageCircle size={12} />
                          WhatsApp
                        </a>
                        <Button
                          variant="outline"
                          className="bg-white hover:bg-stone-50 border-stone-200 text-stone-600 font-bold text-xs flex items-center gap-1 px-3 py-2 rounded-xl shadow-xs cursor-pointer"
                          onClick={() => {
                            // Find matching database client
                            const targetCl = clients.find(c => c.phone === selectedChat.clientPhone);
                            if (targetCl) handleEditClientClick(targetCl);
                          }}
                        >
                          <Edit2 size={12} />
                          Ver Perfil
                        </Button>
                        <Button
                          variant="outline"
                          className="bg-white hover:bg-red-50 border-stone-200 hover:border-red-200 text-red-500 hover:text-red-700 font-bold text-xs flex items-center gap-1 px-3 py-2 rounded-xl shadow-xs cursor-pointer"
                          onClick={() => setChatToDelete(selectedChat)}
                        >
                          <Trash2 size={12} />
                          Eliminar Chat
                        </Button>
                      </div>
                    </div>

                    {/* Chat Messages Body (WhatsApp green/grey bubbles flow) */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ backgroundColor: '#efeae2', backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'contain' }}>
                      <div className="mx-auto w-fit bg-amber-50/90 border border-amber-200 text-amber-800 rounded-xl px-4 py-2 text-[10px] text-center max-w-sm shadow-sm backdrop-blur-xs">
                        🔒 Las conversaciones y pedidos generados en este portal alimentan de forma instantánea la base de datos local para la preparación y arqueo de caja.
                      </div>

                      {messages.map((msg) => {
                        const isFromStaff = msg.sender === 'staff';
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex w-full mb-2 animate-in fade-in duration-200",
                              isFromStaff ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-md p-3.5 rounded-2xl shadow-sm text-xs relative",
                                isFromStaff 
                                  ? "bg-emerald-100 text-stone-900 rounded-tr-none border border-emerald-200/50" 
                                  : "bg-white text-stone-900 rounded-tl-none border border-stone-200/50"
                              )}
                            >
                              {/* Message text */}
                              <p className="whitespace-pre-line leading-relaxed pb-3">{msg.text}</p>
                              
                              {/* Message indicator bar */}
                              <div className="flex items-center justify-end gap-1 text-[9px] text-stone-400 absolute bottom-1 right-2.5">
                                <span>
                                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ""}
                                </span>
                                {isFromStaff && (
                                  <CheckCheck size={12} className="text-blue-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Response Templates Row */}
                    <div className="bg-stone-50 px-4 py-2 shrink-0 border-t border-stone-200 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                      <span className="text-[10px] font-bold text-stone-400 tracking-wide mr-1 shrink-0 uppercase">Plantillas:</span>
                      {quickTemplates.map((tpl, i) => (
                        <button
                          key={i}
                          onClick={() => applyTemplate(tpl)}
                          className="bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 text-[11px] px-3 py-1 cursor-pointer rounded-full font-medium transition-colors whitespace-nowrap inline-block shrink-0 shadow-2xs"
                        >
                          {tpl.length > 25 ? tpl.substring(0, 25) + "..." : tpl}
                        </button>
                      ))}
                    </div>

                    {/* Bottom message editor input */}
                    <div className="bg-white border-t border-stone-200 px-6 py-4 shrink-0 flex items-center gap-3">
                      <input
                        type="text"
                        className="flex-1 bg-stone-100 focus:bg-white text-xs px-5 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 border border-stone-200/80 transition-all text-stone-800"
                        placeholder="Escribe un mensaje de respuesta de WhatsApp..."
                        value={newMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendMessage();
                        }}
                      />
                      <Button
                        variant="primary"
                        onClick={handleSendMessage}
                        className="bg-emerald-500 text-white hover:bg-emerald-600 h-11 w-11 rounded-full flex items-center justify-center shadow-md grow-0 shrink-0 cursor-pointer"
                      >
                        <Send size={16} />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-400 bg-stone-100">
                    <MessageSquare size={48} className="text-stone-300 mb-3" />
                    <h5 className="font-serif text-base font-bold text-stone-700">Canalizadores Vacíos</h5>
                    <p className="text-xs text-stone-500 max-w-sm mt-1">
                      Por favor, selecciona una conversación con cliente en el panel izquierdo para chatear o ver el seguimiento de sus pedidos para llevar.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Sidebar: Active Takeaway Order Detail */}
              {selectedChat && (
                <div className={cn(
                  "w-full lg:w-80 border-l border-stone-200 bg-white flex flex-col shrink-0 overflow-y-auto p-4 no-scrollbar",
                  staffMobileView === 'list' && "hidden lg:flex"
                )}>
                  <div className="border-b border-stone-100 pb-3 mb-4">
                    <h5 className="text-xs font-black text-stone-500 tracking-wider uppercase">Pedido de WhatsApp Activo</h5>
                  </div>

                  {selectedChatActiveOrder ? (
                    <div className="space-y-4">
                      {/* Order status card */}
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-emerald-700 font-extrabold uppercase">Folio de Orden</span>
                            <h2 className="text-sm font-black text-stone-900">{selectedChatActiveOrder.folio}</h2>
                          </div>
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-black uppercase text-center border",
                            selectedChatActiveOrder.status === 'pending' && "bg-amber-50 text-amber-700 border-amber-200",
                            selectedChatActiveOrder.status === 'preparing' && "bg-blue-50 text-blue-700 border-blue-200",
                            selectedChatActiveOrder.status === 'ready' && "bg-green-50 text-green-700 border-green-200",
                            selectedChatActiveOrder.status === 'served' && "bg-stone-50 text-stone-700 border-stone-200",
                            selectedChatActiveOrder.status === 'paid' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                          )}>
                            {selectedChatActiveOrder.status}
                          </span>
                        </div>

                        {/* Fast Trigger Stage Action */}
                        <div className="mt-4 pt-4 border-t border-emerald-150 space-y-2.5">
                          <label className="text-[10px] text-stone-500 block font-bold uppercase mb-1">Mesa de cocina / Estado:</label>
                          
                          {selectedChatActiveOrder.status === 'pending' && (
                            <div className="space-y-3">
                              {!selectedChatActiveOrder.whatsAppConfirmed ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                  <div className="flex items-center gap-2 text-amber-800">
                                    <AlertCircle size={16} className="shrink-0" />
                                    <span className="text-xs font-bold uppercase tracking-tight">Autorización Pendiente</span>
                                  </div>
                                  <p className="text-[10px] text-amber-600 leading-relaxed font-medium">
                                    Este pedido llegó desde WhatsApp y **aún no se ha enviado a Cocina**. 
                                    Confirma con el cliente si ya realizó su depósito o transferencia para autorizar.
                                  </p>
                                  <Button
                                    variant="primary"
                                    onClick={() => handleAcceptOrder(selectedChatActiveOrder.id)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-3 rounded-xl flex items-center justify-center gap-2 font-black shadow-md shadow-emerald-600/20 cursor-pointer border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 transition-all"
                                  >
                                    <CheckCircle2 size={14} />
                                    ACEPTAR Y MANDAR A COCINA
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="primary"
                                  onClick={() => handleQuickUpdateOrderStatus(selectedChatActiveOrder.id, 'preparing')}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 font-black shadow-md shadow-blue-600/10 cursor-pointer"
                                >
                                  <Clock size={12} />
                                  Mandar a preparar (Cocina)
                                </Button>
                              )}
                            </div>
                          )}
                          
                          {selectedChatActiveOrder.status === 'preparing' && (
                            <Button
                              variant="primary"
                              onClick={() => handleQuickUpdateOrderStatus(selectedChatActiveOrder.id, 'ready')}
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs py-2 rounded-xl flex items-center justify-center gap-1 font-bold shadow-xs cursor-pointer"
                            >
                              <CheckCircle2 size={12} />
                              Marcar como Listo para Llevar
                            </Button>
                          )}

                          {['ready', 'served', 'paid'].includes(selectedChatActiveOrder.status) && (() => {
                            const isOrderDelivered = !!(selectedChatActiveOrder.isDelivered || selectedChatActiveOrder.status === 'served' || (selectedChatActiveOrder.status === 'paid' && selectedChatActiveOrder.isDelivered));
                            const isOrderPaid = !!(selectedChatActiveOrder.isPaid || selectedChatActiveOrder.status === 'paid');
                            const isFullyCompleted = isOrderDelivered && isOrderPaid;

                            return (
                              <div className="space-y-3 pt-1">
                                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Seguimiento de Entrega y Pago</div>
                                
                                <div className="space-y-2.5 bg-white p-3 rounded-2xl border border-stone-200 shadow-3xs">
                                  {/* Delivery Row */}
                                  <div className="flex items-center justify-between gap-1.5 text-xs">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-sm shrink-0">{isOrderDelivered ? "✅" : "⏳"}</span>
                                      <div className="min-w-0">
                                        <div className="font-extrabold text-stone-900 truncate">Entrega</div>
                                        <div className="text-[9px] text-stone-500 truncate">{isOrderDelivered ? "Entregado a cliente" : "Pendiente de entregar"}</div>
                                      </div>
                                    </div>
                                    {!isOrderDelivered ? (
                                      <Button
                                        variant="outline"
                                        onClick={() => handleToggleDeliveryOrPayment(selectedChatActiveOrder.id, 'delivery')}
                                        className="bg-white hover:bg-stone-50 border-stone-200 text-stone-700 font-bold text-[10px] py-1.5 px-2.5 rounded-xl cursor-pointer shrink-0"
                                      >
                                        Entregar
                                      </Button>
                                    ) : (
                                      <span className="text-[10px] bg-sky-50 text-sky-700 font-bold px-2 py-0.5 rounded-lg border border-sky-100">Entregado</span>
                                    )}
                                  </div>

                                  <div className="border-t border-stone-100 border-dashed my-1" />

                                  {/* Payment Row */}
                                  <div className="flex items-center justify-between gap-1.5 text-xs">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-sm shrink-0">{isOrderPaid ? "✅" : "⏳"}</span>
                                      <div className="min-w-0">
                                        <div className="font-extrabold text-stone-900 truncate">Cobro / Pago</div>
                                        <div className="text-[9px] text-stone-500 truncate">{isOrderPaid ? "Pago registrado" : "Pendiente de cobro / transferencia"}</div>
                                      </div>
                                    </div>
                                    {!isOrderPaid ? (
                                      <Button
                                        variant="primary"
                                        onClick={() => handleToggleDeliveryOrPayment(selectedChatActiveOrder.id, 'payment')}
                                        className="bg-emerald-500 hover:bg-emerald-600 border border-emerald-600 text-white font-bold text-[10px] py-1.5 px-2.5 rounded-xl cursor-pointer shrink-0"
                                      >
                                        Cobrar
                                      </Button>
                                    ) : (
                                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-lg border border-emerald-100">Pagado</span>
                                    )}
                                  </div>
                                </div>

                                {isFullyCompleted && (
                                  <div className="text-center text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-250 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1 shadow-3xs animate-in zoom-in-95 duration-200">
                                    🎉 ¡Listo! Pedido Entregado y Cobrado
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Action to Cancel Order */}
                          {selectedChatActiveOrder.status !== 'cancelled' && selectedChatActiveOrder.status !== 'paid' && (
                            <div className="pt-2 border-t border-stone-100 mt-2">
                              {cancellingOrderId === selectedChatActiveOrder.id ? (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2 animate-in fade-in duration-200">
                                  <p className="text-[10px] font-black text-red-800 leading-snug uppercase tracking-tight">🚨 ¿Confirmas cancelar este pedido?</p>
                                  <p className="text-[9px] text-red-600 leading-tight font-medium">Se notificará al cliente por WhatsApp y quedará cancelado.</p>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleCancelOrder(selectedChatActiveOrder.id)}
                                      className="flex-1 bg-red-650 hover:bg-red-700 text-white text-[10px] font-bold py-1 px-2 rounded-lg cursor-pointer border border-red-700 shadow-xs"
                                    >
                                      Sí, Cancelar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setCancellingOrderId(null)}
                                      className="flex-1 bg-white hover:bg-stone-100 border-stone-250 text-stone-700 text-[10px] font-bold py-1 px-2 rounded-lg cursor-pointer"
                                    >
                                      No
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  onClick={() => setCancellingOrderId(selectedChatActiveOrder.id)}
                                  className="w-full border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700 text-[10px] py-1.5 rounded-xl flex items-center justify-center gap-1 font-extrabold cursor-pointer transition-all mt-1"
                                >
                                  <X size={12} className="stroke-[3]" />
                                  Cancelar Pedido
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Items Details */}
                      <div>
                        <h6 className="text-[10px] font-black tracking-wide text-stone-400 uppercase mb-2">Artículos en Comanda</h6>
                        <div className="space-y-2 border border-stone-100 rounded-2xl p-3 bg-stone-50">
                          {selectedChatActiveOrder.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start text-xs py-1 border-b border-stone-150 last:border-0 border-dashed">
                              <div>
                                <span className="font-bold text-stone-900">{item.quantity}x</span> {item.name}
                                {item.notes && (
                                  <p className="text-[10px] text-stone-500 italic mt-0.5">Nota: "{item.notes}"</p>
                                )}
                              </div>
                              <span className="font-serif text-stone-700 font-bold">{formatCurrency(item.price * item.quantity)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center text-xs pt-3 font-extrabold text-stone-900 border-t border-stone-200">
                            <span>TOTAL:</span>
                            <span className="text-sm font-serif text-emerald-600">{formatCurrency(selectedChatActiveOrder.total)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {selectedChatActiveOrder.notes && (
                        <div className="rounded-2xl p-3 border border-stone-100 bg-yellow-50/50">
                          <label className="text-[10px] font-bold text-yellow-800 block uppercase">Notas de Envío:</label>
                          <p className="text-xs text-stone-700 mt-1">{selectedChatActiveOrder.notes}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center p-8 bg-stone-50 rounded-2xl border border-stone-100 text-stone-400 text-xs">
                      <ShoppingBag size={24} className="mx-auto mb-2 text-stone-300" />
                      No hay ningún pedido activo para chatear con esta sucursal. Crea uno desde el Portal de Cliente.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB: REGISTERED CLIENTS DIRECTORY ==================== */}
          {activeSubTab === 'clients' && (
            <div className="p-6 h-full overflow-y-auto">
              <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Search Bar & Actions bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-stone-200 shadow-sm animate-in fade-in duration-200">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-3 text-stone-400" size={16} />
                    <input
                      type="text"
                      className="w-full bg-stone-100 pl-11 pr-4 py-2.5 rounded-2xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all border border-stone-200"
                      placeholder="Buscar clientes por nombre o teléfono registrado..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                    />
                  </div>

                  <Button
                    variant="primary"
                    onClick={() => {
                      clearClientForm();
                      setIsClientFormOpen(true);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-5 py-3 rounded-2xl flex items-center gap-2 shadow-sm shrink-0 cursor-pointer"
                  >
                    <Plus size={16} />
                    Registrar Nuevo Cliente
                  </Button>
                </div>

                {/* Clients Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredClients.map((client) => {
                    const clientChats = chats.some(c => c.clientPhone === client.phone);
                    return (
                      <Card key={client.id} className="rounded-3xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <CardHeader className="bg-stone-50 border-b border-stone-100 p-5 flex items-start gap-4 justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-stone-800 text-mex-cream rounded-full flex items-center justify-center font-bold text-serif text-sm">
                              {client.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-sm font-extrabold text-stone-900 group-hover:text-emerald-500 transition-colors leading-tight">{client.name}</h4>
                              <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
                                <Phone size={10} />
                                {client.phone}
                              </p>
                            </div>
                          </div>

                           <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditClientClick(client)}
                              className="text-stone-400 hover:text-stone-700 p-1.5 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                              title="Editar Perfil"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleStartChatFromClient(client)}
                              className="text-emerald-500 hover:text-emerald-600 p-1.5 hover:bg-emerald-55 rounded-lg transition-colors cursor-pointer"
                              title="Iniciar Canal de WhatsApp"
                            >
                              <MessageSquare size={13} />
                            </button>
                            <button
                              onClick={() => setClientToDelete(client)}
                              className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar Registro de Cliente"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="p-5 space-y-4">
                          {/* Financial statistics & orders Count */}
                          <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-100 text-center">
                            <div>
                              <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wide">Pedidos Totales</span>
                              <p className="text-sm font-serif font-black text-stone-950 mt-0.5">{client.orderCount || 0}</p>
                            </div>
                            <div>
                              <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wide font-medium">Facturado Total</span>
                              <p className="text-sm font-serif font-black text-emerald-600 mt-0.5">{formatCurrency(client.totalPaid || 0)}</p>
                            </div>
                          </div>

                          {/* Contact Info (Details) */}
                          <div className="space-y-1.5 text-xs text-stone-600">
                            {client.email && (
                              <div className="flex items-center gap-2">
                                <Mail size={12} className="text-stone-300" />
                                <span className="truncate">{client.email}</span>
                              </div>
                            )}
                            {client.address && (
                              <div className="flex items-start gap-2">
                                <MapPin size={12} className="text-stone-300 shrink-0 mt-0.5" />
                                <span className="line-clamp-2 leading-tight">{client.address}</span>
                              </div>
                            )}
                            {client.notes && (
                              <div className="flex items-start gap-2">
                                <FileText size={12} className="text-amber-400 shrink-0 mt-0.5" />
                                <span className="line-clamp-2 italic text-stone-500 leading-tight">Nota: "{client.notes}"</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {filteredClients.length === 0 && (
                    <div className="col-span-full py-16 text-center text-stone-400 flex flex-col items-center justify-center gap-3">
                      <User size={48} className="text-stone-200" />
                      <h4 className="font-serif text-sm font-extrabold text-stone-700">Sin Clientes Registrados</h4>
                      <p className="text-xs text-stone-500 max-w-sm">Registra un cliente utilizando el botón superior o realizando un pedido simulado para que se autoregistre.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ==================== TAB: PORTAL CLIENT SIMULATOR (MINIMALIST INTERFACE) ==================== */}
          {activeSubTab === 'portal_sim' && (
            <div className={cn(
              "flex flex-col items-center justify-center bg-stone-100/40 relative overflow-hidden",
              mode === 'client' ? "min-h-screen p-0" : "h-full p-4 md:p-8"
            )}>
              {/* Subtle background decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50 -mr-32 -mt-32" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-mex-gold/5 rounded-full blur-3xl opacity-30 -ml-32 -mb-32" />

              <div className={cn(
                "w-full bg-white shadow-2xl border border-stone-200/60 overflow-hidden relative flex flex-col animate-in zoom-in-95 duration-500",
                mode === 'client' 
                  ? "max-w-xl h-[100dvh] md:h-[85vh] md:rounded-[2.5rem] md:my-8" 
                  : "max-w-md h-full max-h-[800px] rounded-[2.5rem]"
              )}>
                
                {/* FLOATING CART BUBBLE (BURBUJA SUPERIOR DE CARRITO) */}
                {portalStep === 'menu' && portalCart.length > 0 && (
                  <button
                    onClick={() => setPortalStep('cart')}
                    className="absolute top-24 right-5 z-40 bg-mex-green hover:bg-mex-green/90 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(16,185,129,0.35)] hover:scale-110 active:scale-95 transition-all duration-300 border-2 border-white cursor-pointer group animate-bounce"
                    style={{ animationDuration: '2.5s' }}
                    title="Ver mi carrito"
                    id="floating-cart-bubble"
                  >
                    <ShoppingBag size={24} className="group-hover:rotate-12 transition-transform" />
                    <span className="absolute -top-1.5 -right-1.5 bg-mex-gold text-stone-950 text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                      {portalCart.reduce((acc, c) => acc + c.quantity, 0)}
                    </span>
                  </button>
                )}

                {/* Header banner - Minimalist & Elegant */}
                <div className="bg-stone-950 text-white pt-6 pb-5 px-6 shrink-0 flex items-center justify-between sticky top-0 z-20">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black tracking-[0.2em] text-mex-gold uppercase mb-0.5">
                      {branding.appName}
                    </span>
                    <h3 className="text-sm font-black font-serif tracking-tight">Portal de Pedidos</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none">Status</span>
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">En Línea</span>
                    </div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  </div>
                </div>

                {/* Content Section based on Portal Step flow */}
                <div className="flex-1 overflow-hidden bg-white relative flex flex-col min-h-0">
                  
                  {/* STEP 1: AUTHENTICATION / ACCESS FORM */}
                  {portalStep === 'auth' && (() => {
                    const cleanedPhone = portalClientPhone.replace(/\D/g, "");
                    const registeredClient = cleanedPhone.length >= 10 ? clients.find(c => c.phone === cleanedPhone) : null;
                    const isAlreadyRegistered = !!registeredClient;

                    return (
                      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col justify-start md:justify-center space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                        <div className="space-y-4">
                          <div className="inline-flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-full">
                            <ShoppingBag size={14} className="text-mex-green" />
                            <span className="text-[10px] font-black uppercase text-stone-500">Haz tu pedido hoy</span>
                          </div>
                          <h4 className="text-3xl font-black text-stone-900 leading-tight tracking-tighter font-serif">
                            Bienvenido a <span className="text-mex-green italic">{branding.appName}</span>
                          </h4>
                          <p className="text-xs text-stone-500 leading-relaxed font-medium">
                            Nuestro portal inteligente de WhatsApp automatiza tu pedido para que sea atendido de inmediato.
                          </p>
                        </div>

                        <form onSubmit={handleClientPortalAuth} className="space-y-5">
                          <div className="space-y-1.5 focus-within:translate-x-1 transition-transform">
                            <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest ml-1 block">WhatsApp (10 dígitos):</label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                              <input
                                type="tel"
                                required
                                placeholder="55 1234 5678"
                                className="w-full bg-stone-50/50 pl-11 pr-4 py-3.5 rounded-2xl text-xs font-black border border-stone-100 focus:outline-none focus:border-stone-400 focus:bg-white transition-all shadow-sm font-mono"
                                value={portalClientPhone}
                                onChange={(e) => setPortalClientPhone(e.target.value)}
                              />
                            </div>
                          </div>

                          {isAlreadyRegistered ? (
                            <div className="bg-emerald-50/80 border border-emerald-150 p-4 rounded-2xl flex items-start gap-3 text-left animate-in fade-in zoom-in-95 duration-300">
                              <CheckCircle2 className="text-mex-green shrink-0 mt-0.5" size={16} />
                              <div>
                                <p className="text-xs font-black text-stone-900">¡Cliente Reconocido!</p>
                                <p className="text-[11px] text-stone-600 font-medium mt-0.5 leading-relaxed">
                                  Bienvenido de nuevo, <strong className="text-mex-green font-black">{registeredClient.name}</strong>.
                                </p>
                                {registeredClient.address && (
                                  <p className="text-[10px] text-stone-500 font-bold mt-1">
                                    📍 Ubicación: <span className="italic font-medium">{registeredClient.address}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-5 animate-in fade-in duration-300">
                              <div className="space-y-1.5 focus-within:translate-x-1 transition-transform">
                                <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest ml-1 block">Tu Nombre:</label>
                                <div className="relative">
                                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                                  <input
                                    type="text"
                                    required={!isAlreadyRegistered}
                                    placeholder="Ej. María García"
                                    className="w-full bg-stone-50/50 pl-11 pr-4 py-3.5 rounded-2xl text-xs font-bold border border-stone-100 focus:outline-none focus:border-stone-400 focus:bg-white transition-all shadow-sm"
                                    value={portalClientName}
                                    onChange={(e) => setPortalClientName(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5 focus-within:translate-x-1 transition-transform">
                                <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest ml-1 block">Ubicación / Dirección de Entrega:</label>
                                <div className="relative">
                                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                                  <input
                                    type="text"
                                    required={!isAlreadyRegistered}
                                    placeholder="Ej. Av. Reforma 123, Int 4"
                                    className="w-full bg-stone-50/50 pl-11 pr-4 py-3.5 rounded-2xl text-xs font-bold border border-stone-100 focus:outline-none focus:border-stone-400 focus:bg-white transition-all shadow-sm"
                                    value={portalClientAddress}
                                    onChange={(e) => setPortalClientAddress(e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <Button
                            type="submit"
                            className="w-full bg-stone-900 hover:bg-stone-800 text-white text-xs py-4 rounded-2xl font-black font-sans mt-4 shadow-xl shadow-stone-200 transition-all active:scale-95 flex items-center justify-center gap-2 group border-none"
                          >
                            {isAlreadyRegistered ? 'INGRESAR AL MENÚ' : 'REGISTRARME Y VER MENÚ'}
                            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </form>
                        
                        <div className="pt-4 border-t border-stone-100">
                          <p className="text-[10px] text-center text-stone-400 font-bold uppercase tracking-tighter">
                            Powered by Minimalist WA Automation
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* STEP 2: MENU AND CART ADDITION LIST SCREEN */}
                  {portalStep === 'menu' && (
                    <div className="p-0 flex flex-col h-full animate-in fade-in duration-300">
                      {/* Search & Categories Sticky Box */}
                      <div className="p-6 pb-2 space-y-4 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-stone-100">
                        <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-mex-green" size={16} />
                          <input
                            type="text"
                            className="w-full bg-stone-50 border border-stone-100 pl-12 pr-4 py-3 rounded-2xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-stone-200 focus:bg-white transition-all shadow-inner"
                            placeholder="¿Qué se te antoja hoy?..."
                            value={portalSearchProduct}
                            onChange={(e) => setPortalSearchProduct(e.target.value)}
                          />
                        </div>

                        {/* Scrolling Hint Header */}
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Especialidades</span>
                          <span className="text-[8px] font-black text-mex-gold uppercase tracking-wider animate-pulse flex items-center gap-1">
                            Desliza para ver más categorías ➜
                          </span>
                        </div>

                        {/* Interactive Categories Bar */}
                        <div className="relative -mx-2 px-2">
                          {/* Right Fade indicating more elements */}
                          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
                          
                          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1.5 scroll-smooth">
                            {categories.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => setPortalMenuCategory(c.id)}
                                className={cn(
                                  "px-4 py-2.5 rounded-full text-[10px] font-black tracking-tight transition-all whitespace-nowrap border shrink-0 uppercase relative",
                                  portalMenuCategory === c.id 
                                    ? "bg-mex-green text-white border-mex-green shadow-md shadow-mex-green/20 scale-102" 
                                    : "bg-white text-stone-500 border-stone-200 hover:bg-stone-50"
                                )}
                              >
                                {c.name}
                                {portalMenuCategory === c.id && (
                                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-mex-gold rounded-full" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto no-scrollbar pt-4">
                        <div className="px-6 pb-28 space-y-4">
                          {portalActiveOrderId && (
                            <button
                              type="button"
                              onClick={() => setPortalStep('chat')}
                              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-emerald-500/15 transition-all duration-300 border-none cursor-pointer mb-2"
                            >
                              <div className="flex items-center gap-2.5">
                                <MessageSquare size={16} className="text-white shrink-0 animate-bounce" />
                                <div className="text-left">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-white/85 mb-0.5 leading-none">Tienes un Pedido Activo</p>
                                  <p className="text-xs font-bold leading-none">Rastrear orden en vivo / Chatear →</p>
                                </div>
                              </div>
                              <ChevronRight size={14} className="text-white shrink-0" />
                            </button>
                          )}

                          {products.filter(p => p.available && p.categoryId === portalMenuCategory && (p.name.toLowerCase().includes(portalSearchProduct.toLowerCase()) || p.description.toLowerCase().includes(portalSearchProduct.toLowerCase()))).length > 2 && (
                            <div className="flex items-center justify-center gap-1.5 py-2 px-4 bg-mex-gold/10 text-mex-brown rounded-2xl border border-mex-gold/20 animate-pulse text-center">
                              <span className="text-[10px] font-black uppercase tracking-wider">
                                Desliza hacia abajo para ver más deliciosas comidas ⇣
                              </span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {products
                              .filter(p => p.available && p.categoryId === portalMenuCategory && (p.name.toLowerCase().includes(portalSearchProduct.toLowerCase()) || p.description.toLowerCase().includes(portalSearchProduct.toLowerCase())))
                              .map((p) => (
                                <div key={p.id} className="bg-white p-3 rounded-[1.5rem] border border-stone-150 flex items-stretch gap-3 hover:border-mex-green/30 transition-all group relative shadow-sm">
                                  {/* Product image */}
                                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 bg-stone-50 relative border border-stone-100 flex items-center justify-center">
                                    <img 
                                      src={p.imageUrl || getFallbackProductImage(p.name)} 
                                      alt={p.name} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      referrerPolicy="no-referrer"
                                    />
                                    {p.stock <= 5 && (
                                      <div className="absolute top-1 left-1 bg-mex-red text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                                        Poco stock
                                      </div>
                                    )}
                                  </div>

                                  {/* Item metadata details */}
                                  <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                                    <div>
                                      <div className="flex items-start justify-between gap-1 mb-1">
                                        <h4 className="text-[12px] font-black text-stone-900 leading-tight tracking-tight truncate group-hover:text-mex-green transition-colors">{p.name}</h4>
                                        {p.price > 100 && <Sparkles size={10} className="text-mex-gold shrink-0 mt-0.5" />}
                                      </div>
                                      <p className="text-[9px] text-stone-400 leading-normal line-clamp-2 font-medium italic mb-2">{p.description}</p>
                                    </div>

                                    <div className="flex items-center justify-between mt-auto gap-2">
                                      <span className="text-sm font-black font-serif text-mex-green tracking-tight">{formatCurrency(p.price)}</span>
                                      
                                      <button
                                        onClick={() => addToPortalCart(p)}
                                        className="h-8 px-4 rounded-xl bg-stone-950 hover:bg-mex-green hover:shadow-lg hover:shadow-mex-green/20 text-white flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0 border-none"
                                      >
                                        <Plus size={11} className="stroke-[3]" />
                                        <span>Pedir</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            {products.filter(p => p.available && p.categoryId === portalMenuCategory).length === 0 && (
                              <div className="text-center py-20 bg-stone-50 rounded-3xl border border-dashed border-stone-200 sm:col-span-2">
                                <ShoppingBag size={32} className="mx-auto text-stone-300 mb-3" />
                                <p className="text-xs font-bold text-stone-400">Sin productos disponibles</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Floating Checkout Bar */}
                      {portalCart.length > 0 && (
                        <div className="sticky bottom-0 left-0 w-full p-4 md:p-6 bg-gradient-to-t from-white via-white to-transparent pt-12 z-30 pointer-events-none mt-auto pb-safe">
                          <button
                            onClick={() => setPortalStep('cart')}
                            className="w-full bg-mex-green hover:bg-mex-green/90 text-white rounded-3xl flex items-center justify-between p-4 px-6 shadow-2xl shadow-mex-green/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer pointer-events-auto border-none animate-in slide-in-from-bottom-8 duration-500"
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <ShoppingBag size={20} />
                                <span className="absolute -top-2 -right-2 bg-white text-mex-green text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                                  {portalCart.reduce((acc, c) => acc + c.quantity, 0)}
                                </span>
                              </div>
                              <span className="text-[11px] font-black uppercase tracking-widest ml-1">Revisar Carrito</span>
                            </div>
                            <span className="text-base font-serif font-black">{formatCurrency(totalPortalCartPrice)}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 3: SHOPPING CART CONTENT REVIEW AND PAYMENT SUBMIT */}
                  {portalStep === 'cart' && (
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-300">
                      {/* Scrollable Cart Body */}
                      <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-6 lg:p-8 space-y-6 pb-28">
                        <button
                          onClick={() => setPortalStep('menu')}
                          className="text-stone-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:text-stone-900 transition-colors w-fit px-2 mb-2"
                        >
                          <ArrowLeft size={12} />
                          Agregar más productos
                        </button>

                        <div className="space-y-3 px-1 lg:px-2">
                          {portalCart.map((item, id) => (
                            <div key={id} className="bg-stone-50/50 p-4 rounded-[1.5rem] border border-stone-100 flex flex-col gap-3">
                              <div className="flex justify-between items-center gap-3">
                                {/* Thumbnail */}
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white shrink-0 border border-stone-100 flex items-center justify-center">
                                  <img 
                                    src={item.product.imageUrl || getFallbackProductImage(item.product.name)} 
                                    alt={item.product.name} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-black text-stone-900 leading-tight truncate">{item.product.name}</h4>
                                  <span className="text-[11px] font-bold text-mex-green block mt-0.5">{formatCurrency(item.product.price)}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-stone-150">
                                  <button 
                                    onClick={() => updatePortalCartQty(item.product.id, -1)}
                                    className="text-stone-400 hover:text-stone-900 w-6 h-6 flex items-center justify-center transition-colors"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span className="text-xs font-black font-mono w-6 text-center text-stone-900">{item.quantity}</span>
                                  <button 
                                    onClick={() => updatePortalCartQty(item.product.id, 1)}
                                    className="text-stone-400 hover:text-stone-900 w-6 h-6 flex items-center justify-center transition-colors"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </div>

                              <div className="relative">
                                <FileText className="absolute left-2.5 top-2.5 text-stone-300" size={12} />
                                <input
                                  type="text"
                                  className="w-full bg-white border border-stone-150 rounded-xl text-[10px] py-2 px-3 pl-8 font-medium focus:outline-none focus:border-mex-green/30 transition-all placeholder:text-stone-300"
                                  placeholder="Anotación especial para este platillo..."
                                  value={item.notes}
                                  onChange={(e) => updatePortalCartNotes(item.product.id, e.target.value)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-4 pt-4 border-t border-stone-100 pb-4">
                          <div className="space-y-1.5 focus-within:translate-x-1 transition-transform">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1 block">Instrucciones de Entrega:</label>
                            <textarea
                              className="w-full bg-stone-50 border border-stone-100 rounded-2xl p-4 text-xs font-medium focus:outline-none focus:bg-white focus:border-stone-300 h-24 resize-none transition-all shadow-inner placeholder:italic"
                              placeholder="Ej. Dejar en recepción, llevar cambio, etc."
                              value={portalNotes}
                              onChange={(e) => setPortalNotes(e.target.value)}
                            />
                          </div>

                          <div className="bg-mex-gold/5 p-5 rounded-3xl border border-mex-gold/10 space-y-2">
                            <div className="flex justify-between items-end border-b border-mex-gold/20 pb-2">
                              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Total a Pagar</span>
                              <span className="text-2xl font-serif font-black text-mex-green tabular-nums tracking-tighter">
                                {formatCurrency(totalPortalCartPrice)}
                              </span>
                            </div>
                            <p className="text-[9px] text-mex-brown/60 font-bold leading-relaxed italic">
                              ✓ Al confirmar, tu pedido se enviará automáticamente a cocina y se creará un canal de WhatsApp para que sigas el estado.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Sticky Floating Bottom Bar for confirmation */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-stone-150 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-30 flex flex-col pb-safe">
                        <Button
                          onClick={handlePortalSubmitOrder}
                          disabled={isPortalSending}
                          className="w-full bg-mex-green hover:bg-mex-green/90 text-white text-xs py-4.5 rounded-3xl flex items-center justify-center gap-3 font-black shadow-lg shadow-mex-green/20 cursor-pointer border-none active:scale-[0.98] transition-all uppercase tracking-widest disabled:opacity-50 disabled:grayscale"
                          id="floating-submit-button"
                        >
                          {isPortalSending ? (
                            <>
                              <Loader2 className="animate-spin text-white" size={18} />
                              <span>ENVIANDO...</span>
                            </>
                          ) : (
                            <>
                              <MessageCircle size={18} />
                              <span>CONFIRMAR Y ENVIAR PEDIDO</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: ORDER CREATION SUCCESS SCREEN */}
                  {portalStep === 'success' && (
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-start text-center space-y-6 animate-in zoom-in-95 duration-500 pb-20">
                      <div className="space-y-5">
                        <div className="relative inline-block">
                          <div className="w-16 h-16 bg-emerald-50 rounded-[1.8rem] flex items-center justify-center mx-auto shadow-sm">
                            <Check className="text-mex-green stroke-[4]" size={30} />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-mex-gold rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                            <Sparkles size={12} className="text-white" />
                          </div>
                        </div>
                        
                        <div className="space-y-1.5">
                          <h4 className="text-xl font-black text-stone-900 italic font-serif leading-tight">¡Pedido en Marcha!</h4>
                          <p className="text-[11px] text-stone-500 leading-relaxed font-medium max-w-[260px] mx-auto">
                            Tu orden ha sido inyectada al sistema central. Estamos preparando tus platillos con el sazón de siempre.
                          </p>
                        </div>

                        <div className="flex gap-3">
                          <div className="flex-1 bg-stone-50 p-3.5 rounded-[1.5rem] border border-stone-100 flex flex-col items-center">
                            <span className="text-[8px] text-stone-400 font-extrabold uppercase tracking-widest mb-0.5">Folio</span>
                            <div className="text-xs font-mono font-black text-stone-900 tracking-wider">{createdOrderFolio}</div>
                          </div>
                          <div className="flex-1 bg-emerald-50 p-3.5 rounded-[1.5rem] border border-emerald-100 flex flex-col items-center">
                            <span className="text-[8px] text-stone-400 font-extrabold uppercase tracking-widest mb-0.5">Total</span>
                            <div className="text-xs font-serif font-black text-mex-green">{formatCurrency(totalPortalCartPrice)}</div>
                          </div>
                        </div>

                        {/* --- BANNER DE DATOS DE TRANSFERENCIA --- */}
                        <div className="bg-stone-50 border border-stone-200 p-5 rounded-[1.8rem] text-left space-y-2.5 shadow-inner">
                          <div className="flex items-center gap-2 text-stone-900 font-black text-[9px] uppercase tracking-widest">
                            <DollarSign size={12} className="text-mex-gold" />
                            Datos de Pago (Transferencia):
                          </div>
                          <div className="text-[10px] text-stone-600 space-y-2 font-medium">
                            <div className="flex justify-between border-b border-stone-200/50 pb-1"><span className="text-stone-400">Banco</span> <span className="font-bold text-stone-900 tracking-tight">BBVA</span></div>
                            <div className="flex justify-between border-b border-stone-200/50 pb-1"><span className="text-stone-400">Titular</span> <span className="font-bold text-stone-900 tracking-tight">Antonieta Villagómez</span></div>
                            <div className="flex flex-col gap-1 pt-0.5">
                              <span className="text-stone-400">Número de Cuenta CLABE:</span>
                              <div className="bg-white px-3 py-1.5 rounded-xl border border-stone-100 font-mono font-black text-stone-900 text-center tracking-wider text-[11px] relative group cursor-copy">
                                4152 3135 1505 5627
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 pt-2 shrink-0">
                        <button
                          onClick={() => {
                            setPortalStep('chat');
                          }}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black py-4.5 rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-[0.15em] border-none cursor-pointer"
                        >
                          <MessageSquare size={16} className="animate-pulse" />
                          VER ESTADO EN VIVO Y RASTREO
                        </button>

                        <button
                          onClick={() => {
                            setPortalStep('auth');
                            setPortalClientName("");
                            setPortalClientPhone("");
                            setPortalActiveOrderId("");
                          }}
                          className="w-full bg-stone-50 text-stone-500 hover:bg-stone-100 text-[10px] py-3 rounded-xl font-black uppercase tracking-widest transition-colors border border-stone-200/60 cursor-pointer"
                        >
                          Realizar otro pedido
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 5: INTERACTIVE CLIENT CHAT SIMULATOR */}
                  {portalStep === 'chat' && (() => {
                    const portalActiveOrder = activeOrders.find(o => o.id === portalActiveOrderId);
                    const isOrderFinished = portalActiveOrder ? (
                      portalActiveOrder.status === 'cancelled' ||
                      (portalActiveOrder.isDelivered && portalActiveOrder.isPaid) ||
                      portalActiveOrder.status === 'paid'
                    ) : false;

                    if (isOrderFinished) {
                      const isCancelled = portalActiveOrder?.status === 'cancelled';
                      return (
                        <div className="p-8 h-full flex flex-col justify-center text-center space-y-8 animate-in fade-in duration-500">
                          <div className="space-y-6">
                            <div className={cn(
                              "w-16 h-16 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-md border",
                              isCancelled 
                                ? "bg-red-50 border-red-100 text-red-500" 
                                : "bg-emerald-50 border-emerald-100 text-mex-green"
                            )}>
                              {isCancelled ? <X className="stroke-[3]" size={32} /> : <Check className="stroke-[4]" size={32} />}
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-xl font-black text-stone-900 uppercase tracking-tighter">
                                {isCancelled ? "Pedido Cancelado" : "Servicio Finalizado"}
                              </h4>
                              <p className="text-xs text-stone-500 leading-relaxed font-semibold max-w-[220px] mx-auto italic">
                                {isCancelled 
                                  ? "Tu pedido ha sido cancelado por el restaurante. Por favor inicia uno nuevo o contáctanos directamente."
                                  : "¡Gracias por elegirnos! Esperamos que disfrutes tus alimentos."
                                }
                              </p>
                            </div>
                          </div>

                          <Button
                            onClick={() => {
                              setPortalStep('auth');
                              setPortalClientName("");
                              setPortalClientPhone("");
                              setPortalActiveOrderId("");
                            }}
                            className="w-full bg-stone-950 hover:bg-stone-800 text-white text-[10px] py-4 rounded-2xl font-black transition-all uppercase tracking-[0.2em] shadow-lg shadow-stone-200 border-none"
                          >
                            NUEVO PEDIDO
                          </Button>
                        </div>
                      );
                    }

                    // Ongoing order chat view
                    let statusText = "En cola";
                    let statusColor = "bg-stone-100 text-stone-500 border-stone-200";
                    let stepIcon = Clock;

                    if (portalActiveOrder) {
                      if (!portalActiveOrder.whatsAppConfirmed) {
                        statusText = "Esperando Autorización";
                        statusColor = "bg-amber-50 text-amber-600 border-amber-100";
                        stepIcon = ShieldCheck;
                      } else if (portalActiveOrder.status === 'pending') {
                        statusText = "Mesa de Control";
                        statusColor = "bg-blue-50 text-blue-600 border-blue-100";
                        stepIcon = Clock;
                      } else if (portalActiveOrder.status === 'preparing') {
                        statusText = "En Cocina";
                        statusColor = "bg-orange-50 text-orange-600 border-orange-100 animate-pulse";
                        stepIcon = ChefHat;
                      } else if (portalActiveOrder.status === 'ready') {
                        statusText = "¡LISTO PARA RECOGER!";
                        statusColor = "bg-mex-green text-white border-mex-green animate-bounce shadow-lg shadow-mex-green/20";
                        stepIcon = Package;
                      } else if (portalActiveOrder.status === 'served' || portalActiveOrder.isDelivered) {
                        statusText = "Entregado";
                        statusColor = "bg-stone-900 text-white border-stone-900";
                        stepIcon = Bike;
                      }
                    }

                    const StatusIcon = stepIcon;

                    return (
                      <div className="flex flex-col h-full bg-white relative animate-in fade-in duration-300">
                        {/* Live Status Bar - Minimal Refined */}
                        <div className="bg-white px-4 py-4 border-b border-stone-100 flex items-center justify-between z-10">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPortalStep('menu')}
                              className="bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-500 p-2.5 rounded-xl cursor-pointer transition-colors active:scale-95"
                              title="Regresar al Menú"
                            >
                              <ArrowLeft size={16} />
                            </button>
                            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-colors", statusColor.split(' ')[0], statusColor.split(' ')[1])}>
                              <StatusIcon size={20} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] text-stone-400 font-extrabold uppercase tracking-widest leading-none mb-1">Estado en Tiempo Real</span>
                              <span className={cn("text-[11px] font-black uppercase tracking-tight", !statusColor.includes('text-white') && statusColor.split(' ')[1])}>
                                {statusText}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex flex-col">
                            <span className="text-[8px] text-stone-400 font-extrabold uppercase tracking-widest leading-none mb-1">Tu Folio</span>
                            <span className="text-xs font-mono font-black text-stone-900">{portalActiveOrder?.folio}</span>
                          </div>
                        </div>

                        {/* Order Detail Summary Drawer/Banner */}
                        <div className="bg-stone-50 border-b border-stone-150 px-6 py-2.5 flex justify-between items-center text-[10px] font-bold text-stone-500 italic">
                          <div className="flex items-center gap-2">
                            <ShoppingBag size={12} />
                            <span>{portalActiveOrder?.items.length || 0} productos en orden</span>
                          </div>
                          <span className="text-mex-green font-black">{formatCurrency(portalActiveOrder?.total || 0)}</span>
                        </div>

                        {/* Chat messages viewport */}
                        <div 
                          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
                          style={{ 
                            backgroundColor: '#fafaf9',
                            backgroundImage: 'radial-gradient(#e5e7eb 0.5px, transparent 0.5px)',
                            backgroundSize: '20px 20px'
                          }}
                        >
                          {portalMessages.map((msg) => {
                            const isMe = msg.sender === 'client';
                            return (
                              <div
                                key={msg.id}
                                className={cn(
                                  "flex w-full mb-1 animate-in fade-in slide-in-from-bottom-2 duration-300",
                                  isMe ? "justify-end" : "justify-start"
                                )}
                              >
                                <div
                                  className={cn(
                                    "max-w-[75%] px-5 py-3 rounded-3xl text-xs relative shadow-sm border",
                                    isMe 
                                      ? "bg-stone-900 text-white rounded-tr-none border-stone-800" 
                                      : "bg-white text-stone-800 rounded-tl-none border-stone-200"
                                  )}
                                >
                                  <p className="whitespace-pre-wrap leading-relaxed text-[11px] font-semibold break-words tracking-tight">{msg.text}</p>
                                  <span className={cn("text-[8px] block text-right mt-1.5 font-bold uppercase tracking-widest", isMe ? "text-white/40" : "text-stone-300")}>
                                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : "Enviando..."}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={portalMessagesEndRef} />
                        </div>

                        {/* Text Input area footer */}
                        <div className="p-4 md:p-6 bg-white border-t border-stone-100 pb-safe">
                          <form onSubmit={handleSendPortalMessage} className="flex items-center gap-3 relative">
                            <input
                              type="text"
                              className="flex-1 bg-stone-50 border border-stone-150 rounded-2xl px-4 md:px-6 py-3 md:py-4 text-xs font-bold focus:outline-none focus:bg-white focus:ring-1 focus:ring-stone-400 transition-all shadow-inner"
                              placeholder="Escribe un mensaje de seguimiento..."
                              value={portalNewMessageText}
                              onChange={(e) => setPortalNewMessageText(e.target.value)}
                            />
                            <button
                              type="submit"
                              disabled={!portalNewMessageText.trim()}
                              className="bg-stone-950 hover:bg-mex-green text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl shadow-stone-200 transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0 disabled:opacity-30 disabled:scale-100 disabled:bg-stone-200 border-none px-0"
                            >
                              <Send size={18} />
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>

              {/* Outside help text for desktop view */}
              <div className="mt-4 text-[10px] text-stone-400 font-bold uppercase tracking-[0.3em] flex items-center gap-2">
                <span className="w-1 h-1 bg-stone-300 rounded-full" />
                Interfáz Segura & Minimalista
                <span className="w-1 h-1 bg-stone-300 rounded-full" />
              </div>
            </div>
          )}

        </div>
      )}

      {/* --- MODAL: CLIENT CREATE / EDIT FORM DIALOG --- */}
      {isClientFormOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm no-print">
          <Card className="w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-stone-200 animate-in zoom-in-95 duration-200 bg-white">
            <div className="bg-stone-900 text-white px-6 py-5 flex items-center justify-between">
              <h3 className="font-serif text-sm font-extrabold flex items-center gap-2 tracking-tight">
                <User size={18} className="text-emerald-400" />
                {selectedClient ? "Editar Perfil de Cliente" : "Registrar Nuevo Cliente"}
              </h3>
              <button
                type="button"
                onClick={() => setIsClientFormOpen(false)}
                className="text-stone-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase block">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nombre de pila o apellido..."
                  className="w-full bg-stone-100 px-4 py-2.5 rounded-xl text-xs border border-stone-200 focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-colors"
                  value={clientFormName}
                  onChange={(e) => setClientFormName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase block">Número de WhatsApp / Teléfono *</label>
                <input
                  type="tel"
                  required
                  placeholder="Teléfono a 10 dígitos..."
                  className="w-full bg-stone-100 px-4 py-2.5 rounded-xl text-xs border border-stone-200 focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-mono transition-colors"
                  value={clientFormPhone}
                  onChange={(e) => setClientFormPhone(e.target.value)}
                  disabled={!!selectedClient} // lock phone updates
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase block">Correo Electrónico (Opcional)</label>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  className="w-full bg-stone-100 px-4 py-2.5 rounded-xl text-xs border border-stone-200 focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-colors"
                  value={clientFormEmail}
                  onChange={(e) => setClientFormEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase block">Dirección de Entrega (Opcional)</label>
                <textarea
                  placeholder="Calle, Número, Colonia, Referencias de domicilio..."
                  className="w-full bg-stone-100 px-4 py-2.5 rounded-xl text-xs border border-stone-200 focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-colors h-16 resize-none"
                  value={clientFormAddress}
                  onChange={(e) => setClientFormAddress(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase block">Notas Adicionales / Gustos típicos (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Le gusta la salsa muy picante o es alérgico a los lácteos"
                  className="w-full bg-stone-100 px-4 py-2.5 rounded-xl text-xs border border-stone-200 focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-colors"
                  value={clientFormNotes}
                  onChange={(e) => setClientFormNotes(e.target.value)}
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-100 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsClientFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 hover:text-stone-800 hover:bg-stone-50 focus:outline-none border border-stone-200 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white focus:outline-none border border-emerald-600 shadow-sm cursor-pointer"
                >
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* --- MODAL: CONFIRM CLIENT DELETION --- */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[350] p-4 backdrop-blur-sm no-print">
          <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-stone-200 animate-in zoom-in-95 duration-200 bg-white">
            <div className="bg-red-600 text-white px-6 py-5 flex items-center justify-between">
              <h3 className="font-serif text-sm font-extrabold flex items-center gap-2 tracking-tight">
                <Trash2 size={18} className="text-white animate-pulse" />
                Eliminar Registro de Cliente
              </h3>
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente a <strong>{clientToDelete.name}</strong> ({clientToDelete.phone}) del sistema?
              </p>
              <div className="bg-red-50 border border-red-100 p-3 rounded-2xl text-[11px] text-red-800 leading-normal">
                ⚠️ <strong>Nota:</strong> Esta acción borrará permanentemente su perfil de cliente del simulador, pero no alterará las comandas históricas asociadas a este número de teléfono para fines de caja.
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-100 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setClientToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-800 hover:bg-stone-50 border border-stone-200 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmDeleteClient}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-red-650 hover:bg-red-700 text-white border border-red-750 shadow-sm cursor-pointer"
                >
                  Confirmar Eliminar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* --- MODAL: CONFIRM CHAT DELETION --- */}
      {chatToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[350] p-4 backdrop-blur-sm no-print">
          <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-stone-200 animate-in zoom-in-95 duration-200 bg-white">
            <div className="bg-red-600 text-white px-6 py-5 flex items-center justify-between">
              <h3 className="font-serif text-sm font-extrabold flex items-center gap-2 tracking-tight">
                <Trash2 size={18} className="text-white animate-pulse" />
                Eliminar Conversación
              </h3>
              <button
                type="button"
                onClick={() => setChatToDelete(null)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente la conversación de <strong>{chatToDelete.clientName}</strong> ({chatToDelete.clientPhone})?
              </p>
              <div className="bg-red-50 border border-red-100 p-3 rounded-2xl text-[11px] text-red-800 leading-normal">
                ⚠️ <strong>Nota:</strong> Esta acción borrará de manera definitiva el historial de este chat (mensajes) del simulador de WhatsApp. Esto NO alterará las comandas registradas en tu punto de venta.
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-100 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setChatToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-800 hover:bg-stone-50 border border-stone-200 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmDeleteChat}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-red-650 hover:bg-red-700 text-white border border-red-750 shadow-sm cursor-pointer"
                >
                  Confirmar Eliminar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
