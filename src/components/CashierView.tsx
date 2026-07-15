import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { CreditCard, DollarSign, Receipt, TrendingUp, TrendingDown, Clock, CheckCircle2, Trash2, Edit2, Plus, X, AlertTriangle, History, Package, UploadCloud, DownloadCloud, Eye, Image as LucideImage, Calculator, ClipboardCheck, User, BarChart3, PieChart as PieChartIcon, Utensils, ArrowUpRight, Sparkles, Calendar, Share2, RefreshCw, Printer, BookOpen, Loader2 } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { formatCurrency, cn, customRound } from "@/src/lib/utils";
import { Order, CashLog, OrderStatus, TipLoan, OrderItem } from "@/src/types";
import { db, auth } from "../firebase";
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, addDoc, deleteDoc, writeBatch, getDocs, getDocsFromServer } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firestoreErrorHandler";
import toast from "react-hot-toast";

import html2pdf from "html2pdf.js";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  AreaChart, 
  Area 
} from "recharts";

export const DENOMINATIONS = [
  { id: "1000", label: "$1,000 Pesos", val: 1000, type: "bill" as const },
  { id: "500", label: "$500 Pesos", val: 500, type: "bill" as const },
  { id: "200", label: "$200 Pesos", val: 200, type: "bill" as const },
  { id: "100", label: "$100 Pesos", val: 100, type: "bill" as const },
  { id: "50", label: "$50 Pesos", val: 50, type: "bill" as const },
  { id: "20_bill", label: "$20 Pesos (Billete)", val: 20, type: "bill" as const },
  { id: "20_coin", label: "$20 Pesos (Moneda)", val: 20, type: "coin" as const },
  { id: "10", label: "$10 Pesos", val: 10, type: "coin" as const },
  { id: "5", label: "$5 Pesos", val: 5, type: "coin" as const },
  { id: "2", label: "$2 Pesos", val: 2, type: "coin" as const },
  { id: "1", label: "$1 Peso", val: 1, type: "coin" as const },
  { id: "0.5", label: "$0.50 Centavos", val: 0.5, type: "coin" as const }
];

interface CashierViewProps {
  onEditOrder?: (order: Order) => void;
  userRole?: string;
}

export const CashierView = ({ onEditOrder, userRole = 'waiter' }: CashierViewProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cashLogs, setCashLogs] = useState<CashLog[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'credit'>('cash');
  const [cashReceived, setCashReceived] = useState<number | string>('');
  const [clientName, setClientName] = useState('');
  const [products, setProducts] = useState<any[]>([]); // Added for disposable price
  const [loading, setLoading] = useState(true);

  // Main navigation tab
  const [currentMainTab, setCurrentMainTab] = useState<'checkout' | 'reports'>('checkout');
  const [reportPeriod, setReportPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [checkoutMobileTab, setCheckoutMobileTab] = useState<'tables' | 'cashflow'>('tables');

  // New disposable state
  const [paymentDisposableQuantity, setPaymentDisposableQuantity] = useState(0);

  // States for Credit Collection
  const [creditOrders, setCreditOrders] = useState<Order[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'credits' | 'transactions' | 'loans'>('pending');
  const [tipLoans, setTipLoans] = useState<TipLoan[]>([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanAmount, setLoanAmount] = useState<string>('');
  const [loanReason, setLoanReason] = useState('');
  const [loanBorrower, setLoanBorrower] = useState('');
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);
  const [selectedCreditOrder, setSelectedCreditOrder] = useState<Order | null>(null);
  const [showCreditPaymentModal, setShowCreditPaymentModal] = useState(false);
  const [creditPaymentMethod, setCreditPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [creditCashReceived, setCreditCashReceived] = useState<number | string>('');
  const [creditTransferReceipt, setCreditTransferReceipt] = useState<string | null>(null);
  const [isDraggingCredit, setIsDraggingCredit] = useState(false);
  
  // New state variables for additional charges
  const [creditTip, setCreditTip] = useState(0);
  const [creditInterest, setCreditInterest] = useState(0);
  const [creditExtra, setCreditExtra] = useState(0);

  // Search and filter states for Cash Flow (historial)
  const [logFilterPeriod, setLogFilterPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [logFilterType, setLogFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [printReportData, setPrintReportData] = useState<any | null>(null);
  const [activeReportTab, setActiveReportTab] = useState<'summary' | 'daily' | 'weekly' | 'monthly' | 'detailed'>('summary');

  // Submission locks for preventing double click duplications
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isProcessingCreditPayment, setIsProcessingCreditPayment] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [showDuplicateDetails, setShowDuplicateDetails] = useState(false);

  // State variables for checkout items CRUD
  const [editingPaymentItem, setEditingPaymentItem] = useState<{ orderId: string; itemIndex: number; name: string; price: number; quantity: number; notes?: string } | null>(null);
  const [showAddPaymentItem, setShowAddPaymentItem] = useState<boolean>(false);
  const [addPaymentItemForm, setAddPaymentItemForm] = useState<{ name: string; price: number; quantity: number }>({ name: '', price: 0, quantity: 1 });

  const handleDeleteOrderItem = async (orderId: string, itemIndex: number) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderToUpdate = orders.find(o => o.id === orderId);
      if (!orderToUpdate) return;
      
      const newItems = [...orderToUpdate.items];
      newItems.splice(itemIndex, 1);
      
      // Recalculate total
      const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      await updateDoc(orderRef, {
        items: newItems,
        total: newTotal,
        updatedAt: new Date().toISOString()
      });
      
      // Update selectedGroup locally so total updates immediately
      setSelectedGroup(prev => {
        if (!prev) return null;
        const updatedOrders = prev.orders.map(o => {
          if (o.id === orderId) {
            return { ...o, items: newItems, total: newTotal };
          }
          return o;
        });
        const updatedTotal = updatedOrders.reduce((sum, o) => sum + o.total, 0);
        return {
          ...prev,
          orders: updatedOrders,
          total: updatedTotal
        };
      });
      
      toast.success("Artículo eliminado");
    } catch (error) {
      console.error("Error deleting order item:", error);
      toast.error("Error al eliminar el artículo");
    }
  };

  const handleUpdateOrderItem = async (orderId: string, itemIndex: number, name: string, price: number, quantity: number, notes?: string) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderToUpdate = orders.find(o => o.id === orderId);
      if (!orderToUpdate) return;
      
      const newItems = [...orderToUpdate.items];
      newItems[itemIndex] = {
        ...newItems[itemIndex],
        name: name.trim(),
        price: price,
        quantity: quantity,
        notes: notes || ""
      };
      
      // Recalculate total
      const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      await updateDoc(orderRef, {
        items: newItems,
        total: newTotal,
        updatedAt: new Date().toISOString()
      });
      
      // Update selectedGroup locally
      setSelectedGroup(prev => {
        if (!prev) return null;
        const updatedOrders = prev.orders.map(o => {
          if (o.id === orderId) {
            return { ...o, items: newItems, total: newTotal };
          }
          return o;
        });
        const updatedTotal = updatedOrders.reduce((sum, o) => sum + o.total, 0);
        return {
          ...prev,
          orders: updatedOrders,
          total: updatedTotal
        };
      });
      
      setEditingPaymentItem(null);
      toast.success("Artículo actualizado");
    } catch (error) {
      console.error("Error updating order item:", error);
      toast.error("Error al actualizar el artículo");
    }
  };

  const handleAddOrderItem = async (orderId: string, name: string, price: number, quantity: number) => {
    if (!name.trim()) {
      toast.error("Escribe un nombre para el artículo");
      return;
    }
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderToUpdate = orders.find(o => o.id === orderId);
      if (!orderToUpdate) return;
      
      const newItem: OrderItem = {
        productId: `custom-${Date.now()}`,
        name: name.trim(),
        price: price,
        quantity: quantity,
        status: 'completed',
        station: 'cocina'
      };
      
      const newItems = [...orderToUpdate.items, newItem];
      const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      await updateDoc(orderRef, {
        items: newItems,
        total: newTotal,
        updatedAt: new Date().toISOString()
      });
      
      // Update selectedGroup locally
      setSelectedGroup(prev => {
        if (!prev) return null;
        const updatedOrders = prev.orders.map(o => {
          if (o.id === orderId) {
            return { ...o, items: newItems, total: newTotal };
          }
          return o;
        });
        const updatedTotal = updatedOrders.reduce((sum, o) => sum + o.total, 0);
        return {
          ...prev,
          orders: updatedOrders,
          total: updatedTotal
        };
      });
      
      setShowAddPaymentItem(false);
      setAddPaymentItemForm({ name: '', price: 0, quantity: 1 });
      toast.success("Artículo agregado");
    } catch (error) {
      console.error("Error adding order item:", error);
      toast.error("Error al agregar el artículo");
    }
  };

  // Group log data by Day, Week, and Month for reporting
  const aggregatedHistory = React.useMemo(() => {
    const dailyMap: Record<string, { sales: number; expenses: number; count: number }> = {};
    const weeklyMap: Record<string, { sales: number; expenses: number; count: number; label: string }> = {};
    const monthlyMap: Record<string, { sales: number; expenses: number; count: number; label: string }> = {};

    cashLogs.forEach(log => {
      if (log.cancelled) return;
      const date = log.timestamp ? new Date(log.timestamp) : new Date();
      
      // Calculate Day key (YYYY-MM-DD local format)
      const year = date.getFullYear();
      const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
      const dayStr = date.getDate().toString().padStart(2, '0');
      const dayKey = `${year}-${monthStr}-${dayStr}`;
      
      // Calculate Week key
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
      const weekKey = `${date.getFullYear()}-W${weekNum}`;
      
      const monday = new Date(date);
      const currentDay = date.getDay();
      const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
      monday.setDate(date.getDate() + distanceToMon);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const weekLabel = `Semana ${weekNum} (${monday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })})`;

      // Calculate Month key
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });

      // Daily grouping
      if (!dailyMap[dayKey]) dailyMap[dayKey] = { sales: 0, expenses: 0, count: 0 };
      // Weekly grouping
      if (!weeklyMap[weekKey]) weeklyMap[weekKey] = { sales: 0, expenses: 0, count: 0, label: weekLabel };
      // Monthly grouping
      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { sales: 0, expenses: 0, count: 0, label: monthLabel };

      if (log.type === 'income') {
        const isOpeningCheck = log.reason.toLowerCase().includes('apertura');
        if (!isOpeningCheck) {
          dailyMap[dayKey].sales += log.amount;
          weeklyMap[weekKey].sales += log.amount;
          monthlyMap[monthKey].sales += log.amount;
          
          dailyMap[dayKey].count += 1;
          weeklyMap[weekKey].count += 1;
          monthlyMap[monthKey].count += 1;
        }
      } else if (log.type === 'expense') {
        dailyMap[dayKey].expenses += log.amount;
        weeklyMap[weekKey].expenses += log.amount;
        monthlyMap[monthKey].expenses += log.amount;
      }
    });

    const daily = Object.entries(dailyMap).map(([day, stats]) => ({
      period: day,
      sales: stats.sales,
      expenses: stats.expenses,
      net: stats.sales - stats.expenses,
      count: stats.count
    })).sort((a,b) => b.period.localeCompare(a.period));

    const weekly = Object.entries(weeklyMap).map(([week, stats]) => ({
      period: stats.label,
      sales: stats.sales,
      expenses: stats.expenses,
      net: stats.sales - stats.expenses,
      count: stats.count
    })).sort((a,b) => b.period.localeCompare(a.period));

    const monthly = Object.entries(monthlyMap).map(([month, stats]) => ({
      period: stats.label,
      sales: stats.sales,
      expenses: stats.expenses,
      net: stats.sales - stats.expenses,
      count: stats.count
    })).sort((a,b) => b.period.localeCompare(a.period));

    return { daily, weekly, monthly };
  }, [cashLogs]);

  // Find yesterday's duplicates with exact amounts, folios and timestamps
  const yesterdayDuplicates = React.useMemo(() => {
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    // Filter yesterday's income logs (non-cancelled)
    const logs = cashLogs.filter(log => {
      if (log.cancelled) return false;
      if (log.type !== 'income') return false;
      const d = log.timestamp ? new Date(log.timestamp) : new Date();
      return d.toDateString() === yesterdayStr;
    });

    const duplicates: { key: string; logs: CashLog[] }[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < logs.length; i++) {
      const logA = logs[i];
      if (processed.has(logA.id)) continue;

      const group: CashLog[] = [logA];

      for (let j = i + 1; j < logs.length; j++) {
        const logB = logs[j];
        if (processed.has(logB.id)) continue;

        let isDup = false;

        // 1. Same amount
        if (logA.amount === logB.amount) {
          // 2a. Same orderIds
          const hasSameOrderIds = logA.orderIds && logB.orderIds && 
            logA.orderIds.length > 0 && 
            logA.orderIds.some(id => logB.orderIds?.includes(id));
          
          // 2b. Same folios mentioned in reason
          const foliosA = logA.reason.match(/M\d+-\d+-\d+/g) || [];
          const foliosB = logB.reason.match(/M\d+-\d+-\d+/g) || [];
          const hasSameFolio = foliosA.length > 0 && foliosB.length > 0 &&
            foliosA.some(f => foliosB.includes(f));

          // 2c. Same reason and timestamp within 15 minutes
          const timeDiff = Math.abs(new Date(logA.timestamp).getTime() - new Date(logB.timestamp).getTime());
          const hasSameReasonCloseTime = logA.reason === logB.reason && timeDiff <= 15 * 60 * 1000;

          if (hasSameOrderIds || hasSameFolio || hasSameReasonCloseTime) {
            isDup = true;
          }
        }

        if (isDup) {
          group.push(logB);
          processed.add(logB.id);
        }
      }

      if (group.length > 1) {
        processed.add(logA.id);
        // Sort by timestamp so the oldest is first (the one to keep)
        group.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        duplicates.push({
          key: `${logA.amount}-${logA.reason}`,
          logs: group
        });
      }
    }

    return duplicates;
  }, [cashLogs]);

  // Memoized and filtered cash logs for visual history
  const filteredCashLogs = React.useMemo(() => {
    let result = [...cashLogs];

    // Filter by period
    const now = new Date();
    const todayStr = now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - 7);

    const startOfMonth = new Date();
    startOfMonth.setMonth(now.getMonth() - 1);

    result = result.filter(log => {
      if (!log.timestamp) return true;
      const logDate = new Date(log.timestamp);
      
      switch (logFilterPeriod) {
        case 'today':
          return logDate.toDateString() === todayStr;
        case 'yesterday':
          return logDate.toDateString() === yesterdayStr;
        case 'week':
          return logDate >= startOfWeek;
        case 'month':
          return logDate >= startOfMonth;
        case 'all':
        default:
          return true;
      }
    });

    // Filter by type
    if (logFilterType !== 'all') {
      result = result.filter(log => log.type === logFilterType);
    }

    // Filter by text search query
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase().trim();
      result = result.filter(log => {
        const matchesClient = log.clientName?.toLowerCase().includes(q) || false;
        const matchesReason = log.reason?.toLowerCase().includes(q) || false;
        const matchesUser = log.userName?.toLowerCase().includes(q) || false;
        const matchesItems = log.itemsSummary?.some(item => 
          item.name?.toLowerCase().includes(q)
        ) || false;
        return matchesClient || matchesReason || matchesUser || matchesItems;
      });
    }

    return result;
  }, [cashLogs, logFilterPeriod, logFilterType, logSearchQuery]);

  const processCreditReceiptFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor selecciona un archivo de imagen válido");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        setCreditTransferReceipt(event.target.result);
        toast.success("Foto del comprobante cargada");
      }
    };
    reader.readAsDataURL(file);
  };

  // Transfer payment States & Helpers
  const [transferReceipt, setTransferReceipt] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // States & helper for manual logs transfer receipts
  const [logTransferReceipt, setLogTransferReceipt] = useState<string | null>(null);
  const [isDraggingLogReceipt, setIsDraggingLogReceipt] = useState(false);

  const processLogReceiptFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor selecciona un archivo de imagen válido");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800; // Limit dimensions for compressed transfer receipt
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality jpeg
          setLogTransferReceipt(dataUrl);
          toast.success("Comprobante del movimiento cargado");
        } else {
          setLogTransferReceipt(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const processReceiptFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor selecciona un archivo de imagen válido");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800; // Limit dimensions for compressed transfer receipt
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality jpeg
          setTransferReceipt(dataUrl);
          toast.success("Comprobante cargado correctamente");
        } else {
          setTransferReceipt(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processReceiptFile(file);
    }
  };

  interface GroupedOrder {
    id: string; // tableNumber or orderId for takeaway
    displayTitle: string;
    isTakeaway: boolean;
    total: number;
    orders: Order[];
    folios: string[];
    waiterNames: string[];
    isUnconfirmed?: boolean;
  }

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastPaymentData, setLastPaymentData] = useState<{group: GroupedOrder, method: 'cash' | 'card' | 'transfer', total: number} | null>(null);

  const groupedOrders = orders.reduce((acc: GroupedOrder[], order) => {
    const key = order.isTakeaway ? order.id : order.tableNumber;
    let group = acc.find(g => g.id === key);
    
    if (!group) {
      group = {
        id: key,
        displayTitle: order.isTakeaway ? 'Para Llevar' : `Mesa ${order.tableNumber}`,
        isTakeaway: order.isTakeaway,
        total: 0,
        orders: [],
        folios: [],
        waiterNames: [],
        isUnconfirmed: order.isTakeaway && order.whatsAppConfirmed === false
      };
      acc.push(group);
    }
    
    group.orders.push(order);
    group.total += order.total;
    if (order.folio && !group.folios.includes(order.folio)) {
      group.folios.push(order.folio);
    }
    if (!group.waiterNames.includes(order.waiterName)) {
      group.waiterNames.push(order.waiterName);
    }
    if (order.isTakeaway && order.whatsAppConfirmed === false) {
      group.isUnconfirmed = true;
    }
    
    return acc;
  }, []);

  // CRUD for Cash Logs
  const [showLogModal, setShowLogModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [editingLog, setEditingLog] = useState<CashLog | null>(null);
  const [logForm, setLogForm] = useState({
    type: 'expense' as 'income' | 'expense' | 'opening' | 'closing',
    amount: '',
    reason: '',
    paymentMethod: 'cash' as 'cash' | 'transfer' | 'card',
    transferReceiptUrl: ''
  });

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    requireReason?: boolean;
    action: (reason?: string) => Promise<void>;
  } | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState("");

  // Arqueo de Caja (Cash Audit) States
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedHistoricalAudit, setSelectedHistoricalAudit] = useState<any | null>(null);
  const [auditType, setAuditType] = useState<'opening' | 'closing' | 'partial'>('partial');
  const [auditNotes, setAuditNotes] = useState('');
  const [cashAudits, setCashAudits] = useState<any[]>([]);
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({
    "1000": 0, "500": 0, "200": 0, "100": 0, "50": 0, "20_bill": 0, "20_coin": 0, "10": 0, "5": 0, "2": 0, "1": 0, "0.5": 0
  });
  const [showAdjustmentHelper, setShowAdjustmentHelper] = useState(false);
  const [customAdjustmentRaw, setCustomAdjustmentRaw] = useState('');

  const CARD_FEE_PERCENTAGE = 0.04; // 4% fee for card payments as requested

  useEffect(() => {
    const qOrders = query(
      collection(db, "orders"),
      where("status", "in", ["pending", "preparing", "ready", "served"]),
      orderBy("createdAt", "asc")
    );

    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const orderData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(orderData);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "orders");
    });

    const qLogs = query(collection(db, "cashLogs"), orderBy("timestamp", "desc"));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashLog));
      setCashLogs(logData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "cashLogs");
    });

    const qAudits = query(collection(db, "cashAudits"), orderBy("timestamp", "desc"));
    const unsubAudits = onSnapshot(qAudits, (snapshot) => {
      const auditData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCashAudits(auditData);
    }, (error) => {
      console.error("Error subscribing to cashAudits:", error);
    });

    const qTipLoans = query(collection(db, "tipLoans"), orderBy("createdAt", "desc"));
    const unsubTipLoans = onSnapshot(qTipLoans, (snapshot) => {
      const loanData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TipLoan));
      setTipLoans(loanData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "tipLoans");
    });

    const qCreditOrders = query(
      collection(db, "orders"),
      where("paymentMethod", "==", "credit")
    );

    const unsubCreditOrders = onSnapshot(qCreditOrders, (snapshot) => {
      const creditData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Order))
        .filter(order => order.creditStatus !== 'paid');
      setCreditOrders(creditData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "orders (credit)");
    });
    
    // Fetch products
    const qProducts = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products");
    });

    return () => {
      unsubOrders();
      unsubLogs();
      unsubAudits();
      unsubCreditOrders();
      unsubProducts();
      unsubTipLoans();
    };
  }, []);

  // Disposable helpers
  const disposableProduct = products.find(p => p.name.toLowerCase() === 'desechable');
  const disposablePrice = disposableProduct?.price || 0;
  const disposableTotal = paymentDisposableQuantity * disposablePrice;

  const cardFee = paymentMethod === 'card' ? customRound(((selectedGroup?.total || 0) + disposableTotal) * CARD_FEE_PERCENTAGE) : 0;
  const finalTotal = customRound((selectedGroup?.total || 0) + disposableTotal + cardFee);

  const handleAddTipLoan = async () => {
    if (!auth.currentUser || !loanAmount || !loanReason) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    setIsSubmittingLoan(true);
    const toastId = toast.loading("Registrando préstamo...");

    try {
      const batch = writeBatch(db);
      
      const loanRef = doc(collection(db, "tipLoans"));
      const amount = parseFloat(loanAmount);
      
      batch.set(loanRef, {
        amount: amount,
        reason: loanReason,
        borrowerName: loanBorrower,
        status: 'pending',
        createdAt: new Date().toISOString(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Admin'
      });

      const logRef = doc(collection(db, "cashLogs"));
      batch.set(logRef, {
        type: 'expense',
        amount: amount,
        reason: `PRÉSTAMO PROPINAS: ${loanReason}${loanBorrower ? ` (A: ${loanBorrower})` : ''}`,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Admin'
      });

      await batch.commit();

      toast.success("Préstamo registrado en caja", { id: toastId });
      setShowLoanModal(false);
      setLoanAmount('');
      setLoanReason('');
      setLoanBorrower('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "tipLoans");
      toast.error("Error al registrar préstamo", { id: toastId });
    } finally {
      setIsSubmittingLoan(false);
    }
  };

  const handleReturnTipLoan = async (loan: TipLoan) => {
    if (!auth.currentUser) return;
    const toastId = toast.loading("Registrando devolución...");

    try {
      const batch = writeBatch(db);
      
      const loanRef = doc(db, "tipLoans", loan.id);
      batch.update(loanRef, {
        status: 'returned',
        returnedAt: new Date().toISOString()
      });

      const logRef = doc(collection(db, "cashLogs"));
      batch.set(logRef, {
        type: 'income',
        amount: loan.amount,
        reason: `DEVOLUCIÓN PRÉSTAMO PROPINAS: ${loan.reason}`,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Admin'
      });

      await batch.commit();

      toast.success("Dinero regresado a caja", { id: toastId });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "tipLoans");
      toast.error("Error al registrar devolución", { id: toastId });
    }
  };

  const handleDeleteTipLoan = async (loanId: string) => {
    if (!window.confirm("¿Estás seguro de eliminar este registro de préstamo? Esta acción no se puede deshacer.")) return;
    
    const toastId = toast.loading("Eliminando registro...");
    try {
      await deleteDoc(doc(db, "tipLoans", loanId));
      toast.success("Préstamo eliminado", { id: toastId });
    } catch (error) {
      console.error("Error deleting tip loan:", error);
      toast.error("Error al eliminar préstamo", { id: toastId });
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedGroup || !auth.currentUser) return;
    if (isProcessingPayment) return;

    // Safety function: prevent duplicate payments for already paid orders
    const alreadyPaid = selectedGroup.orders.some(order => order.status === "paid");
    if (alreadyPaid) {
      toast.error("Error: Algunos de los folios ya han sido cobrados o registrados.");
      setSelectedGroup(null);
      setShowPaymentModal(false);
      return;
    }

    if (paymentMethod === 'credit' && !clientName.trim()) {
      toast.error("Por favor escribe el nombre del cliente para venta a crédito");
      return;
    }

    setIsProcessingPayment(true);
    const toastId = toast.loading("Registrando pago...");
    try {
      const batch = writeBatch(db);
      
      // Update all orders in the group to paid
      selectedGroup.orders.forEach(order => {
        const orderCardFee = paymentMethod === 'card' ? customRound(order.total * CARD_FEE_PERCENTAGE) : 0;
        const orderTotal = customRound(order.total + orderCardFee);
        
        order.clientName = paymentMethod === 'credit' ? clientName.trim() : undefined;

        const orderRef = doc(db, "orders", order.id);
        batch.update(orderRef, {
          status: 'paid',
          paymentMethod,
          cardFee: orderCardFee,
          total: orderTotal,
          transferReceiptUrl: paymentMethod === 'transfer' ? (transferReceipt || "") : null,
          clientName: paymentMethod === 'credit' ? clientName.trim() : null,
          creditStatus: paymentMethod === 'credit' ? 'pending' : null,
          updatedAt: new Date().toISOString()
        });
      });

      const itemsSummary: { name: string, quantity: number, price: number }[] = [];
      selectedGroup.orders.forEach(order => {
        order.items.forEach(item => {
          const existing = itemsSummary.find(i => i.name === item.name);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            itemsSummary.push({ name: item.name, quantity: item.quantity, price: item.price });
          }
        });
      });

      if (paymentDisposableQuantity > 0) {
        itemsSummary.push({ name: "Desechable", quantity: paymentDisposableQuantity, price: disposablePrice });
      }

      // Add cash log entry
      const logRef = doc(collection(db, "cashLogs"));
      const displayMethod = paymentMethod === 'card' ? 'Tarjeta' : paymentMethod === 'transfer' ? 'Transferencia' : paymentMethod === 'credit' ? 'Crédito' : 'Efectivo';
      const reasonSuffix = paymentMethod === 'credit' ? `Crédito: ${clientName.trim()}` : displayMethod;
      batch.set(logRef, {
        type: 'income',
        amount: finalTotal,
        reason: `Pago ${selectedGroup.displayTitle} (${reasonSuffix}) - Folios: ${selectedGroup.folios.join(', ')}`,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email,
        itemsSummary,
        disposableQuantity: paymentDisposableQuantity,
        transferReceiptUrl: paymentMethod === 'transfer' ? (transferReceipt || "") : null,
        orderIds: selectedGroup.orders.map(order => order.id),
        cancelled: false,
        clientName: paymentMethod === 'credit' ? clientName.trim() : null,
        paymentMethod: paymentMethod
      });

      await batch.commit();

      setLastPaymentData({ group: selectedGroup, method: paymentMethod, total: finalTotal });
      setShowPaymentModal(false);
      setShowSuccessModal(true);
      setSelectedGroup(null);
      setPaymentMethod('cash');
      setCashReceived('');
      setTransferReceipt(null);
      setClientName('');
      toast.success("Pago registrado correctamente", { id: toastId });
    } catch (error) {
      console.error("Error in handleConfirmPayment:", error);
      handleFirestoreError(error, OperationType.WRITE, "orders/cashLogs");
      toast.error("Error al procesar el pago", { id: toastId });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleConfirmCreditPayment = async () => {
    if (!selectedCreditOrder || !auth.currentUser) return;
    if (isProcessingCreditPayment) return;

    // Safety function: prevent duplicate payments for already settled credits
    if (selectedCreditOrder.creditStatus === "paid") {
      toast.error("Error: Este adeudo ya ha sido cobrado o liquidado.");
      setShowCreditPaymentModal(false);
      setSelectedCreditOrder(null);
      return;
    }

    setIsProcessingCreditPayment(true);
    const toastId = toast.loading("Registrando cobro de crédito...");
    try {
      const batch = writeBatch(db);

      // 1. Update the creditOrder
      const totalPaid = selectedCreditOrder.total + creditTip + creditInterest + creditExtra;
      const orderRef = doc(db, "orders", selectedCreditOrder.id);
      batch.update(orderRef, {
        creditStatus: 'paid',
        creditPaidAt: new Date().toISOString(),
        creditPaidMethod: creditPaymentMethod,
        tip: creditTip,
        interest: creditInterest,
        extra: creditExtra,
        totalPaid: totalPaid,
        updatedAt: new Date().toISOString()
      });

      // 2. Add cash log entry
      const logRef = doc(collection(db, "cashLogs"));
      const methodDisplay = creditPaymentMethod === 'card' ? 'Tarjeta' : creditPaymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo';
      let reason = `Cobro de Adeudo - ${selectedCreditOrder.clientName || 'Cliente'} (${methodDisplay}) - Folio: ${selectedCreditOrder.folio || selectedCreditOrder.id}`;
      if (creditTip > 0 || creditInterest > 0 || creditExtra > 0) {
        reason += ` (Ajustes: P:${formatCurrency(creditTip)} I:${formatCurrency(creditInterest)} E:${formatCurrency(creditExtra)})`;
      }
      
      batch.set(logRef, {
        type: 'income',
        amount: totalPaid,
        reason: reason,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email,
        transferReceiptUrl: creditPaymentMethod === 'transfer' ? (creditTransferReceipt || "") : null,
        orderIds: [selectedCreditOrder.id],
        cancelled: false,
        clientName: selectedCreditOrder.clientName || null,
        isCreditSettlement: true,
        paymentMethod: creditPaymentMethod
      });

      await batch.commit();

      setShowCreditPaymentModal(false);
      setSelectedCreditOrder(null);
      setCreditCashReceived('');
      setCreditTransferReceipt(null);
      setCreditTip(0);
      setCreditInterest(0);
      setCreditExtra(0);
      toast.success("Cobro de crédito registrado correctamente", { id: toastId });
    } catch (error) {
      console.error("Error in handleConfirmCreditPayment:", error);
      toast.error("Error al registrar cobro de crédito", { id: toastId });
    } finally {
      setIsProcessingCreditPayment(false);
    }
  };

  const handleSaveLog = async () => {
    if (!auth.currentUser) return;
    if (isSavingLog) return;

    try {
      const amount = parseFloat(logForm.amount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Por favor ingresa un monto válido");
        return;
      }
      if (!logForm.reason.trim()) {
        toast.error("Por favor ingresa una razón");
        return;
      }

      setIsSavingLog(true);
      const logData: any = {
        type: logForm.type,
        amount: amount,
        reason: logForm.reason.trim(),
        timestamp: editingLog ? editingLog.timestamp : new Date().toISOString(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email
      };

      if (logForm.type === 'income' || logForm.type === 'expense') {
        logData.paymentMethod = logForm.paymentMethod;
        logData.transferReceiptUrl = logForm.paymentMethod === 'transfer' ? (logTransferReceipt || "") : "";
      }

      if (editingLog) {
        await updateDoc(doc(db, "cashLogs", editingLog.id), logData);
        toast.success("Registro actualizado");
      } else {
        await addDoc(collection(db, "cashLogs"), logData);
        toast.success("Registro guardado");
      }

      setShowLogModal(false);
      setEditingLog(null);
      setLogForm({ type: 'expense', amount: '', reason: '', paymentMethod: 'cash', transferReceiptUrl: '' });
      setLogTransferReceipt(null);
    } catch (error) {
      console.error("Error saving log:", error);
      toast.error("Error al guardar el registro");
    } finally {
      setIsSavingLog(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    setCancelReasonText("");
    setConfirmAction({
      title: "Eliminar Registro Permanentemente",
      message: "¿Estás seguro de que deseas borrar este registro de caja? Para mantener la trazabilidad contable, se conservará marcado como [CANCELADO] en el historial con el motivo que especifiques.",
      requireReason: true,
      action: async (reason) => {
        const toastId = toast.loading("Eliminando/Cancelando registro...");
        try {
          await updateDoc(doc(db, "cashLogs", id), {
            cancelled: true,
            cancelledAt: new Date().toISOString(),
            cancelledBy: auth.currentUser?.displayName || auth.currentUser?.email || "Usuario",
            cancelReason: reason || "Sin motivo"
          });
          toast.success("Registro cancelado correctamente", { id: toastId });
        } catch (error) {
          console.error("Error deleting/cancelling log:", error);
          toast.error("Error al cancelar el registro", { id: toastId });
        } finally {
          setShowConfirmModal(false);
          setConfirmAction(null);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleCancelGroupOrders = (group: GroupedOrder) => {
    setConfirmAction({
      title: `Cancelar Cuenta - ${group.displayTitle}`,
      message: `¿Estás seguro de que deseas cancelar todos los pedidos de esta mesa o comanda (Folios: ${group.folios.join(', ')})? Esto los marcará como cancelados sin borrarlos del sistema.`,
      action: async () => {
        const toastId = toast.loading("Cancelando pedidos...");
        try {
          const batch = writeBatch(db);
          group.orders.forEach(order => {
            const orderRef = doc(db, "orders", order.id);
            batch.update(orderRef, {
              status: "cancelled",
              updatedAt: new Date().toISOString()
            });
          });
          await batch.commit();
          toast.success("Pedidos cancelados correctamente", { id: toastId });
        } catch (error) {
          console.error("Error cancelling group orders:", error);
          toast.error("Error al cancelar los pedidos", { id: toastId });
        } finally {
          setShowConfirmModal(false);
          setConfirmAction(null);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleAcceptGroupOrders = async (group: GroupedOrder) => {
    const toastId = toast.loading("Confirmando pedido...");
    try {
      const batch = writeBatch(db);
      group.orders.forEach(order => {
        const orderRef = doc(db, "orders", order.id);
        batch.update(orderRef, {
          whatsAppConfirmed: true,
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
      
      // Notify the customer on WhatsApp if the order is from WhatsApp
      for (const order of group.orders) {
        if (order.waiterId && order.waiterId.startsWith("whatsapp-")) {
          const cleanPhone = order.waiterId.replace("whatsapp-", "");
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
      }

      toast.success("¡Pedido confirmado y enviado a cocina!", { id: toastId });
    } catch (error) {
      console.error("Error accepting group orders:", error);
      toast.error("Error al confirmar el pedido", { id: toastId });
    }
  };

  const handleCancelCobro = (log: CashLog) => {
    setCancelReasonText("");
    setConfirmAction({
      title: log.type === 'income' ? "Cancelar Cobro" : "Cancelar Registro",
      message: `¿Estás seguro de que deseas cancelar este registro de ${log.type === 'income' ? 'ingreso/cobro' : 'egreso'} de ${formatCurrency(log.amount)}? El registro NO se eliminará, pero se marcará como [CANCELADO] y no afectará el balance de caja ni las estadísticas. ${log.orderIds && log.orderIds.length > 0 ? "Los pedidos asociados a este cobro también se marcarán como cancelados en el sistema." : ""}`,
      requireReason: true,
      action: async (reason) => {
        const toastId = toast.loading("Cancelando cobro/registro...");
        try {
          const batch = writeBatch(db);
          
          // 1. Mark CashLog as cancelled
          const logRef = doc(db, "cashLogs", log.id);
          batch.update(logRef, {
            cancelled: true,
            cancelledAt: new Date().toISOString(),
            cancelledBy: auth.currentUser?.displayName || auth.currentUser?.email || "Usuario",
            cancelReason: reason || "Sin motivo",
            reason: log.reason.startsWith("[CANCELADO]") ? log.reason : `[CANCELADO] ${log.reason}`
          });

          // 2. Mark associated orders as cancelled
          if (log.orderIds && log.orderIds.length > 0) {
            log.orderIds.forEach(orderId => {
              const orderRef = doc(db, "orders", orderId);
              batch.update(orderRef, {
                status: "cancelled",
                updatedAt: new Date().toISOString()
              });
            });
          }

          await batch.commit();
          toast.success("Registro/Cobro cancelado correctamente", { id: toastId });
        } catch (error) {
          console.error("Error cancelling log/cobro:", error);
          toast.error("Error al cancelar el registro", { id: toastId });
        } finally {
          setShowConfirmModal(false);
          setConfirmAction(null);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleResolveDuplicates = async (dupGroup: { key: string; logs: CashLog[] }) => {
    if (dupGroup.logs.length <= 1) return;
    
    // The first item (oldest) is the one to keep, the rest are duplicates to delete.
    const toKeep = dupGroup.logs[0];
    const toDelete = dupGroup.logs.slice(1);
    
    const toastId = toast.loading(`Eliminando ${toDelete.length} registro(s) duplicado(s)...`);
    try {
      const batch = writeBatch(db);
      toDelete.forEach(log => {
        const logRef = doc(db, "cashLogs", log.id);
        batch.delete(logRef);
      });
      await batch.commit();
      toast.success("Duplicados eliminados correctamente", { id: toastId });
    } catch (error) {
      console.error("Error resolving duplicates:", error);
      toast.error("Error al eliminar los registros duplicados", { id: toastId });
    }
  };

  const handleResolveAllYesterdayDuplicates = async (yesterdayDups: { key: string; logs: CashLog[] }[]) => {
    if (yesterdayDups.length === 0) return;
    
    if (!window.confirm(`¿Estás seguro de que deseas eliminar automáticamente todos los registros duplicados detectados del día de ayer? Se conservará el primer registro original de cada grupo y se eliminarán los repetidos. Esta acción es irreversible.`)) {
      return;
    }

    const toastId = toast.loading("Eliminando todos los duplicados del día de ayer...");
    try {
      const batch = writeBatch(db);
      let count = 0;
      yesterdayDups.forEach(group => {
        const toDelete = group.logs.slice(1);
        toDelete.forEach(log => {
          const logRef = doc(db, "cashLogs", log.id);
          batch.delete(logRef);
          count++;
        });
      });
      await batch.commit();
      toast.success(`Se eliminaron con éxito ${count} registros duplicados de ayer.`, { id: toastId });
    } catch (error) {
      console.error("Error resolving all duplicates:", error);
      toast.error("Error al eliminar todos los duplicados", { id: toastId });
    }
  };

  const openEditLog = (log: CashLog) => {
    setEditingLog(log);
    setLogForm({
      type: log.type as any,
      amount: log.amount.toString(),
      reason: log.reason,
      paymentMethod: (log as any).paymentMethod || 'cash',
      transferReceiptUrl: (log as any).transferReceiptUrl || ''
    });
    setLogTransferReceipt((log as any).transferReceiptUrl || null);
    setShowLogModal(true);
  };

  // Get current session's active logs. We parse descending from index 0 until we reach a shift boundary (opening or closing).
  const currentSessionLogs = React.useMemo(() => {
    const activeLogs: CashLog[] = [];
    for (const log of cashLogs) {
      if (log.cancelled) continue;
      
      if (log.type === 'closing') {
        // Enforce boundary: a closing log marks the end of the shift prior to this log,
        // so we stop collecting and do not include the closing log or anything older.
        break;
      }
      
      if (log.type === 'opening') {
        // Enforce boundary: an opening log marks the start of this active shift, so we include it and stop.
        activeLogs.push(log);
        break;
      }
      
      activeLogs.push(log);
    }
    return activeLogs;
  }, [cashLogs]);

  const sessionStats = React.useMemo(() => {    return currentSessionLogs.reduce((acc, log) => {
      if (log.cancelled) return acc;

      if (log.type === 'income') {
        const reasonLower = log.reason.toLowerCase();
        
        // Use a more robust check for credit settlements
        const isCreditSettlementCheck = log.isCreditSettlement || 
                                      reasonLower.includes('cobro de adeudo') || 
                                      reasonLower.includes('cobro de crédito') || 
                                      reasonLower.includes('cobro de credito');

        if (isCreditSettlementCheck) {
          const method = log.paymentMethod || (reasonLower.includes('tarjeta') ? 'card' : reasonLower.includes('transferencia') ? 'transfer' : 'cash');
          if (method === 'card') {
            acc.creditSettlementsCard += log.amount;
          } else if (method === 'transfer') {
            acc.creditSettlementsTransfer += log.amount;
          } else {
            acc.creditSettlementsCash += log.amount;
          }
        } else {
          // Robust check for classification
          const methodLower = (log.paymentMethod || "").toLowerCase();
          const isCredit = reasonLower.includes('crédito') || reasonLower.includes('credito') || methodLower === 'crédito' || methodLower === 'credito' || methodLower === 'credit';
          const isCard = reasonLower.includes('tarjeta') || methodLower.includes('tarjeta') || methodLower === 'card';
          const isTransfer = reasonLower.includes('transferencia') || methodLower.includes('transferencia') || methodLower === 'transfer';

          if (isCard) {
            acc.cardSales += log.amount;
          } else if (isTransfer) {
            acc.transferSales += log.amount;
          } else if (isCredit) {
            acc.creditSales += log.amount;
          } else {
            acc.cashSales += log.amount;
          }
        }
      } else if (log.type === 'expense') {
        acc.expenses += log.amount;
      } else if (log.type === 'opening') {
        acc.opening += log.amount;
      }
      return acc;
    }, {
      cashSales: 0,
      cardSales: 0,
      transferSales: 0,
      creditSales: 0,
      expenses: 0,
      opening: 0,
      creditSettlementsCash: 0,
      creditSettlementsCard: 0,
      creditSettlementsTransfer: 0
    });
  }, [currentSessionLogs]);

  // Sum the actual cash in the physical drawer for the current session (Only cash: no Tarjeta/Transferencia/Crédito)
  const totalCash = React.useMemo(() => {
    return sessionStats.opening + sessionStats.cashSales + sessionStats.creditSettlementsCash - sessionStats.expenses;
  }, [sessionStats]);

  // Sum the total uncollected/pending credits across all accounts (Saldo Total de Crédito)
  const totalCreditBalance = React.useMemo(() => {
    return creditOrders.reduce((acc, order) => acc + order.total, 0);
  }, [creditOrders]);

  const lastClosingAudit = React.useMemo(() => {
    return cashAudits.find(audit => audit.type === 'closing' && !audit.cancelled);
  }, [cashAudits]);

  const sessionOpeningCash = sessionStats.opening;
  const sessionCashSales = sessionStats.cashSales;
  const sessionCardSales = sessionStats.cardSales;
  const sessionTransferSales = sessionStats.transferSales;
  const sessionCreditSales = sessionStats.creditSales;
  const sessionExpenses = sessionStats.expenses;

  const handleReprintHistoryTicket = (log: CashLog) => {
    let method: 'cash'|'card'|'transfer'|'credit' = 'cash';
    const reasonLower = log.reason.toLowerCase();
    if (reasonLower.includes('tarjeta')) method = 'card';
    else if (reasonLower.includes('transferencia')) method = 'transfer';
    else if (reasonLower.includes('crédito') || reasonLower.includes('credito')) method = 'credit';

    const foliosMatch = log.reason.match(/Folios?:\s*(.*)/i);
    const folios = foliosMatch ? foliosMatch[1].split(',').map(s => s.trim()) : [];

    const group: GroupedOrder = {
      id: "historial",
      displayTitle: log.reason.split(' - ')[0] || "Reimpresión",
      isTakeaway: false,
      total: log.amount,
      orders: [{
        id: "historial",
        tableNumber: "Reimpresión",
        waiterName: log.userName,
        waiterId: log.userId,
        status: "paid" as const,
        createdAt: log.timestamp,
        updatedAt: log.timestamp,
        total: log.amount,
        isTakeaway: false,
        takeawayFee: 0,
        items: (log.itemsSummary || []) as any
      }],
      waiterNames: [log.userName],
      folios: folios
    };

    setLastPaymentData({ group, method: method as any, total: log.amount });
    setShowSuccessModal(true);
  };

  const generateTicketPDF = async (shouldDownload = true) => {
    if (!lastPaymentData) return null;
    const element = document.getElementById("ticket-content");
    if (!element) return null;

    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, 150] // Ticket size
      });

      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, width, height);
      if (shouldDownload) {
        pdf.save(`ticket-${lastPaymentData.group.folios.join("-")}.pdf`);
      }
      return pdf;
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar el PDF");
      return null;
    }
  };

  const handleSendEmail = () => {
    if (!lastPaymentData) return;
    const subject = encodeURIComponent(`Ticket de Venta - Las Cazuelas del Castor`);
    const body = encodeURIComponent(`Gracias por su compra.\n\nTotal: ${formatCurrency(lastPaymentData.total)}\nFolios: ${lastPaymentData.group.folios.join(", ")}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePrintReport = (period: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    const data = getReportData(period);
    const labels = { today: 'Hoy', yesterday: 'Ayer', 'week': 'Esta Semana', month: 'Este Mes', all: 'Todo el Historial' };
    setPrintReportData({
      ...data,
      period,
      periodLabel: labels[period] || 'Reporte de Flujo',
      timestamp: new Date().toISOString()
    });
  };

  const generatePdf = (elementId: string, filename: string) => {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        toast.error(`No se encontró la sección para imprimir (${elementId})`);
        return;
      }
      
      // Create temporary clone to avoid altering the display:none
      const clone = element.cloneNode(true) as HTMLElement;
      clone.classList.remove('print-only');
      clone.style.display = 'block';
      clone.style.backgroundColor = '#ffffff';
      clone.style.color = '#000000';
      clone.style.padding = '20px';
      clone.style.boxSizing = 'border-box';
      
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '100%';
      container.style.height = '100vh';
      container.style.overflow = 'hidden';
      container.appendChild(clone);
      document.body.appendChild(container);

      const opt = {
        margin:       10,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' }
      };
      
      const html2pdfLib = typeof html2pdf === 'function' ? html2pdf : (html2pdf as any).default;
      
      if (!html2pdfLib) {
        toast.error("Formatos PDF no soportados por el navegador, abriendo menú de impresión...", { id: "pdf-status" });
        window.print();
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
        return;
      }

      toast.loading("Generando archivo PDF...", { id: "pdf-status" });

      html2pdfLib().set(opt).from(clone).save().then(() => {
        toast.success("PDF guardado correctamente", { id: "pdf-status" });
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
      }).catch((err: any) => {
        console.error("PDF generation exception: ", err);
        toast.error("Error al procesar PDF, abriendo menú de impresión clásico...", { id: "pdf-status" });
        window.print();
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
      });
    } catch (e: any) {
      console.error("PDF generation failed synchronous flow: ", e);
      toast.error("Ocurrió un detalle al crear el archivo. Abriendo impresión clásica...", { id: "pdf-status" });
      window.print();
    }
  };

  const stats = cashLogs.reduce((acc, log) => {
    if (log.cancelled) return acc;
    const isToday = new Date(log.timestamp).toDateString() === new Date().toDateString();
    if (!isToday) return acc;

    if (log.type === 'income') {
      const reasonLower = log.reason.toLowerCase();
      const isCreditSettlement = log.isCreditSettlement || 
                                reasonLower.includes('cobro de adeudo') || 
                                reasonLower.includes('cobro de crédito') || 
                                reasonLower.includes('cobro de credito');

      if (isCreditSettlement) {
        const method = log.paymentMethod || (reasonLower.includes('tarjeta') ? 'card' : reasonLower.includes('transferencia') ? 'transfer' : 'cash');
        if (method === 'card') {
          acc.creditSettlementsCard += log.amount;
        } else if (method === 'transfer') {
          acc.creditSettlementsTransfer += log.amount;
        } else {
          acc.creditSettlementsCash += log.amount;
        }
      } else {
        const method = log.paymentMethod || (reasonLower.includes('tarjeta') ? 'card' : reasonLower.includes('transferencia') ? 'transfer' : (reasonLower.includes('crédito') || reasonLower.includes('credito') ? 'credit' : 'cash'));
        if (method === 'card') {
          acc.cardSales += log.amount;
        } else if (method === 'transfer') {
          acc.transferSales += log.amount;
        } else if (method === 'credit') {
          acc.creditSales += log.amount;
        } else {
          acc.cashSales += log.amount;
        }
      }
    } else if (log.type === 'expense') {
      acc.expenses += log.amount;
    } else if (log.type === 'opening') {
      acc.opening = log.amount;
    }
    return acc;
  }, { 
    cashSales: 0, 
    cardSales: 0, 
    transferSales: 0, 
    creditSales: 0, 
    expenses: 0, 
    opening: 0,
    creditSettlementsCash: 0,
    creditSettlementsCard: 0,
    creditSettlementsTransfer: 0
  });

  const getReportData = (period: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    const now = new Date();
    
    // Filter out logs for the selected period
    const filteredLogs = cashLogs.filter(log => {
      if (log.cancelled) return false;
      if (log.type !== 'income') return false;
      
      const logDate = log.timestamp ? new Date(log.timestamp) : new Date();
      
      if (period === 'today') {
        return logDate.toDateString() === now.toDateString();
      } else if (period === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        return logDate.toDateString() === yesterday.toDateString();
      } else if (period === 'week') {
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay() || 7; 
        if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
        startOfWeek.setHours(0, 0, 0, 0);
        return logDate >= startOfWeek;
      } else if (period === 'month') {
        return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
      } else {
        return true; // All time
      }
    });

    // Calculate metrics
    const totalSales = filteredLogs.reduce((sum, log) => sum + log.amount, 0);
    const totalTransactions = filteredLogs.length;
    const averageTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    
    // Calculate expenses for this period
    const filteredExpenses = cashLogs.filter(log => {
      if (log.cancelled || log.type !== 'expense') return false;
      const logDate = log.timestamp ? new Date(log.timestamp) : new Date();
      if (period === 'today') {
        return logDate.toDateString() === now.toDateString();
      } else if (period === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        return logDate.toDateString() === yesterday.toDateString();
      } else if (period === 'week') {
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay() || 7; 
        if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
        startOfWeek.setHours(0, 0, 0, 0);
        return logDate >= startOfWeek;
      } else if (period === 'month') {
        return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
      } else {
        return true;
      }
    });
    const totalExpenses = filteredExpenses.reduce((sum, log) => sum + log.amount, 0);
    
    // 1. Payment Methods and Credit Recovery Composition
    let cashSales = 0;
    let cardSales = 0;
    let transferSales = 0;
    let creditSales = 0;
    let creditSettlementsCash = 0;
    let creditSettlementsCard = 0;
    let creditSettlementsTransfer = 0;

    filteredLogs.forEach(log => {
      const reasonLower = log.reason.toLowerCase();
      
      const isCreditSettlementCheck = log.isCreditSettlement || 
                                    reasonLower.includes('cobro de adeudo') || 
                                    reasonLower.includes('cobro de crédito') || 
                                    reasonLower.includes('cobro de credito');

      if (isCreditSettlementCheck) {
        const method = log.paymentMethod || (reasonLower.includes('tarjeta') ? 'card' : reasonLower.includes('transferencia') ? 'transfer' : 'cash');
        if (method === 'card') {
          creditSettlementsCard += log.amount;
        } else if (method === 'transfer') {
          creditSettlementsTransfer += log.amount;
        } else {
          creditSettlementsCash += log.amount;
        }
      } else {
        const methodLower = (log.paymentMethod || "").toLowerCase();
        const isCredit = reasonLower.includes('crédito') || reasonLower.includes('credito') || methodLower === 'crédito' || methodLower === 'credito' || methodLower === 'credit';
        const isCard = reasonLower.includes('tarjeta') || methodLower.includes('tarjeta') || methodLower === 'card';
        const isTransfer = reasonLower.includes('transferencia') || methodLower.includes('transferencia') || methodLower === 'transfer';

        if (isCard) {
          cardSales += log.amount;
        } else if (isTransfer) {
          transferSales += log.amount;
        } else if (isCredit) {
          creditSales += log.amount;
        } else {
          cashSales += log.amount;
        }
      }
    });

    const totalCashInDrawer = cashSales + creditSettlementsCash;
    const totalCard = cardSales + creditSettlementsCard;
    const totalTransfer = transferSales + creditSettlementsTransfer;
    const totalCreditRecovery = creditSettlementsCash + creditSettlementsCard + creditSettlementsTransfer;

    const paymentMethods: Record<string, number> = {
      'Efectivo': cashSales,
      'Tarjeta': cardSales,
      'Transferencia': transferSales,
      'Crédito': creditSales,
      'Cobro Crédito (Efe)': creditSettlementsCash,
      'Cobro Crédito (Tar)': creditSettlementsCard,
      'Cobro Crédito (Trf)': creditSettlementsTransfer
    };

    const paymentMethodPieData = Object.entries(paymentMethods)
      .map(([key, value]) => {
        let color = '#006847';
        if (key === 'Tarjeta') color = '#3B82F6';
        else if (key === 'Transferencia') color = '#8B5CF6';
        else if (key === 'Crédito') color = '#CE1126';
        else if (key === 'Cobro Crédito (Efe)') color = '#10B981';
        else if (key === 'Cobro Crédito (Tar)') color = '#60A5FA';
        else if (key === 'Cobro Crédito (Trf)') color = '#A78BFA';
        return { name: key, value, color };
      })
      .filter(item => item.value > 0);

    // 2. Top Products Sold
    const productsMap: Record<string, { quantity: number, revenue: number, category?: string }> = {};
    filteredLogs.forEach(log => {
      if (log.itemsSummary) {
        log.itemsSummary.forEach(item => {
          if (!productsMap[item.name]) {
            productsMap[item.name] = { quantity: 0, revenue: 0 };
          }
          productsMap[item.name].quantity += item.quantity;
          productsMap[item.name].revenue += item.quantity * item.price;
        });
      }
    });
    
    const topProducts = Object.entries(productsMap)
      .map(([name, stats]) => ({
        name,
        quantity: stats.quantity,
        revenue: stats.revenue
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);

    // 3. Waiter Performance
    const staffMap: Record<string, { sales: number, count: number }> = {};
    filteredLogs.forEach(log => {
      const staffName = log.userName || 'Caja';
      if (!staffMap[staffName]) {
        staffMap[staffName] = { sales: 0, count: 0 };
      }
      staffMap[staffName].sales += log.amount;
      staffMap[staffName].count += 1;
    });
    
    const staffSales = Object.entries(staffMap)
      .map(([name, stats]) => ({
        name,
        sales: stats.sales,
        count: stats.count
      }))
      .sort((a, b) => b.sales - a.sales);

    // 4. Trend Data (Chronological Date or Hour buckets)
    let trendData: any[] = [];
    
    if (period === 'today' || period === 'yesterday') {
      // Hourly intervals
      const hourlyBuckets: Record<string, number> = {};
      
      // Seed common hourly buckets
      for (let i = 8; i <= 23; i++) {
        hourlyBuckets[`${i.toString().padStart(2, '0')}:00`] = 0;
      }
      
      filteredLogs.forEach(log => {
        const date = log.timestamp ? new Date(log.timestamp) : new Date();
        const hour = date.getHours();
        const key = `${hour.toString().padStart(2, '0')}:00`;
        if (hour >= 8 && hour <= 23) {
          hourlyBuckets[key] = (hourlyBuckets[key] || 0) + log.amount;
        }
      });
      
      trendData = Object.entries(hourlyBuckets).map(([hour, amount]) => ({
        label: hour,
        Ventas: amount
      }));
    } else {
      const dateBuckets: Record<string, { timestamp: number; total: number }> = {};
      
      filteredLogs.forEach(log => {
        const date = log.timestamp ? new Date(log.timestamp) : new Date();
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const key = startOfDay.toISOString();
        
        if (!dateBuckets[key]) {
          dateBuckets[key] = {
            timestamp: startOfDay.getTime(),
            total: 0
          };
        }
        dateBuckets[key].total += log.amount;
      });
      
      trendData = Object.entries(dateBuckets)
        .map(([_, details]) => ({
          timestamp: details.timestamp,
          label: new Date(details.timestamp).toLocaleDateString("es-MX", { day: '2-digit', month: 'short' }),
          Ventas: details.total
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
    }

    return {
      totalSales,
      totalTransactions,
      averageTicket,
      totalExpenses,
      paymentMethodPieData,
      topProducts,
      staffSales,
      trendData,
      filteredLogs,
      cashSales,
      cardSales,
      transferSales,
      creditSales,
      creditSettlementsCash,
      creditSettlementsCard,
      creditSettlementsTransfer,
      totalCashInDrawer,
      totalCard,
      totalTransfer,
      totalCreditRecovery
    };
  };

  const calculatePhysicalTotal = (countsMap: Record<string, number>) => {
    return Object.entries(countsMap).reduce((sum, [key, count]) => {
      const denomination = DENOMINATIONS.find(d => d.id === key);
      const val = denomination ? denomination.val : 0;
      return sum + (val * count);
    }, 0);
  };

  const handleLoadLastClosingCounts = () => {
    if (lastClosingAudit) {
      setAuditCounts({
        "1000": 0, "500": 0, "200": 0, "100": 0, "50": 0, "20_bill": 0, "20_coin": 0, "10": 0, "5": 0, "2": 0, "1": 0, "0.5": 0,
        ...(lastClosingAudit.counts || {})
      });
      setAuditNotes(`Iniciado con saldo del arqueo de cierre anterior (${formatCurrency(lastClosingAudit.totalPhysical)})`);
      toast.success("Denominaciones de la jornada anterior cargadas.");
    }
  };

  const handleAddPresetDenomination = (denomId: string, count: number) => {
    setAuditCounts(prev => {
      const updated = { ...prev, [denomId]: (prev[denomId] || 0) + count };
      return updated;
    });
    const denom = DENOMINATIONS.find(d => d.id === denomId);
    if (denom) {
      const logText = `Ajuste rápido: +${count} de ${denom.label}.`;
      setAuditNotes(prev => prev ? `${prev}\n${logText}` : logText);
    }
    const val = DENOMINATIONS.find(d => d.id === denomId)?.val || 0;
    toast.success(`Se agregaron ${count} de ${formatCurrency(val)}`);
  };

  const handleApplyCustomAdjustment = (isAddition: boolean) => {
    let amount = parseFloat(customAdjustmentRaw);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Por favor, ingresa un monto de ajuste válido.");
      return;
    }

    const currentNotes = auditNotes;
    let newNotes = currentNotes;
    const actionLabel = isAddition ? 'ingreso' : 'retiro / egreso';
    
    const countsCopy = { ...auditCounts };
    let remaining = amount;
    
    // Sort denominations descending to distribute largest first
    const sortedDenoms = [...DENOMINATIONS].sort((a, b) => b.val - a.val);
    const adjustmentLog: string[] = [];

    if (isAddition) {
      for (const d of sortedDenoms) {
        if (remaining >= d.val) {
          const countToChange = Math.floor(remaining / d.val);
          countsCopy[d.id] = (countsCopy[d.id] || 0) + countToChange;
          adjustmentLog.push(`+${countToChange} u. de ${formatCurrency(d.val)}`);
          remaining = Number((remaining % d.val).toFixed(2));
        }
      }
      if (remaining > 0) {
        // Leftover to 0.5 coin
        const coinCount = Math.round(remaining / 0.5);
        if (coinCount > 0) {
          countsCopy["0.5"] = (countsCopy["0.5"] || 0) + coinCount;
          adjustmentLog.push(`+${coinCount} u. de ${formatCurrency(0.5)}`);
        }
      }
    } else {
      // Subtracting tries to decrease the largest possible denominations first
      for (const d of sortedDenoms) {
        if (remaining >= d.val) {
          const countToChange = Math.floor(remaining / d.val);
          const currentCount = countsCopy[d.id] || 0;
          const countToSubtract = Math.min(currentCount, countToChange);
          if (countToSubtract > 0) {
            countsCopy[d.id] = currentCount - countToSubtract;
            remaining -= countToSubtract * d.val;
            remaining = Number(remaining.toFixed(2));
            adjustmentLog.push(`-${countToSubtract} u. de ${formatCurrency(d.val)}`);
          }
        }
      }
      if (remaining > 0) {
        // Try to subtract remaining from any non-zero smaller coin
        const sortedCoinsAsc = [...DENOMINATIONS].filter(d => d.type === 'coin').sort((a, b) => a.val - b.val);
        for (const coin of sortedCoinsAsc) {
          if (remaining <= 0) break;
          const currentCount = countsCopy[coin.id] || 0;
          if (currentCount > 0) {
            const needed = Math.ceil(remaining / coin.val);
            const toSubtractIdx = Math.min(currentCount, needed);
            countsCopy[coin.id] = currentCount - toSubtractIdx;
            remaining -= toSubtractIdx * coin.val;
            remaining = Number(remaining.toFixed(2));
            adjustmentLog.push(`-${toSubtractIdx} u. de ${formatCurrency(coin.val)}`);
          }
        }
      }
    }
    
    setAuditCounts(countsCopy);
    
    const noteText = `Ajuste de ${actionLabel} de ${formatCurrency(amount)} aplicado (${adjustmentLog.join(', ')}).`;
    if (!newNotes.includes(noteText)) {
      newNotes = newNotes ? `${newNotes}\n${noteText}` : noteText;
    }
    setAuditNotes(newNotes);
    setCustomAdjustmentRaw('');
    toast.success(`Ajuste de ${actionLabel} por ${formatCurrency(amount)} aplicado.`);
  };

  const [editingAuditId, setEditingAuditId] = useState<string | null>(null);

  const handleEditAudit = (audit: any) => {
    setAuditType(audit.type);
    setAuditCounts(audit.counts || {});
    setAuditNotes(audit.notes || "");
    setEditingAuditId(audit.id);
    setShowAuditModal(true);
  };

  const handleDeleteAudit = async (auditId: string) => {
    setCancelReasonText("");
    setConfirmAction({
      title: "Cancelar Arqueo de Caja",
      message: "¿Estás seguro de que deseas cancelar este arqueo de caja? Se marcará como [CANCELADO] en el historial y no afectará los saldos de caja ni las comparativas de apertura/cierre, pero mantendrá el motivo registrado para la trazabilidad de auditoría.",
      requireReason: true,
      action: async (reason) => {
        const toastId = toast.loading("Cancelando arqueo de caja...");
        try {
          await updateDoc(doc(db, "cashAudits", auditId), {
            cancelled: true,
            cancelledAt: new Date().toISOString(),
            cancelledBy: auth.currentUser?.displayName || auth.currentUser?.email || "Usuario",
            cancelReason: reason || "Sin motivo",
            status: "cancelled"
          });
          toast.success("Registro de arqueo cancelado correctamente", { id: toastId });
        } catch (error) {
          console.error("Error cancelling cash audit:", error);
          toast.error("Error al cancelar el arqueo de caja", { id: toastId });
        } finally {
          setShowConfirmModal(false);
          setConfirmAction(null);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleSaveAudit = async () => {
    if (!auth.currentUser) return;

    const physicalTotal = calculatePhysicalTotal(auditCounts);
    const expectedTotal = auditType === 'opening' 
      ? (lastClosingAudit ? lastClosingAudit.totalPhysical : 0) 
      : totalCash;
    const difference = physicalTotal - expectedTotal;

    const toastId = toast.loading("Guardando arqueo de caja...");
    try {
      const totalDirectIncome = sessionCashSales + sessionCardSales + sessionTransferSales + 
        (sessionStats.creditSettlementsCash || 0) + 
        (sessionStats.creditSettlementsCard || 0) + 
        (sessionStats.creditSettlementsTransfer || 0);

      const auditData = {
        type: auditType,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email || "Usuario",
        counts: auditCounts,
        totalSystem: expectedTotal,
        totalPhysical: physicalTotal,
        difference: difference,
        notes: auditNotes.trim(),
        status: Math.abs(difference) < 0.01 ? 'balanced' : (difference < 0 ? 'shortage' : 'surplus'),
        // Detailed fields for closing audit/reports:
        totalIncomeEntered: totalDirectIncome,
        cashInRegisterExpected: totalCash,
        cashOpeningIngress: sessionOpeningCash,
        cashExpensesEgress: sessionExpenses,
      };

      // 1. Add/Update audit document
      if (editingAuditId) {
        await updateDoc(doc(db, "cashAudits", editingAuditId), {
          ...auditData,
          ...(auditType === 'opening' ? {
            openingDifference: difference,
            previousClosingAmount: lastClosingAudit ? lastClosingAudit.totalPhysical : null
          } : {})
        });
        toast.success("Arqueo actualizado", { id: toastId });
      } else {
        const lastClosingAmount = lastClosingAudit ? lastClosingAudit.totalPhysical : null;
        const openingDifference = difference;

        await addDoc(collection(db, "cashAudits"), {
          ...auditData,
          ...(auditType === 'opening' ? {
            openingDifference: openingDifference,
            previousClosingAmount: lastClosingAmount
          } : {})
        });
        
        // 2. Integration with cashLogs:
        if (auditType === 'opening') {
          let differenceText = "";
          if (lastClosingAmount !== null) {
            const diffFormatted = formatCurrency(Math.abs(openingDifference));
            if (Math.abs(openingDifference) < 0.01) {
              differenceText = `Coincide exactamente con el cierre anterior (${formatCurrency(lastClosingAmount)}).`;
            } else if (openingDifference > 0) {
              differenceText = `Diferencia inicial: Sobrante de ${diffFormatted} con respecto al cierre anterior (${formatCurrency(lastClosingAmount)}).`;
            } else {
              differenceText = `Diferencia inicial: Faltante de ${diffFormatted} con respecto al cierre anterior (${formatCurrency(lastClosingAmount)}).`;
            }
          } else {
            differenceText = `No se detectó cierre anterior para comparar.`;
          }

          // Create an opening log
          await addDoc(collection(db, "cashLogs"), {
            type: 'opening',
            amount: physicalTotal,
            reason: `Arqueo de Apertura - Caja iniciada con ${formatCurrency(physicalTotal)}. ${differenceText}${auditNotes.trim() ? ` Notas: ${auditNotes.trim()}` : ''}`,
            timestamp: new Date().toISOString(),
            userId: auth.currentUser.uid,
            userName: auth.currentUser.displayName || auth.currentUser.email || "Usuario",
            openingDifference: openingDifference,
            previousClosingAmount: lastClosingAmount
          });
          toast.success("Apertura de caja registrada con el arqueo inicial", { id: toastId });
        } else if (auditType === 'closing') {
          // Create a closing record
          await addDoc(collection(db, "cashLogs"), {
            type: 'closing',
            amount: physicalTotal,
            reason: `Arqueo de Cierre - Efectivo Esperado: ${formatCurrency(expectedTotal)}, Efectivo Físico: ${formatCurrency(physicalTotal)} (${difference < 0 ? 'FALTANTE' : 'SOBRANTE'}: ${formatCurrency(difference)}). Notas: ${auditNotes.trim() || 'Sin notas.'}`,
            timestamp: new Date().toISOString(),
            userId: auth.currentUser.uid,
            userName: auth.currentUser.displayName || auth.currentUser.email || "Usuario"
          });
          toast.success("Cierre de caja registrado con el arqueo final", { id: toastId });
        } else {
          toast.success("Arqueo de control guardado correctamente", { id: toastId });
        }
      }
      setShowAuditModal(false);
      setEditingAuditId(null);

      // Reset states
      setShowAuditModal(false);
      setAuditNotes('');
      setShowAdjustmentHelper(false);
      setCustomAdjustmentRaw('');
      setAuditCounts(prev => {
        const reset: Record<string, number> = {};
        DENOMINATIONS.forEach(d => { reset[d.id] = 0; });
        return reset;
      });
    } catch (error) {
      console.error("Error saving cash audit:", error);
      toast.error("Error al guardar el arqueo de caja", { id: toastId });
    }
  };

  const handleCloseDay = async () => {
    if (!auth.currentUser) return;
    
    try {
      await addDoc(collection(db, "cashLogs"), {
        type: 'closing',
        amount: totalCash,
        reason: `Cierre de Caja - Ventas Efectivo: ${formatCurrency(sessionStats.cashSales)}, Tarjeta: ${formatCurrency(sessionStats.cardSales)}, Transferencia: ${formatCurrency(sessionStats.transferSales)}, Crédito: ${formatCurrency(sessionStats.creditSales)}, Gastos: ${formatCurrency(sessionStats.expenses)}. Créditos pendientes al cierre: ${creditOrders.map(co => `${co.clientName}: ${formatCurrency(co.total)}`).join(', ')}`,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email
      });
      
      setShowClosingModal(false);
      toast.success("Caja cerrada correctamente");
    } catch (error) {
      console.error("Error closing cash:", error);
      toast.error("Error al cerrar la caja");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mex-green"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 h-full overflow-hidden flex flex-col bg-mex-cream">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 md:mb-8 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif text-mex-brown">Caja y Cobros</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-mex-green" />
              <p className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Estado: Turno Abierto</p>
            </div>
          </div>

          {/* Main Tab Toggle */}
          <div className="flex bg-stone-200/50 p-1 rounded-2xl border border-stone-200/30 shrink-0 w-fit">
            <button
              id="tab-cobros"
              type="button"
              onClick={() => setCurrentMainTab('checkout')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all cursor-pointer",
                currentMainTab === 'checkout'
                  ? "bg-stone-900 text-white shadow-md shadow-black/10 animate-in fade-in duration-200"
                  : "text-stone-500 hover:text-stone-700 hover:bg-stone-100/30"
              )}
            >
              <CreditCard size={14} />
              COBROS Y MESAS
            </button>
            <button
              id="tab-reportes"
              type="button"
              onClick={() => setCurrentMainTab('reports')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all cursor-pointer",
                currentMainTab === 'reports'
                  ? "bg-mex-brown text-white shadow-md shadow-mex-brown/10 animate-in fade-in duration-200"
                  : "text-stone-500 hover:text-stone-750 hover:bg-stone-100/30"
              )}
            >
              <BarChart3 size={14} />
              REPORTES Y FLUJO
            </button>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1">
          <Button 
            variant="outline" 
            className="flex-1 sm:flex-none gap-2 h-11 text-xs bg-white text-purple-700 hover:bg-purple-50 hover:text-purple-805 border-purple-100 shadow-sm whitespace-nowrap cursor-pointer font-bold"
            onClick={() => {
              // Default to 'opening' if opening cash is 0, otherwise 'partial'
              setAuditType(sessionOpeningCash === 0 ? 'opening' : 'partial');
              setShowAuditModal(true);
            }}
          >
            <Calculator size={18} />
            Arqueo
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 sm:flex-none gap-2 h-11 text-xs bg-white text-stone-600 hover:bg-stone-50 border-stone-100 shadow-sm whitespace-nowrap cursor-pointer font-bold"
            onClick={() => setShowAuditHistory(true)}
          >
            <History size={18} />
            Historial
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 sm:flex-none gap-2 h-11 text-xs bg-white text-purple-700 hover:bg-purple-50 border-purple-100 shadow-sm whitespace-nowrap cursor-pointer font-bold"
            onClick={() => setShowManualModal(true)}
          >
            <BookOpen size={18} />
            Manual
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 sm:flex-none gap-2 h-11 text-xs bg-white border-stone-100 shadow-sm whitespace-nowrap cursor-pointer font-bold"
            onClick={() => {
              setLogForm({ type: 'expense', amount: '', reason: '', paymentMethod: 'cash', transferReceiptUrl: '' });
              setLogTransferReceipt(null);
              setShowLogModal(true);
            }}
          >
            <TrendingDown size={18} />
            Movimiento
          </Button>
          <Button 
            variant="primary" 
            className="flex-1 sm:flex-none gap-2 h-11 text-xs bg-mex-brown hover:bg-stone-800 shadow-md whitespace-nowrap cursor-pointer font-bold"
            onClick={() => setShowClosingModal(true)}
          >
            <ClipboardCheck size={18} />
            Cierre
          </Button>
        </div>
      </div>

      <div className="flex lg:grid lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8 shrink-0 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
        {/* Card 1: Efectivo en Caja */}
        <Card className="bg-[#2D5A47] text-white border-none shadow-lg w-[260px] lg:w-auto shrink-0">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] opacity-80 uppercase font-bold tracking-widest mb-1.5">Efectivo en Caja</p>
              <p className="text-3xl font-bold font-serif tabular-nums tracking-tighter">{formatCurrency(totalCash)}</p>
            </div>
            <div className="p-3 bg-white/10 rounded-2xl">
              <DollarSign size={24} className="text-white/90" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Ventas Totales */}
        <Card className="bg-white border-none shadow-sm ring-1 ring-stone-100 w-[260px] lg:w-auto shrink-0">
          <CardContent className="p-5">
            <p className="text-[11px] text-stone-500 uppercase font-bold tracking-widest mb-3">Ventas Totales</p>
            <p className="text-3xl font-bold text-stone-900 font-serif tabular-nums tracking-tighter mb-4">
              {formatCurrency(sessionStats.cashSales + sessionStats.cardSales + sessionStats.transferSales + sessionStats.creditSales)}
            </p>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-mex-green" /> Efe</div>
                <span className="font-bold">{formatCurrency(sessionStats.cashSales)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> Tar</div>
                <span className="font-bold">{formatCurrency(sessionStats.cardSales)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500" /> Tra</div>
                <span className="font-bold">{formatCurrency(sessionStats.transferSales)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /> Cre</div>
                <span className="font-bold">{formatCurrency(sessionStats.creditSales)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Cuentas Abiertas */}
        <Card className="bg-white border-none shadow-sm ring-1 ring-stone-100 w-[260px] lg:w-auto shrink-0">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-[11px] text-stone-500 uppercase font-bold tracking-widest mb-1.5">Cuentas Abiertas</p>
              <p className="text-3xl font-bold text-stone-900 font-serif tabular-nums tracking-tighter">{groupedOrders.length}</p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-stone-400 font-medium">
              <div className="p-1.5 bg-stone-100 rounded-lg">
                <Clock size={14} />
              </div>
              <span>Mesas con consumo activo</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Saldo de Cartera */}
        <Card className="bg-[#FAF6F4] border-none shadow-sm ring-1 ring-stone-100 w-[260px] lg:w-auto shrink-0">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-[11px] text-mex-brown uppercase font-bold tracking-widest mb-1.5">Saldo en Crédito</p>
              <p className="text-3xl font-bold text-mex-brown font-serif tabular-nums tracking-tighter">{formatCurrency(totalCreditBalance)}</p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-mex-brown/70 font-medium">
              <div className="p-1.5 bg-mex-brown/10 rounded-lg">
                <User size={14} />
              </div>
              <span>{creditOrders.length} {creditOrders.length === 1 ? 'cliente' : 'clientes'} con adeudo</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {currentMainTab === 'checkout' ? (
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-2 gap-6 overflow-hidden pb-16 md:pb-8">
        {/* Toggle subtabs for mobile inside checkout */}
        <div className="flex lg:hidden bg-stone-200/50 p-1 rounded-2xl border border-stone-200/30 shrink-0 w-full mb-1">
          <button
            type="button"
            onClick={() => setCheckoutMobileTab('tables')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all cursor-pointer",
              checkoutMobileTab === 'tables'
                ? "bg-stone-900 text-white shadow-md shadow-black/10"
                : "text-stone-500 hover:text-stone-700"
            )}
          >
            <CreditCard size={14} />
            Cuentas y Préstamos
          </button>
          <button
            type="button"
            onClick={() => setCheckoutMobileTab('cashflow')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all cursor-pointer",
              checkoutMobileTab === 'cashflow'
                ? "bg-stone-900 text-white shadow-md shadow-black/10"
                : "text-stone-500 hover:text-stone-750"
            )}
          >
            <History size={14} />
            Flujo de Caja
          </button>
        </div>

        <div className={cn(
          "flex flex-col gap-4 overflow-hidden bg-white/50 rounded-3xl p-2 border border-stone-100 shadow-inner h-full flex-1",
          checkoutMobileTab === 'tables' ? "flex" : "hidden lg:flex"
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 bg-white rounded-2xl shadow-sm border border-stone-100 shrink-0 gap-4">
            <div className="flex p-1 bg-stone-100/80 rounded-2xl w-full overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setActiveSubTab('pending')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap",
                  activeSubTab === 'pending' 
                    ? "bg-stone-900 text-white shadow-lg" 
                    : "text-stone-500 hover:text-stone-700 hover:bg-stone-200/50"
                )}
              >
                <CreditCard size={14} />
                Cuentas ({groupedOrders.length})
              </button>
              <button 
                onClick={() => setActiveSubTab('credits')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap",
                  activeSubTab === 'credits' 
                    ? "bg-rose-600 text-white shadow-lg" 
                    : "text-stone-500 hover:text-stone-700 hover:bg-rose-50"
                )}
              >
                <User size={14} />
                Créditos ({creditOrders.length})
              </button>
              <button 
                onClick={() => setActiveSubTab('transactions')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap",
                  activeSubTab === 'transactions' 
                    ? "bg-stone-900 text-white shadow-lg" 
                    : "text-stone-500 hover:text-stone-700 hover:bg-stone-200/50"
                )}
              >
                <History size={14} />
                Sesión ({currentSessionLogs.length})
              </button>
              <button 
                onClick={() => setActiveSubTab('loans')}
                className={cn(
                   "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap",
                   activeSubTab === 'loans' 
                     ? "bg-amber-600 text-white shadow-lg" 
                     : "text-stone-500 hover:text-stone-700 hover:bg-amber-50"
                )}
              >
                <DollarSign size={14} />
                Préstamos ({tipLoans.filter(l => l.status === 'pending').length})
              </button>
            </div>
            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest text-right shrink-0 hidden md:inline">
              {activeSubTab === 'pending' ? `${groupedOrders.length} MESAS` : activeSubTab === 'credits' ? `${creditOrders.length} CUENTAS` : activeSubTab === 'transactions' ? `${currentSessionLogs.length} LOGS` : `${tipLoans.length} PRÉSTAMOS`}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto px-2 space-y-3 no-scrollbar pb-6">
            {activeSubTab === 'pending' ? (
              groupedOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                  <CheckCircle2 size={64} className="mb-4" />
                  <p className="text-xl font-serif uppercase tracking-tighter">Todo al día</p>
                  <p className="text-xs mt-1">No hay pedidos pendientes de cobro</p>
                </div>
              ) : (
                groupedOrders.map(group => (
                  <Card key={group.id} className={cn("border-none shadow-md hover:shadow-xl transition-all group overflow-hidden", group.isUnconfirmed && "ring-2 ring-amber-400 bg-amber-50/10")}>
                    <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={cn("text-2xl font-black", group.isTakeaway ? "text-mex-terracotta" : "text-mex-green")}>
                            {group.displayTitle}
                          </p>
                          {group.isTakeaway && (
                            <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest", group.isUnconfirmed ? "bg-amber-500/10 text-amber-600" : "bg-mex-terracotta/10 text-mex-terracotta")}>
                              {group.isUnconfirmed ? 'POR CONFIRMAR (WP)' : 'PARA LLEVAR'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="text-[10px] text-stone-400 font-mono">Folios: {group.folios.join(', ')}</p>
                          <span className="text-stone-300 hidden sm:inline">•</span>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Mesero: {group.waiterNames.join(', ')}</p>
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 border-t sm:border-none pt-3 sm:pt-0 mt-1 sm:mt-0">
                        <p className="text-2xl font-black text-mex-brown font-serif">{formatCurrency(group.total)}</p>
                        <div className="flex gap-2">
                          {onEditOrder && group.orders.length === 1 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-11 w-11 p-0 rounded-xl bg-stone-50 border border-stone-100 hover:text-mex-green"
                              onClick={() => onEditOrder(group.orders[0])}
                              title="Editar Pedido"
                            >
                              <Edit2 size={18} />
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-11 px-3 rounded-xl border-dashed border-red-200 hover:bg-red-50 text-red-650 hover:text-red-700 font-bold text-[10px] uppercase flex items-center justify-center gap-1 shrink-0"
                            onClick={() => handleCancelGroupOrders(group)}
                            title="Cancelar cuenta"
                          >
                            <Trash2 size={16} />
                            <span className="hidden sm:inline">CANCELAR</span>
                          </Button>
                          {group.isUnconfirmed ? (
                            <Button 
                              variant="primary" 
                              className="h-11 px-5 bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md shadow-amber-600/20 font-black tracking-widest text-[11px] uppercase flex items-center justify-center gap-1.5"
                              onClick={() => handleAcceptGroupOrders(group)}
                            >
                              <CheckCircle2 size={15} />
                              AUTORIZAR
                            </Button>
                          ) : (
                            <Button 
                              variant="primary" 
                              className="h-11 px-6 bg-mex-green hover:bg-mex-green/90 rounded-xl shadow-md shadow-mex-green/20 font-black tracking-widest text-[11px] uppercase"
                              onClick={() => {
                                setSelectedGroup(group);
                                setPaymentDisposableQuantity(0);
                                setShowPaymentModal(true);
                              }}
                            >
                              COBRAR
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )
            ) : activeSubTab === 'credits' ? (
              <div className="space-y-3">
                {creditOrders.length > 0 && (
                  <div className="p-4 bg-gradient-to-r from-rose-50 to-rose-100/50 border border-rose-100 rounded-2xl flex items-center justify-between mb-3 shrink-0">
                    <div>
                      <p className="text-[10px] text-rose-700/80 font-black uppercase tracking-widest leading-none mb-1">Saldo Total de Cartera</p>
                      <p className="text-2xl font-black text-rose-950 font-serif">{formatCurrency(totalCreditBalance)}</p>
                    </div>
                    <div className="p-2 bg-rose-200/40 text-rose-700 rounded-xl">
                      <User size={20} />
                    </div>
                  </div>
                )}
                {creditOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-20">
                    <User size={64} className="mb-4 text-rose-500" />
                    <p className="text-xl font-serif uppercase tracking-tighter">Sin adeudos</p>
                    <p className="text-xs mt-1">Nadie debe crédito en el sistema</p>
                  </div>
                ) : (
                  creditOrders.map(order => (
                    <Card key={order.id} className="border-none shadow-md hover:shadow-xl transition-all group overflow-hidden">
                      <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xl font-black text-rose-700">
                              {order.clientName || 'Cliente sin nombre'}
                            </p>
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded text-[9px] font-black uppercase tracking-widest">
                              CRÉDITO PENDIENTE
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <p className="text-[10px] text-stone-400 font-mono">Folio: {order.folio || order.id.slice(0, 6)}</p>
                            <span className="text-stone-300">•</span>
                            <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                              {order.isTakeaway ? 'Para Llevar' : `Mesa ${order.tableNumber}`}
                            </p>
                            <span className="text-stone-300">•</span>
                            <p className="text-[10px] text-stone-400">
                              {new Date(order.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {order.items && order.items.length > 0 && (
                            <p className="text-[10px] text-stone-500 mt-2 italic line-clamp-1">
                              {order.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 border-t sm:border-none pt-3 sm:pt-0 mt-1 sm:mt-0">
                          <p className="text-2xl font-black text-rose-950 font-serif">{formatCurrency(order.total)}</p>
                          <Button 
                            variant="primary" 
                            className="h-11 px-6 bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 font-black tracking-widest text-[11px] uppercase cursor-pointer"
                            onClick={() => {
                              setSelectedCreditOrder(order);
                              setCreditPaymentMethod('cash');
                              setCreditTransferReceipt(null);
                              setShowCreditPaymentModal(true);
                            }}
                          >
                            COBRAR
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            ) : activeSubTab === 'loans' ? (
              <div className="space-y-4 flex flex-col">
                <div className="p-5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl shadow-lg shadow-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white">
                      <DollarSign size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-amber-100 font-black uppercase tracking-widest leading-none mb-1">Total Pendiente en Préstamos</p>
                      <p className="text-3xl font-black text-white font-serif">
                        {formatCurrency(tipLoans.filter(l => l.status === 'pending').reduce((sum, l) => sum + l.amount, 0))}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowLoanModal(true)}
                    className="w-full sm:w-auto h-12 px-8 bg-black text-white hover:bg-stone-900 rounded-2xl shadow-xl font-black tracking-widest text-[11px] uppercase flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Plus size={18} />
                    NUEVO PRÉSTAMO
                  </Button>
                </div>

                <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
                  {tipLoans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 opacity-20">
                      <DollarSign size={64} className="mb-4 text-amber-500" />
                      <p className="text-xl font-serif uppercase tracking-tighter">Sin préstamos</p>
                      <p className="text-xs mt-1">No hay registro de préstamos de propinas</p>
                    </div>
                  ) : (
                    <div className="p-0 sm:p-0">
                      {/* Desktop View: Table */}
                      <div className="hidden lg:block overflow-x-auto no-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                          <thead>
                            <tr className="border-b border-stone-50">
                              <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Fecha</th>
                              <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Motivo / Quien Recibe</th>
                              <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Responsable</th>
                              <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Monto</th>
                              <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Estado</th>
                              <th className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-50">
                            {tipLoans.map(loan => (
                              <tr key={loan.id} className={cn("hover:bg-amber-50/30 transition-colors", loan.status === 'returned' && "bg-stone-50/50")}>
                                <td className="px-6 py-4">
                                  <p className="text-[11px] font-bold text-stone-600">
                                    {new Date(loan.createdAt).toLocaleDateString()}
                                  </p>
                                  <p className="text-[9px] text-stone-400">
                                    {new Date(loan.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className={cn("text-xs font-bold", loan.status === 'returned' ? "text-stone-400" : "text-stone-800")}>
                                    {loan.reason}
                                  </p>
                                  {loan.borrowerName && (
                                    <p className="text-[10px] text-amber-600 font-medium italic mt-0.5">
                                      Para: {loan.borrowerName}
                                    </p>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-[11px] text-stone-500 font-medium">{loan.userName}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className={cn(
                                    "text-sm font-black font-serif tabular-nums",
                                    loan.status === 'pending' ? "text-amber-700" : "text-stone-400 line-through decoration-stone-300"
                                  )}>
                                    {formatCurrency(loan.amount)}
                                  </p>
                                </td>
                                <td className="px-6 py-4">
                                  {loan.status === 'pending' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100 shadow-sm animate-pulse">
                                      <Clock size={10} />
                                      Pendiente
                                    </span>
                                  ) : (
                                    <div>
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-green-100">
                                        <CheckCircle2 size={10} />
                                        Devuelto
                                      </span>
                                      {loan.returnedAt && (
                                        <p className="text-[8px] text-stone-400 mt-1 italic">
                                          {new Date(loan.returnedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {loan.status === 'pending' && (
                                      <>
                                        <Button
                                          variant="primary"
                                          size="sm"
                                          className="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] uppercase tracking-widest shadow-md shadow-amber-600/10 cursor-pointer"
                                          onClick={() => handleReturnTipLoan(loan)}
                                        >
                                          Devolver
                                        </Button>
                                        <button
                                          onClick={() => handleDeleteTipLoan(loan.id)}
                                          className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                          title="Eliminar registro"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile View: Cards */}
                      <div className="lg:hidden p-4 space-y-4">
                        {tipLoans.map(loan => (
                          <div 
                            key={loan.id} 
                            className={cn(
                              "p-4 rounded-2xl border transition-all flex flex-col gap-4",
                              loan.status === 'returned' 
                                ? "bg-stone-50 border-stone-100 opacity-60" 
                                : "bg-white border-amber-100 shadow-sm"
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="min-w-0">
                                <p className={cn("text-sm font-bold", loan.status === 'returned' ? "text-stone-500" : "text-amber-900")}>
                                  {loan.reason}
                                </p>
                                <p className="text-[10px] text-stone-400 mt-0.5">
                                  {new Date(loan.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                              </div>
                              <p className={cn(
                                "text-lg font-black font-serif",
                                loan.status === 'pending' ? "text-amber-700" : "text-stone-400"
                              )}>
                                {formatCurrency(loan.amount)}
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                              <div className="flex flex-col">
                                <span className="text-[8px] text-stone-400 uppercase font-black">Recibe</span>
                                <span className="text-[11px] font-bold text-stone-600">{loan.borrowerName || 'N/A'}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[8px] text-stone-400 uppercase font-black">Autoriza</span>
                                <span className="text-[11px] font-bold text-stone-600">{loan.userName}</span>
                              </div>
                            </div>

                            {loan.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  variant="primary"
                                  className="flex-1 h-11 bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-widest"
                                  onClick={() => handleReturnTipLoan(loan)}
                                >
                                  MARCAR COMO DEVUELTO
                                </Button>
                                <button
                                  onClick={() => handleDeleteTipLoan(loan.id)}
                                  className="h-11 w-11 flex items-center justify-center bg-stone-100 text-stone-400 active:bg-red-50 active:text-red-500 rounded-xl transition-all"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {currentSessionLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-20">
                    <History size={64} className="mb-4 text-stone-400" />
                    <p className="text-xl font-serif uppercase tracking-tighter">Sin movimientos</p>
                    <p className="text-xs mt-1">No hay transacciones en la sesión actual</p>
                  </div>
                ) : (
                  currentSessionLogs.map(log => (
                    <Card key={log.id} className={cn(
                      "border-none shadow-sm overflow-hidden",
                      log.cancelled ? "opacity-50 grayscale bg-stone-50" : "bg-white border border-stone-100"
                    )}>
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            log.type === 'expense' ? "bg-red-50 text-red-600" : 
                            log.type === 'income' ? "bg-green-50 text-mex-green" :
                            "bg-stone-50 text-stone-600"
                          )}>
                            {log.type === 'expense' ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                          </div>
                          <div className="min-w-0">
                            <p className={cn("text-xs font-bold truncate pr-2", log.cancelled && "line-through text-stone-400")}>
                              {log.reason}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn(
                                "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                                log.paymentMethod === 'card' ? "bg-blue-50 text-blue-600" :
                                log.paymentMethod === 'transfer' ? "bg-purple-50 text-purple-600" :
                                log.paymentMethod === 'credit' ? "bg-rose-50 text-rose-600" :
                                "bg-mex-green/10 text-mex-green"
                              )}>
                                {log.paymentMethod === 'card' ? 'Tarjeta' : 
                                 log.paymentMethod === 'transfer' ? 'Transfer' :
                                 log.paymentMethod === 'credit' ? 'Crédito' : 'Efectivo'}
                              </span>
                              <span className="text-[9px] text-stone-400 font-medium">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.userName}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className={cn(
                            "text-lg font-black font-serif tabular-nums",
                            log.type === 'expense' ? "text-red-600" : "text-mex-green"
                          )}>
                            {log.type === 'expense' ? '-' : '+'}{formatCurrency(log.amount)}
                          </p>
                          {!log.cancelled && (
                            <div className="flex gap-1">
                              <button 
                                onClick={() => handleReprintHistoryTicket(log)}
                                className="p-2 text-stone-400 hover:text-stone-800 transition-colors"
                              >
                                <RefreshCw size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className={cn(
          "flex flex-col gap-4 overflow-hidden bg-white/50 rounded-3xl p-2 border border-stone-100 shadow-inner h-full flex-1",
          checkoutMobileTab === 'cashflow' ? "flex" : "hidden lg:flex"
        )}>
          <div className="flex flex-col gap-3 px-4 py-3 bg-white rounded-2xl shadow-sm border border-stone-100 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-mex-brown/10 text-mex-brown rounded-xl">
                  <History size={18} />
                </div>
                <h2 className="text-lg font-serif text-stone-800">Flujo de Caja</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  title="Imprimir / Exportar PDF de este período"
                  className="h-8 px-2.5 text-[10px] font-black uppercase tracking-wider bg-white hover:bg-stone-50 text-mex-brown border-stone-200 cursor-pointer flex items-center gap-1.5 rounded-xl shadow-xs"
                  onClick={() => handlePrintReport(logFilterPeriod)}
                >
                  <Printer size={12} />
                  <span>Reporte PDF</span>
                </Button>
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest hidden sm:inline">{filteredCashLogs.length} {filteredCashLogs.length === 1 ? 'REGISTRO' : 'REGISTROS'}</span>
              </div>
            </div>

            {/* Search Input for recovering receipts */}
            <div className="relative">
              <input 
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="Buscar por cliente, folio, mesero o platillo..."
                className="w-full pl-3 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:bg-white focus:border-mex-gold focus:outline-none transition-all placeholder:text-stone-400 text-stone-700"
              />
              {logSearchQuery && (
                <button 
                  onClick={() => setLogSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-650 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Date Period Filters */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5 border-t border-b border-stone-100/50">
              {(['today', 'yesterday', 'week', 'month', 'all'] as const).map(p => {
                const labels = { today: 'Hoy', yesterday: 'Ayer', week: 'Semana', month: 'Mes', all: 'Historial' };
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setLogFilterPeriod(p)}
                    className={cn(
                      "px-2.5 py-1 text-[9px] font-black uppercase rounded-lg tracking-wider shrink-0 transition-all cursor-pointer",
                      logFilterPeriod === p 
                        ? "bg-stone-900 text-white shadow-sm"
                        : "bg-stone-100 hover:bg-stone-200/60 text-stone-600 font-bold"
                    )}
                  >
                    {labels[p]}
                  </button>
                );
              })}
            </div>

            {/* Category / Type Filters */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {(['all', 'income', 'expense'] as const).map(t => {
                const labels = { all: 'Todos los Tipos', income: 'Ingresos/Cobros', expense: 'Gastos' };
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setLogFilterType(t)}
                    className={cn(
                      "px-2.5 py-1 text-[9px] font-bold rounded-lg shrink-0 transition-all cursor-pointer border",
                      logFilterType === t 
                        ? "bg-mex-brown border-mex-brown text-white shadow-xs"
                        : "bg-white border-stone-200 text-stone-500 hover:bg-stone-50"
                    )}
                  >
                    {labels[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-2 no-scrollbar pb-6">
            {filteredCashLogs.map(log => (
              <div key={log.id} className={cn(
                "p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between group transition-all hover:shadow-md border gap-4",
                log.cancelled 
                  ? "bg-stone-50/70 border-stone-200/65 opacity-70 relative overflow-hidden" 
                  : "bg-white border-stone-50 shadow-sm"
              )}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                    log.cancelled ? "bg-stone-100 text-stone-400 border border-stone-200/60" :
                    log.type === 'expense' ? "bg-red-50 text-red-600 border border-red-100" : 
                    log.type === 'income' ? "bg-green-50 text-mex-green border border-green-100" :
                    "bg-blue-50 text-blue-600 border border-blue-100"
                  )}>
                    {log.cancelled ? <X size={20} /> :
                     log.type === 'expense' ? <TrendingDown size={22} /> : 
                     log.type === 'income' ? <TrendingUp size={22} /> : 
                     <DollarSign size={22} />}
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-bold leading-tight pr-4", log.cancelled ? "text-stone-400 line-through" : "text-stone-800")}>
                      {log.reason}
                      {log.cancelled && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-red-100 text-red-700 border border-red-200 uppercase tracking-widest leading-none">
                          CANCELADO
                        </span>
                      )}
                    </p>
                    
                    {log.cancelled && log.cancelReason && (
                      <div className="mt-1.5 p-1.5 px-2 bg-red-50 text-red-750 rounded-xl border border-red-100 text-[10px] font-bold w-fit max-w-md">
                        <span className="font-extrabold text-red-650 uppercase">Motivo:</span> "{log.cancelReason}"
                        {log.cancelledAt && (
                          <span className="block text-[8px] text-stone-450 font-medium italic mt-0.5">
                            Cancelado por {log.cancelledBy || "Usuario"} el {new Date(log.cancelledAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {log.itemsSummary && log.itemsSummary.length > 0 && (
                      <div className="mt-2 space-y-1 bg-stone-50 p-2 rounded-lg border border-stone-100/50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Items vendidos</p>
                        {log.itemsSummary.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs text-stone-500 gap-4">
                            <span className="truncate flex-1">{item.quantity}x {item.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 mt-2 border border-stone-50 bg-stone-50/50 w-fit px-1.5 py-0.5 rounded-md">
                      <Clock size={10} className="text-stone-400" />
                      <p className="text-[9px] text-stone-500 font-bold uppercase tracking-wider">
                        {new Date(log.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short' })} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.userName}
                      </p>
                    </div>

                    {log.transferReceiptUrl && (
                      <button
                        id={`view-comprobante-${log.id}`}
                        type="button"
                        onClick={() => setPreviewImage(log.transferReceiptUrl)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-850 text-[10px] font-black rounded-xl border border-purple-100 transition-all mt-2 w-fit active:scale-95 cursor-pointer shadow-sm"
                        title="Ver comprobante de transferencia"
                      >
                        <Eye size={12} />
                        <span>VER COMPROBANTE</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-16 sm:pl-0">
                  <p className={cn(
                    "text-lg font-black font-serif",
                    log.cancelled ? "text-stone-400 line-through" : (log.type === 'expense' ? "text-red-600" : "text-mex-green")
                  )}>
                    {log.type === 'expense' ? '-' : '+'}{formatCurrency(log.amount)}
                  </p>
                  <div className="flex gap-1 opacity-100 transition-opacity">
                    {!log.cancelled && (
                      <>
                        {(log.type === 'income' || log.itemsSummary) && (
                          <button 
                            onClick={() => handleReprintHistoryTicket(log)}
                            className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Reimprimir Ticket"
                          >
                            <RefreshCw size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => openEditLog(log)}
                          className="p-2 text-stone-400 hover:text-mex-green hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar Registro"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleCancelCobro(log)}
                          className="p-2 text-stone-400 hover:text-amber-600 hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
                          title="Cancelar Registro/Cobro"
                        >
                          <X size={16} />
                        </button>
                        {userRole === 'admin' && (
                          <button 
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-2 text-stone-400 hover:text-red-600 hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar Permanente"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredCashLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 opacity-20">
                <TrendingUp size={64} className="mb-4" />
                <p className="text-sm font-serif uppercase tracking-tighter">Sin movimientos</p>
                <p className="text-[10px] mt-1">No se encontraron cobros o gastos para el filtro actual</p>
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pb-24 md:pb-8 no-scrollbar bg-stone-50/40 rounded-3xl p-4 border border-stone-150 shadow-inner">
          {/* Header Controls for Reports */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-2xl shadow-sm border border-stone-100">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-mex-brown font-black tracking-widest uppercase">Período de Reporte</span>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {(['today', 'yesterday', 'week', 'month', 'all'] as const).map(p => {
                  const labels = { today: 'Hoy', yesterday: 'Ayer', 'week': 'Esta Semana', month: 'Este Mes', all: 'Todo el Historial' };
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setReportPeriod(p)}
                      className={cn(
                        "px-3.5 py-1.5 text-xs font-bold uppercase rounded-lg tracking-wider shrink-0 transition-all cursor-pointer border",
                        reportPeriod === p
                          ? "bg-mex-brown border-mex-brown text-white shadow-sm"
                          : "bg-white border-stone-200 hover:bg-stone-50 text-stone-600"
                      )}
                    >
                      {labels[p]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                id="print-full-report"
                variant="outline"
                type="button"
                className="gap-2 h-10 px-4 text-xs bg-white text-stone-700 hover:bg-stone-50 border-stone-200 cursor-pointer shadow-sm font-bold"
                onClick={() => handlePrintReport(reportPeriod)}
              >
                <Printer size={16} className="text-mex-brown" />
                Imprimir Reporte General
              </Button>
            </div>
          </div>

          {/* Period Stats Summary Cards */}
          {(() => {
            const rData = getReportData(reportPeriod);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in zoom-in-95 duration-200">
                  <Card className="bg-white border-none shadow-sm ring-1 ring-stone-100">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-stone-500 uppercase font-black tracking-widest mb-1">Ventas del Período</p>
                      <p className="text-2xl font-bold text-mex-green font-serif tracking-tight">{formatCurrency(rData.totalSales)}</p>
                      <p className="text-[10px] text-stone-400 font-medium mt-1">Suma de todos los ingresos del período</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-none shadow-sm ring-1 ring-stone-100">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-stone-500 uppercase font-black tracking-widest mb-1">Gastos del Período</p>
                      <p className="text-2xl font-bold text-red-650 font-serif tracking-tight">-{formatCurrency(rData.totalExpenses)}</p>
                      <p className="text-[10px] text-stone-400 font-medium mt-1">Egresos o deducciones registradas</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-none shadow-sm ring-1 ring-stone-100">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-stone-500 uppercase font-black tracking-widest mb-1">Balance Neto</p>
                      <p className="text-2xl font-bold text-stone-900 font-serif tracking-tight">{formatCurrency(rData.totalSales - rData.totalExpenses)}</p>
                      <p className="text-[10px] text-stone-400 font-medium mt-1">Utilidad neta restante</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-none shadow-sm ring-1 ring-stone-100">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-stone-500 uppercase font-black tracking-widest mb-1">Ticket Promedio</p>
                      <p className="text-2xl font-bold text-purple-750 font-serif tracking-tight">{formatCurrency(rData.averageTicket)}</p>
                      <p className="text-[10px] text-stone-400 font-medium mt-1">Total de {rData.totalTransactions} transacciones</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Secondary breakdown requested by user */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in zoom-in-95 duration-200">
                  <Card className="bg-stone-50/70 border-none shadow-sm ring-1 ring-stone-150">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-mex-green uppercase font-black tracking-widest mb-1">Efectivo en Caja</p>
                      <p className="text-xl font-bold text-stone-850 font-serif tracking-tight">{formatCurrency(rData.totalCashInDrawer)}</p>
                      <p className="text-[10px] text-stone-500 font-medium mt-1">Efectivo {formatCurrency(rData.cashSales)} + Cobro Créd. {formatCurrency(rData.creditSettlementsCash)}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-stone-50/70 border-none shadow-sm ring-1 ring-stone-150">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-blue-600 uppercase font-black tracking-widest mb-1">Tarjeta</p>
                      <p className="text-xl font-bold text-stone-850 font-serif tracking-tight">{formatCurrency(rData.totalCard)}</p>
                      <p className="text-[10px] text-stone-500 font-medium mt-1">Tarjeta {formatCurrency(rData.cardSales)} + Cobro Créd. {formatCurrency(rData.creditSettlementsCard)}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-stone-50/70 border-none shadow-sm ring-1 ring-stone-150">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-purple-650 uppercase font-black tracking-widest mb-1">Transferencias</p>
                      <p className="text-xl font-bold text-stone-850 font-serif tracking-tight">{formatCurrency(rData.totalTransfer)}</p>
                      <p className="text-[10px] text-stone-500 font-medium mt-1">Trf. {formatCurrency(rData.transferSales)} + Cobro Créd. {formatCurrency(rData.creditSettlementsTransfer)}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-stone-50/70 border-none shadow-sm ring-1 ring-stone-150">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-amber-600 uppercase font-black tracking-widest mb-1">Recuperación de Créditos</p>
                      <p className="text-xl font-bold text-stone-850 font-serif tracking-tight">{formatCurrency(rData.totalCreditRecovery)}</p>
                      <p className="text-[10px] text-stone-500 font-medium mt-1">Total cobrado de cuentas de crédito</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })()}

          {/* Sub-tabs inside Reports */}
          <div className="flex flex-col gap-4 bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-stone-100">
            <div className="flex border-b border-stone-150 pb-2 overflow-x-auto no-scrollbar gap-1">
              {([
                { id: 'summary', label: 'Resumen General', icon: BarChart3 },
                { id: 'daily', label: 'Historial por Día', icon: Calendar },
                { id: 'weekly', label: 'Historial por Semana', icon: TrendingUp },
                { id: 'monthly', label: 'Historial por Mes', icon: History },
                { id: 'detailed', label: 'Flujo de Caja Detallado', icon: Receipt },
              ] as const).map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    id={`subtab-${tab.id}`}
                    type="button"
                    onClick={() => setActiveReportTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-xs font-black uppercase rounded-xl tracking-wider transition-all cursor-pointer shrink-0 whitespace-nowrap",
                      activeReportTab === tab.id
                        ? "bg-stone-900 text-white shadow-sm"
                        : "text-stone-500 hover:text-stone-750 hover:bg-stone-100/50"
                    )}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Yesterday's Duplicates Detector and Resolution Panel */}
            {yesterdayDuplicates.length > 0 && (
              <div className="bg-amber-50/75 border border-amber-200/80 rounded-2xl p-4 md:p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                      <AlertTriangle size={22} className="animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black font-serif text-amber-950 uppercase tracking-wide">🚨 ALERTA DE AUDITORÍA: DOBLES COBROS DETECTADOS</h4>
                      <p className="text-xs text-amber-900 mt-1">
                        Se detectaron <strong>{yesterdayDuplicates.length} grupo(s) de cobros idénticos duplicados</strong> del día de ayer. Esto suele ocurrir cuando el cajero da múltiples clics rápidos en "Confirmar Pago".
                      </p>
                      <p className="text-[10px] text-amber-700 mt-1.5 font-bold uppercase tracking-wider">
                        El sistema recalculará las ventas y todos los movimientos del día automáticamente al eliminar el duplicado.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white text-amber-950 border-amber-200 hover:bg-amber-50 text-[10px] font-black uppercase tracking-wider h-9 px-3 rounded-xl cursor-pointer"
                      onClick={() => setShowDuplicateDetails(!showDuplicateDetails)}
                    >
                      {showDuplicateDetails ? 'Ocultar Detalles' : 'Ver y Resolver Uno a Uno'}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-wider h-9 px-3.5 rounded-xl cursor-pointer shadow-sm shadow-amber-600/10 border-none"
                      onClick={() => handleResolveAllYesterdayDuplicates(yesterdayDuplicates)}
                    >
                      Eliminar Todos los Duplicados
                    </Button>
                  </div>
                </div>

                {showDuplicateDetails && (
                  <div className="border-t border-amber-200/50 pt-4 mt-2 space-y-4 animate-in fade-in duration-200">
                    <h5 className="text-[11px] font-black text-amber-950 uppercase tracking-widest mb-2">Desglose de Movimientos Duplicados:</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {yesterdayDuplicates.map((dupGroup, groupIndex) => {
                        const original = dupGroup.logs[0];
                        const dups = dupGroup.logs.slice(1);
                        return (
                          <div key={dupGroup.key + groupIndex} className="bg-white border border-amber-150 rounded-xl p-3.5 space-y-3 shadow-xs">
                            <div className="flex justify-between items-start border-b border-stone-100 pb-2">
                              <div>
                                <span className="text-[9px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                  Grupo Duplicado #{groupIndex + 1}
                                </span>
                                <p className="text-xs font-black text-stone-850 mt-1 font-serif">
                                  {original.reason}
                                </p>
                              </div>
                              <span className="text-sm font-black font-mono text-mex-green">
                                {formatCurrency(original.amount)}
                              </span>
                            </div>

                            <div className="space-y-2">
                              {/* Original record */}
                              <div className="flex items-center justify-between p-2 bg-stone-50 rounded-lg text-xs">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-mex-green shrink-0" />
                                    <span className="font-bold text-stone-700">Original (Conservar)</span>
                                  </div>
                                  <p className="text-[10px] text-stone-400 mt-0.5">
                                    Registrado por: {original.userName || 'Sistema'} • ID: {original.id.slice(0, 6)}
                                  </p>
                                </div>
                                <span className="font-mono text-[10px] text-stone-500 bg-white border border-stone-100 px-1.5 py-0.5 rounded font-black">
                                  {new Date(original.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                              </div>

                              {/* Duplicated records */}
                              {dups.map((dupLog, dupIdx) => (
                                <div key={dupLog.id} className="flex items-center justify-between p-2 bg-red-50/50 border border-red-100 rounded-lg text-xs">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                      <span className="font-black text-red-700">Duplicado #{dupIdx + 1}</span>
                                    </div>
                                    <p className="text-[10px] text-stone-400 mt-0.5">
                                      Registrado por: {dupLog.userName || 'Sistema'} • ID: {dupLog.id.slice(0, 6)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-bold">
                                      {new Date(dupLog.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleResolveDuplicates(dupGroup)}
                                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                      title="Eliminar este duplicado"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Render selected report subtab */}
            {activeReportTab === 'summary' && (() => {
              const rData = getReportData(reportPeriod);
              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                  {/* Left panel with charts and waiter performance */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Top Products */}
                    <div className="bg-stone-50/60 rounded-2xl p-4 border border-stone-100 md:p-5">
                      <h3 className="text-sm font-serif font-black text-stone-750 mb-3 flex items-center gap-2">
                        <Package size={16} className="text-mex-gold" />
                        PRODUCTOS MÁS VENDIDOS
                      </h3>
                      {rData.topProducts.length === 0 ? (
                        <p className="text-xs text-stone-400 italic py-4 text-center">No hay productos registrados en este período</p>
                      ) : (
                        <div className="space-y-2">
                          {rData.topProducts.slice(0, 5).map((p, index) => (
                            <div key={p.name} className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-stone-100">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 flex items-center justify-center bg-mex-brown/10 text-mex-brown text-[10px] font-black rounded-full shrink-0">
                                  {index + 1}
                                </span>
                                <span className="text-sm font-semibold text-stone-750 truncate">{p.name}</span>
                              </div>
                              <div className="flex items-center gap-4 shrink-0 font-mono text-sm">
                                <span className="text-stone-500 font-bold bg-stone-100 px-2 py-0.5 rounded-md text-[11px]">{p.quantity} uds</span>
                                <span className="text-stone-750 font-black">{formatCurrency(p.revenue)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Waiter Performance */}
                    <div className="bg-stone-50/60 rounded-2xl p-4 border border-stone-100 md:p-5">
                      <h3 className="text-sm font-serif font-black text-stone-750 mb-3 flex items-center gap-2">
                        <User size={16} className="text-purple-650" />
                        DESEMPEÑO DE COLABORADORES
                      </h3>
                      {rData.staffSales.length === 0 ? (
                        <p className="text-xs text-stone-400 italic py-4 text-center">No hay transacciones por personal en este período</p>
                      ) : (
                        <div className="space-y-2">
                          {rData.staffSales.map(staff => (
                            <div key={staff.name} className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-stone-100">
                              <span className="text-sm font-semibold text-stone-750 truncate">{staff.name}</span>
                              <div className="flex items-center gap-4 font-mono text-sm">
                                <span className="text-stone-500 text-[11px] bg-stone-100 px-2 py-0.5 rounded-md">{staff.count} trans.</span>
                                <span className="text-stone-750 font-black">{formatCurrency(staff.sales)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right panel: Payment methods breakdown */}
                  <div className="bg-stone-50/60 rounded-2xl p-4 border border-stone-100 md:p-5 flex flex-col justify-start">
                    <h3 className="text-sm font-serif font-black text-stone-750 mb-4 flex items-center gap-2">
                      <CreditCard size={16} className="text-blue-550" />
                      COMPOSICIÓN DE MÉTODOS DE PAGO
                    </h3>
                    <div className="space-y-3">
                      {rData.paymentMethodPieData.map(method => {
                        const labelsMap: Record<string, string> = {
                          'Efectivo': 'Efectivo en Caja',
                          'Tarjeta': 'Pago con Tarjeta',
                          'Transferencia': 'Transferencias',
                          'Crédito': 'Abonado a Crédito',
                          'Cobro Crédito (Efe)': 'Cobros Crédit. (Efectivo)',
                          'Cobro Crédito (Tar)': 'Cobros Crédit. (Tarjeta)',
                          'Cobro Crédito (Trf)': 'Cobros Crédit. (Transfer.)'
                        };
                        const displayLabel = labelsMap[method.name] || method.name;
                        const percentage = rData.totalSales > 0 ? ((method.value / rData.totalSales) * 100).toFixed(1) : '0.0';
                        
                        return (
                          <div key={method.name} className="bg-white p-3.5 rounded-xl border border-stone-100 space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-stone-700">{displayLabel}</span>
                              <span className="font-mono font-black text-stone-900">{formatCurrency(method.value)}</span>
                            </div>
                            <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-mex-brown h-full rounded-full" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-stone-400 text-right font-bold tracking-tight">
                              {percentage}% del total de ventas
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Daily history tab */}
            {activeReportTab === 'daily' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-serif font-black text-stone-850">VENTAS DIARIAS</h3>
                  <span className="text-[10px] text-stone-400 font-bold bg-stone-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {aggregatedHistory.daily.length} DÍAS CON MOVIMIENTOS
                  </span>
                </div>
                {aggregatedHistory.daily.length === 0 ? (
                  <p className="text-xs text-stone-400 italic py-10 text-center">No hay movimientos diarios</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-stone-150 text-stone-400 font-black text-[10px] uppercase tracking-wider">
                          <th className="py-3 px-2">Día / Fecha</th>
                          <th className="py-3 px-2 text-right">Cobros/Ventas</th>
                          <th className="py-3 px-2 text-right">Gastos/Egresos</th>
                          <th className="py-3 px-2 text-right">Flujo Neto</th>
                          <th className="py-3 px-2 text-center">Transacciones</th>
                          <th className="py-3 px-2 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {aggregatedHistory.daily.map(day => (
                          <tr key={day.period} className="hover:bg-stone-50/50 transition-colors">
                            <td className="py-3.5 px-2 font-black text-stone-800">
                              {new Date(day.period + 'T12:00:00').toLocaleDateString('es-MX', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </td>
                            <td className="py-3.5 px-2 text-right font-mono font-black text-mex-green">
                              {formatCurrency(day.sales)}
                            </td>
                            <td className="py-3.5 px-2 text-right font-mono font-bold text-red-650">
                              {day.expenses > 0 ? `-${formatCurrency(day.expenses)}` : formatCurrency(0)}
                            </td>
                            <td className="py-3.5 px-2 text-right font-mono font-black text-stone-900">
                              {formatCurrency(day.net)}
                            </td>
                            <td className="py-3.5 px-2 text-center font-bold text-stone-550">
                              {day.count}
                            </td>
                            <td className="py-3.5 px-2 text-right">
                              <Button
                                id={`print-day-${day.period}`}
                                variant="outline"
                                type="button"
                                size="sm"
                                className="h-8 gap-1.5 text-[10px] font-black uppercase cursor-pointer py-1 px-2 border-stone-200"
                                onClick={() => {
                                  // Gather exact reports for just this specific day
                                  const dayLogs = cashLogs.filter(log => {
                                    if (!log.timestamp || log.cancelled) return false;
                                    const dStr = new Date(log.timestamp).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                    const comparisonStr = new Date(day.period + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                    return comparisonStr === dStr;
                                  });
                                  
                                  const dayTotalSales = dayLogs.filter(l => l.type === 'income').reduce((acc, l) => acc + l.amount, 0);
                                  const dayTotalExpenses = dayLogs.filter(l => l.type === 'expense').reduce((acc, l) => acc + l.amount, 0);
                                  
                                  setPrintReportData({
                                    totalSales: dayTotalSales,
                                    totalExpenses: dayTotalExpenses,
                                    totalTransactions: dayLogs.length,
                                    averageTicket: dayLogs.length > 0 ? (dayTotalSales / dayLogs.length) : 0,
                                    paymentMethodPieData: [
                                      { name: 'Efectivo', value: dayLogs.filter(l => l.type === 'income' && l.paymentMethod === 'cash').reduce((sc, l) => sc + l.amount, 0) },
                                      { name: 'Tarjeta', value: dayLogs.filter(l => l.type === 'income' && l.paymentMethod === 'card').reduce((sc, l) => sc + l.amount, 0) },
                                      { name: 'Transferencia', value: dayLogs.filter(l => l.type === 'income' && l.paymentMethod === 'transfer').reduce((sc, l) => sc + l.amount, 0) },
                                    ],
                                    topProducts: [],
                                    period: 'today',
                                    filteredLogs: dayLogs,
                                    periodLabel: `Día: ${day.period}`,
                                    timestamp: new Date().toISOString()
                                  });
                                }}
                              >
                                <Printer size={12} className="text-mex-brown" />
                                IMPRIMIR
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Weekly history tab */}
            {activeReportTab === 'weekly' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-serif font-black text-stone-850">VENTAS SEMANALES</h3>
                  <span className="text-[10px] text-stone-400 font-bold bg-stone-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {aggregatedHistory.weekly.length} SEMANAS REGISTRADAS
                  </span>
                </div>
                {aggregatedHistory.weekly.length === 0 ? (
                  <p className="text-xs text-stone-400 italic py-10 text-center">No hay movimientos semanales</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-stone-150 text-stone-400 font-black text-[10px] uppercase tracking-wider">
                          <th className="py-3 px-2">Semana / Período</th>
                          <th className="py-3 px-2 text-right">Cobros/Ventas</th>
                          <th className="py-3 px-2 text-right">Gastos/Egresos</th>
                          <th className="py-3 px-2 text-right">Flujo Neto</th>
                          <th className="py-3 px-2 text-center">Transacciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {aggregatedHistory.weekly.map(wk => (
                          <tr key={wk.period} className="hover:bg-stone-50/50 transition-colors">
                            <td className="py-3.5 px-2 font-black text-stone-800">
                              {wk.period}
                            </td>
                            <td className="py-3.5 px-2 text-right font-mono font-black text-mex-green">
                              {formatCurrency(wk.sales)}
                            </td>
                            <td className="py-3.5 px-2 text-right font-mono font-bold text-red-650">
                              {wk.expenses > 0 ? `-${formatCurrency(wk.expenses)}` : formatCurrency(0)}
                            </td>
                            <td className="py-3.5 px-2 text-right font-mono font-black text-stone-900">
                              {formatCurrency(wk.net)}
                            </td>
                            <td className="py-3.5 px-2 text-center font-bold text-stone-550">
                              {wk.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Monthly history tab */}
            {activeReportTab === 'monthly' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-serif font-black text-stone-850">VENTAS MENSUALES</h3>
                  <span className="text-[10px] text-stone-400 font-bold bg-stone-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {aggregatedHistory.monthly.length} MESES REGISTRADOS
                  </span>
                </div>
                {aggregatedHistory.monthly.length === 0 ? (
                  <p className="text-xs text-stone-400 italic py-10 text-center">No hay movimientos mensuales</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-stone-150 text-stone-400 font-black text-[10px] uppercase tracking-wider">
                          <th className="py-3 px-2">Mes</th>
                          <th className="py-3 px-2 text-right">Cobros/Ventas</th>
                          <th className="py-3 px-2 text-right">Gastos/Egresos</th>
                          <th className="py-3 px-2 text-right">Flujo Neto</th>
                          <th className="py-3 px-2 text-center">Transacciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {aggregatedHistory.monthly.map(mn => (
                          <tr key={mn.period} className="hover:bg-stone-50/50 transition-colors">
                            <td className="py-3.5 px-2 font-black text-stone-850 capitalize">
                              {mn.period}
                            </td>
                            <td className="py-3.5 px-2 text-right font-mono font-black text-mex-green">
                              {formatCurrency(mn.sales)}
                            </td>
                            <td className="py-3.5 px-2 text-right font-mono font-bold text-red-650">
                              {mn.expenses > 0 ? `-${formatCurrency(mn.expenses)}` : formatCurrency(0)}
                            </td>
                            <td className="py-3.5 px-2 text-right font-mono font-black text-stone-900">
                              {formatCurrency(mn.net)}
                            </td>
                            <td className="py-3.5 px-2 text-center font-bold text-stone-550">
                              {mn.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Detailed Transactions view with LARGER FONT SIZES */}
            {activeReportTab === 'detailed' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50 p-4 rounded-2xl border border-stone-150">
                  <div>
                    <h3 className="text-sm font-serif font-black text-stone-850">HISTORIAL DE MOVIMIENTOS DETALLADOS</h3>
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Flujo de caja detallado por el período seleccionado</p>
                  </div>
                  <Button
                    variant="outline"
                    type="button"
                    className="gap-2 text-[10px] h-9 px-3 bg-white text-stone-700 hover:bg-stone-50 border-stone-200 cursor-pointer shadow-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center shrink-0"
                    onClick={() => handlePrintReport(logFilterPeriod)}
                  >
                    <Printer size={13} className="text-mex-brown" />
                    Exportar PDF de este período
                  </Button>
                </div>

                {/* Search and Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-100">
                  <div className="relative">
                    <input 
                      type="text"
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      placeholder="Buscar por cliente, folio, mesero o platillo..."
                      className="w-full pl-3 pr-8 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold focus:border-mex-gold focus:outline-none transition-all placeholder:text-stone-400 text-stone-750"
                    />
                    {logSearchQuery && (
                      <button 
                        onClick={() => setLogSearchQuery('')}
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-650 cursor-pointer"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    {(['today', 'yesterday', 'week', 'month', 'all'] as const).map(p => {
                      const labels = { today: 'Hoy', yesterday: 'Ayer', week: 'Semana', month: 'Mes', all: 'Historial completo' };
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setLogFilterPeriod(p)}
                          className={cn(
                            "px-2.5 py-1 text-[10px] font-black uppercase rounded-lg tracking-wider shrink-0 transition-all cursor-pointer",
                            logFilterPeriod === p 
                              ? "bg-stone-900 text-white shadow-sm"
                              : "bg-white hover:bg-stone-100 border border-stone-200 text-stone-600"
                          )}
                        >
                          {labels[p]}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    {(['all', 'income', 'expense'] as const).map(t => {
                      const labels = { all: 'Todos', income: 'Ingresos', expense: 'Gastos' };
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setLogFilterType(t)}
                          className={cn(
                            "px-2.5 py-1 text-[10px] font-bold rounded-lg shrink-0 transition-all cursor-pointer border",
                            logFilterType === t 
                              ? "bg-mex-brown border-mex-brown text-white shadow-xs"
                              : "bg-white border-stone-200 text-stone-500 hover:bg-stone-50"
                          )}
                        >
                          {labels[t]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 no-scrollbar">
                  {filteredCashLogs.map(log => (
                    <div key={log.id} className={cn(
                      "p-4.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between group transition-all hover:shadow-md border gap-4",
                      log.cancelled 
                        ? "bg-stone-50/70 border-stone-200/65 opacity-70" 
                        : "bg-white border-stone-100 shadow-sm"
                    )}>
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                          log.cancelled ? "bg-stone-100 text-stone-400 border border-stone-200/60" :
                          log.type === 'expense' ? "bg-red-50 text-red-650 border border-red-100" : 
                          log.type === 'income' ? "bg-green-50 text-mex-green border border-green-100" :
                          "bg-blue-50 text-blue-600 border border-blue-100"
                        )}>
                          {log.cancelled ? <X size={20} /> :
                           log.type === 'expense' ? <TrendingDown size={22} /> : 
                           log.type === 'income' ? <TrendingUp size={22} /> : 
                           <DollarSign size={22} />}
                        </div>
                        <div className="min-w-0">
                          {/* ENLARGED FONT: changed from text-sm to text-base for improved readability! */}
                          <p className={cn("text-base font-bold leading-tight pr-4 text-stone-850", log.cancelled ? "text-stone-400 line-through" : "")}>
                            {log.reason}
                            {log.cancelled && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-red-100 text-red-700 border border-red-200 uppercase tracking-widest leading-none">
                                CANCELADO
                              </span>
                            )}
                          </p>
                          
                          {log.itemsSummary && log.itemsSummary.length > 0 && (
                            <div className="mt-2 space-y-1 bg-stone-50 p-2 rounded-lg border border-stone-100/50">
                              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Items vendidos</p>
                              {log.itemsSummary.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm text-stone-500 gap-4">
                                  <span className="truncate flex-1 font-semibold">{item.quantity}x {item.name}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 mt-2 border border-stone-100 bg-stone-50/50 w-fit px-2 py-0.5 rounded-md">
                            <Clock size={11} className="text-stone-400" />
                            <p className="text-[10px] text-stone-600 font-black uppercase tracking-wider">
                              {new Date(log.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short' })} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • M: {log.userName}
                            </p>
                          </div>

                          {log.transferReceiptUrl && (
                            <button
                              type="button"
                              onClick={() => setPreviewImage(log.transferReceiptUrl)}
                              className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-850 text-[10px] font-black rounded-xl border border-purple-100 transition-all mt-2 w-fit active:scale-95 cursor-pointer shadow-3xs"
                              title="Ver comprobante de transferencia"
                            >
                              <Eye size={12} />
                              <span>VER COMPROBANTE</span>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-16 sm:pl-0">
                        {/* ENLARGED PRICE FONT CODE (text-xl instead of text-lg) */}
                        <p className={cn(
                          "text-xl font-extrabold font-serif",
                          log.cancelled ? "text-stone-400 line-through" : (log.type === 'expense' ? "text-red-650" : "text-mex-green")
                        )}>
                          {log.type === 'expense' ? '-' : '+'}{formatCurrency(log.amount)}
                        </p>
                        <div className="flex gap-1">
                          {!log.cancelled && (
                            <>
                              {(log.type === 'income' || log.itemsSummary) && (
                                <button 
                                  onClick={() => handleReprintHistoryTicket(log)}
                                  className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Reimprimir Ticket"
                                >
                                  <RefreshCw size={17} />
                                </button>
                              )}
                              <button 
                                onClick={() => openEditLog(log)}
                                className="p-2 text-stone-400 hover:text-mex-green hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
                                title="Editar Registro"
                              >
                                <Edit2 size={17} />
                              </button>
                              <button 
                                onClick={() => handleCancelCobro(log)}
                                className="p-2 text-stone-400 hover:text-amber-600 hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
                                title="Cancelar Registro/Cobro"
                              >
                                <X size={17} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredCashLogs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20">
                      <TrendingUp size={64} className="mb-4" />
                      <p className="text-sm font-serif uppercase tracking-tighter">Sin movimientos</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credit Settlement / Payment Modal */}
      {showCreditPaymentModal && selectedCreditOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="bg-rose-900 text-white rounded-t-[2rem] p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <button onClick={() => { setShowCreditPaymentModal(false); setCreditTip(0); setCreditInterest(0); setCreditExtra(0); }} className="text-white/50 hover:text-white transition-colors cursor-pointer"><X size={20}/></button>
              </div>
              <p className="text-[10px] font-black text-rose-200 uppercase tracking-[0.3em] mb-1">Cobro de Crédito</p>
              <h3 className="text-4xl font-serif">{formatCurrency(selectedCreditOrder.total)}</h3>
              <div className="mt-2 flex flex-col items-center">
                <p className="text-[11px] text-rose-100 font-bold uppercase">{selectedCreditOrder.clientName || 'Cliente'}</p>
                <p className="text-[10px] text-white/60 font-mono italic mt-1">Folio: {selectedCreditOrder.folio || selectedCreditOrder.id.slice(0, 6)}</p>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block text-center">Forma de Saneamiento</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => { setCreditPaymentMethod('cash'); setCreditTransferReceipt(null); }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all cursor-pointer",
                      creditPaymentMethod === 'cash' ? "bg-mex-green/5 border-mex-green text-mex-green font-bold" : "bg-stone-50 border-stone-100 text-stone-400 hover:border-stone-200"
                    )}
                  >
                    <DollarSign size={20} />
                    <span className="text-[9px] font-black uppercase">Efectivo</span>
                  </button>
                  <button 
                    onClick={() => { setCreditPaymentMethod('card'); setCreditTransferReceipt(null); }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all cursor-pointer",
                      creditPaymentMethod === 'card' ? "bg-blue-50 border-blue-600 text-blue-600 font-bold" : "bg-stone-50 border-stone-100 text-stone-400 hover:border-stone-200"
                    )}
                  >
                    <CreditCard size={20} />
                    <span className="text-[9px] font-black uppercase">Tarjeta</span>
                  </button>
                  <button 
                    onClick={() => setCreditPaymentMethod('transfer')}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all cursor-pointer",
                      creditPaymentMethod === 'transfer' ? "bg-purple-50 border-purple-600 text-purple-600 font-bold" : "bg-stone-50 border-stone-100 text-stone-400 hover:border-stone-200"
                    )}
                  >
                    <LucideImage size={20} />
                    <span className="text-[9px] font-black uppercase">Transfer</span>
                  </button>
                </div>
              </div>

              {/* Credit Cash Received & Change Section */}
              {creditPaymentMethod === 'cash' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-stone-50 rounded-2xl border border-stone-200"
                >
                  <div className="flex justify-between items-end mb-4">
                    <div className="flex-1 mr-4">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">
                        Efectivo Recibido
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                        <input
                          type="number"
                          value={creditCashReceived}
                          onChange={(e) => setCreditCashReceived(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-7 pr-4 py-2 bg-white border border-stone-200 rounded-xl font-bold text-lg focus:ring-2 focus:ring-mex-green/20 focus:border-mex-green outline-none"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">
                        Cambio
                      </label>
                      <p className={cn(
                        "text-2xl font-black font-serif",
                        Number(creditCashReceived) - (selectedCreditOrder.total + creditTip + creditInterest + creditExtra) >= 0 ? "text-mex-green" : "text-stone-300"
                      )}>
                        {Number(creditCashReceived) - (selectedCreditOrder.total + creditTip + creditInterest + creditExtra) > 0 
                          ? formatCurrency(Number(creditCashReceived) - (selectedCreditOrder.total + creditTip + creditInterest + creditExtra)) 
                          : formatCurrency(0)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[20, 50, 100, 200, 500].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCreditCashReceived((prev) => (Number(prev || 0) + val).toString())}
                        className="py-1.5 bg-white border border-stone-200 rounded-lg text-[10px] font-bold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all shadow-sm"
                      >
                        +${val}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCreditCashReceived((selectedCreditOrder.total + creditTip + creditInterest + creditExtra).toString())}
                      className="py-1.5 bg-mex-green/10 text-mex-green rounded-lg text-[10px] font-black uppercase hover:bg-mex-green/20 active:scale-95 transition-all border border-mex-green/10"
                    >
                      Exacto
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreditCashReceived('')}
                      className="py-1.5 col-span-2 bg-stone-200 rounded-lg text-[10px] font-black uppercase text-stone-600 hover:bg-stone-300 active:scale-95 transition-all"
                    >
                      Limpiar
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Upload section for credit transfer receipt */}
              {creditPaymentMethod === 'transfer' && (
                <div className="space-y-2 animate-in fade-in-50 duration-200">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block text-center">
                    Foto del Comprobante (Opcional)
                  </label>
                  
                  {!creditTransferReceipt ? (
                    <div
                      id="credit-transfer-dropzone"
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingCredit(true); }}
                      onDragLeave={() => setIsDraggingCredit(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingCredit(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          processCreditReceiptFile(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => document.getElementById('credit-receipt-upload')?.click()}
                      className={cn(
                        "border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1",
                        isDraggingCredit 
                          ? "border-mex-green bg-mex-green/5 text-mex-green scale-[1.02]" 
                          : "border-stone-200 bg-stone-50 hover:bg-stone-100/50 text-stone-500 hover:border-stone-300"
                      )}
                    >
                      <UploadCloud size={24} className={isDraggingCredit ? "text-mex-green" : "text-stone-450"} />
                      <p className="text-[11px] font-black leading-tight">
                        Arrastra la foto aquí o <span className="text-mex-brown underline">haz clic</span>
                      </p>
                      <p className="text-[9px] text-stone-400">JPG, PNG o WEBP (Opcional • máx. 10MB)</p>
                      <input 
                        id="credit-receipt-upload"
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            processCreditReceiptFile(e.target.files[0]);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden border border-stone-200 bg-stone-50 p-2">
                      <img 
                        src={creditTransferReceipt} 
                        alt="Comprobante de Transferencia Crédito" 
                        className="w-full h-32 object-contain rounded-xl"
                      />
                      <button 
                        id="remove-credit-receipt-button"
                        type="button"
                        onClick={() => setCreditTransferReceipt(null)}
                        className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition-colors shadow-md cursor-pointer flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                      <p className="text-[9px] text-center mt-1 text-stone-400 font-bold uppercase tracking-wider">Comprobante listo</p>
                    </div>
                  )}
                </div>
              )}

              {/* Additional charges section */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block text-center">Ajustes (Propina, Interés, Otros)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-stone-400 uppercase">Propina</span>
                    <input type="number" min="0" value={creditTip} onChange={(e) => setCreditTip(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-center text-xs font-bold" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-stone-400 uppercase">Interés</span>
                    <input type="number" min="0" value={creditInterest} onChange={(e) => setCreditInterest(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-center text-xs font-bold" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-stone-400 uppercase">Extra</span>
                    <input type="number" min="0" value={creditExtra} onChange={(e) => setCreditExtra(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-center text-xs font-bold" />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 text-center text-stone-500">
                <p className="text-[10px] font-bold uppercase tracking-widest">Resumen de liquidación</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs px-2">
                    <span>Adeudo Original</span>
                    <span className="font-bold">{formatCurrency(selectedCreditOrder.total)}</span>
                  </div>
                  {(creditTip > 0 || creditInterest > 0 || creditExtra > 0) && (
                    <div className="flex justify-between text-xs px-2 text-mex-green">
                      <span>Ajustes</span>
                      <span className="font-bold">+{formatCurrency(creditTip + creditInterest + creditExtra)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs px-2 border-t border-stone-100 pt-1 mt-1 font-bold text-stone-800">
                    <span>Total a Liquidar</span>
                    <span>{formatCurrency(selectedCreditOrder.total + creditTip + creditInterest + creditExtra)}</span>
                  </div>
                  <div className="flex justify-between text-xs px-2 text-mex-green">
                    <span>Forma de Pago</span>
                    <span className="font-bold uppercase text-[10px]">
                      {creditPaymentMethod === 'cash' ? 'Efectivo' : creditPaymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0">
              <Button 
                variant="primary" 
                className="w-full h-14 text-base font-black rounded-xl bg-mex-green hover:bg-mex-green/90 shadow-lg shadow-mex-green/20 tracking-wider cursor-pointer disabled:grayscale disabled:opacity-50 flex items-center justify-center gap-2" 
                onClick={handleConfirmCreditPayment}
                disabled={isProcessingCreditPayment || (creditPaymentMethod === 'cash' && Number(creditCashReceived || 0) < (selectedCreditOrder.total + creditTip + creditInterest + creditExtra))}
              >
                {isProcessingCreditPayment ? (
                  <>
                    <Loader2 className="animate-spin text-white" size={18} />
                    <span>PROCESANDO...</span>
                  </>
                ) : creditPaymentMethod === 'cash' && Number(creditCashReceived || 0) < (selectedCreditOrder.total + creditTip + creditInterest + creditExtra) && Number(creditCashReceived || 0) > 0
                  ? `Faltan ${formatCurrency((selectedCreditOrder.total + creditTip + creditInterest + creditExtra) - Number(creditCashReceived || 0))}`
                  : 'LIQUIDAR DEUDA'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-4xl rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200 my-8 overflow-hidden">
            <CardHeader className="bg-mex-brown text-white rounded-t-[2rem] p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <button onClick={() => { setShowPaymentModal(false); setEditingPaymentItem(null); setShowAddPaymentItem(false); }} className="text-white/50 hover:text-white transition-colors cursor-pointer"><X size={20}/></button>
              </div>
              <p className="text-[10px] font-black text-mex-gold uppercase tracking-[0.3em] mb-1">Caja • Cobro de Cuenta</p>
              <h3 className="text-4xl font-serif">{formatCurrency(finalTotal)}</h3>
              <div className="mt-2 flex flex-col items-center">
                <p className="text-[10px] text-white/60 font-mono italic">Folios: {selectedGroup.folios.join(', ')}</p>
                {paymentMethod === 'card' && (
                  <span className="mt-2 px-2 py-0.5 bg-white/10 rounded text-[9px] font-bold text-mex-gold uppercase">Incluye comisión 4%</span>
                )}
              </div>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200 bg-white">
              
              {/* COL 1: ELEMENTOS A COBRAR (CRUD) */}
              <div className="p-6 space-y-4 max-h-[75vh] md:max-h-[500px] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <h4 className="text-xs font-black text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    📋 Artículos a Cobrar
                  </h4>
                  <button 
                    type="button"
                    onClick={() => setShowAddPaymentItem(!showAddPaymentItem)}
                    className="p-1 px-2.5 rounded-lg bg-mex-green/10 text-mex-green hover:bg-mex-green/20 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus size={12} />
                    Agregar
                  </button>
                </div>

                {/* Add Item form */}
                {showAddPaymentItem && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-mex-green/5 border border-mex-green/20 rounded-xl space-y-2"
                  >
                    <p className="text-[9px] font-black text-mex-green uppercase tracking-wider">Agregar artículo extra</p>
                    <div className="space-y-2">
                      <input 
                        type="text"
                        placeholder="Nombre del artículo (ej. Coca Cola)"
                        className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-mex-green"
                        value={addPaymentItemForm.name}
                        onChange={(e) => setAddPaymentItemForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[8px] font-bold text-stone-400 uppercase">Precio Unitario</label>
                          <input 
                            type="number"
                            min="0"
                            placeholder="Precio"
                            className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold"
                            value={addPaymentItemForm.price || ''}
                            onChange={(e) => setAddPaymentItemForm(prev => ({ ...prev, price: Math.max(0, parseFloat(e.target.value) || 0) }))}
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-stone-400 uppercase">Cantidad</label>
                          <input 
                            type="number"
                            min="1"
                            placeholder="Cant."
                            className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold"
                            value={addPaymentItemForm.quantity}
                            onChange={(e) => setAddPaymentItemForm(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button 
                          type="button"
                          onClick={() => setShowAddPaymentItem(false)}
                          className="px-2.5 py-1 text-[9px] font-black uppercase text-stone-500 hover:bg-stone-100 rounded-lg"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            if (selectedGroup.orders.length > 0) {
                              handleAddOrderItem(selectedGroup.orders[0].id, addPaymentItemForm.name, addPaymentItemForm.price, addPaymentItemForm.quantity);
                            }
                          }}
                          className="px-3 py-1 text-[9px] font-black uppercase bg-mex-green text-white hover:bg-mex-green/90 rounded-lg"
                        >
                          Confirmar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Items list with CRUD */}
                <div className="space-y-2">
                  {selectedGroup.orders.map((order) => (
                    <div key={order.id} className="space-y-1.5">
                      {selectedGroup.orders.length > 1 && (
                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest pl-1">
                          Folio: {order.folio || order.id.slice(0, 6)}
                        </p>
                      )}
                      
                      {order.items.map((item, idx) => {
                        const isEditingThis = editingPaymentItem?.orderId === order.id && editingPaymentItem?.itemIndex === idx;
                        
                        return (
                          <div 
                            key={`${order.id}-${idx}`} 
                            className={cn(
                              "p-2.5 rounded-xl border text-stone-800 transition-all flex flex-col gap-1.5",
                              isEditingThis ? "bg-amber-50/50 border-amber-200" : "bg-stone-50/50 border-stone-150 hover:bg-stone-50"
                            )}
                          >
                            {isEditingThis ? (
                              <div className="space-y-2">
                                <input 
                                  type="text"
                                  className="w-full px-2 py-1 bg-white border border-amber-200 rounded text-xs font-bold"
                                  value={editingPaymentItem.name}
                                  onChange={(e) => setEditingPaymentItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                                />
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="text-[8px] font-bold text-stone-400 uppercase">Precio</label>
                                    <input 
                                      type="number"
                                      className="w-full px-2 py-1 bg-white border border-amber-200 rounded text-xs font-bold"
                                      value={editingPaymentItem.price}
                                      onChange={(e) => setEditingPaymentItem(prev => prev ? { ...prev, price: Math.max(0, parseFloat(e.target.value) || 0) } : null)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[8px] font-bold text-stone-400 uppercase">Cantidad</label>
                                    <input 
                                      type="number"
                                      className="w-full px-2 py-1 bg-white border border-amber-200 rounded text-xs font-bold"
                                      value={editingPaymentItem.quantity}
                                      onChange={(e) => setEditingPaymentItem(prev => prev ? { ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) } : null)}
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-1.5 pt-1">
                                  <button 
                                    type="button"
                                    onClick={() => setEditingPaymentItem(null)}
                                    className="px-2 py-0.5 text-[8px] font-black uppercase text-stone-500 hover:bg-stone-200 rounded"
                                  >
                                    Cancelar
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleUpdateOrderItem(
                                      editingPaymentItem.orderId,
                                      editingPaymentItem.itemIndex,
                                      editingPaymentItem.name,
                                      editingPaymentItem.price,
                                      editingPaymentItem.quantity,
                                      editingPaymentItem.notes
                                    )}
                                    className="px-2.5 py-0.5 text-[8px] font-black uppercase bg-amber-600 text-white hover:bg-amber-700 rounded"
                                  >
                                    Guardar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-stone-700">{item.quantity}x</span>
                                    <span className="text-xs font-bold text-stone-900 truncate">{item.name}</span>
                                  </div>
                                  {item.notes && (
                                    <p className="text-[9px] text-stone-400 font-mono italic ml-5 leading-none">
                                      Nota: {item.notes}
                                    </p>
                                  )}
                                  <div className="text-[10px] text-stone-500 font-medium ml-5 mt-0.5">
                                    {formatCurrency(item.price)} c/u • <span className="font-bold text-stone-700">{formatCurrency(item.price * item.quantity)}</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-1 shrink-0">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      if (item.quantity > 1) {
                                        handleUpdateOrderItem(order.id, idx, item.name, item.price, item.quantity - 1, item.notes);
                                      } else {
                                        handleDeleteOrderItem(order.id, idx);
                                      }
                                    }}
                                    className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                                    title="Restar 1"
                                  >
                                    -
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleUpdateOrderItem(order.id, idx, item.name, item.price, item.quantity + 1, item.notes)}
                                    className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                                    title="Sumar 1"
                                  >
                                    +
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => setEditingPaymentItem({
                                      orderId: order.id,
                                      itemIndex: idx,
                                      name: item.name,
                                      price: item.price,
                                      quantity: item.quantity,
                                      notes: item.notes
                                    })}
                                    className="p-1 rounded-lg hover:bg-amber-100 text-amber-600 transition-colors cursor-pointer"
                                    title="Editar nombre/precio"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleDeleteOrderItem(order.id, idx)}
                                    className="p-1 rounded-lg hover:bg-red-150 text-red-600 transition-colors cursor-pointer"
                                    title="Eliminar artículo"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  
                  {selectedGroup.orders.every(o => o.items.length === 0) && (
                    <div className="text-center py-6 border border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
                      <p className="text-xs text-stone-400 font-medium">La cuenta no tiene artículos.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* COL 2: MÉTODO DE PAGO Y DETALLE DE COBRO */}
              <div className="p-6 space-y-6">
                {/* Disposable Section */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block text-center">
                    Desechables
                  </label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="0"
                      value={paymentDisposableQuantity}
                      onChange={(e) => setPaymentDisposableQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 text-center focus:outline-none focus:ring-2 focus:ring-mex-green/25 focus:border-mex-green transition-all"
                    />
                    <span className="text-xs text-stone-500 font-bold whitespace-nowrap">x {formatCurrency(disposablePrice)}</span>
                  </div>
                </div>

                {/* Payment Method Section */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block text-center">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => { setPaymentMethod('cash'); setTransferReceipt(null); }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all cursor-pointer",
                        paymentMethod === 'cash' ? "bg-mex-green/5 border-mex-green text-mex-green" : "bg-stone-50 border-stone-100 text-stone-400 hover:border-stone-200"
                      )}
                    >
                      <DollarSign size={22} />
                      <span className="text-[9px] font-black uppercase">Efectivo</span>
                    </button>
                    <button 
                      onClick={() => { setPaymentMethod('card'); setTransferReceipt(null); }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all cursor-pointer",
                        paymentMethod === 'card' ? "bg-blue-50 border-blue-600 text-blue-600" : "bg-stone-50 border-stone-100 text-stone-400 hover:border-stone-200"
                      )}
                    >
                      <CreditCard size={22} />
                      <span className="text-[9px] font-black uppercase">Tarjeta</span>
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('transfer')}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all cursor-pointer",
                        paymentMethod === 'transfer' ? "bg-purple-50 border-purple-600 text-purple-600" : "bg-stone-50 border-stone-100 text-stone-400 hover:border-stone-200"
                      )}
                    >
                      <LucideImage size={22} />
                      <span className="text-[9px] font-black uppercase">Transfer</span>
                    </button>
                    <button 
                      onClick={() => { setPaymentMethod('credit'); setTransferReceipt(null); }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all cursor-pointer",
                        paymentMethod === 'credit' ? "bg-rose-50 border-rose-600 text-rose-600" : "bg-stone-50 border-stone-100 text-stone-400 hover:border-stone-200"
                      )}
                    >
                      <User size={22} />
                      <span className="text-[9px] font-black uppercase">Crédito</span>
                    </button>
                  </div>
                </div>

                {/* Cash Received & Change Section */}
                {paymentMethod === 'cash' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-stone-50 rounded-2xl border border-stone-200"
                  >
                    <div className="flex justify-between items-end mb-4">
                      <div className="flex-1 mr-4">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">
                          Efectivo Recibido
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                          <input
                            type="number"
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-7 pr-4 py-2 bg-white border border-stone-200 rounded-xl font-bold text-lg focus:ring-2 focus:ring-mex-green/20 focus:border-mex-green outline-none"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 block">
                          Cambio
                        </label>
                        <p className={cn(
                          "text-2xl font-black font-serif",
                          Number(cashReceived) - finalTotal >= 0 ? "text-mex-green" : "text-stone-300"
                        )}>
                          {Number(cashReceived) - finalTotal > 0 
                            ? formatCurrency(Number(cashReceived) - finalTotal) 
                            : formatCurrency(0)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {[20, 50, 100, 200, 500].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashReceived((prev) => (Number(prev || 0) + val).toString())}
                          className="py-1.5 bg-white border border-stone-200 rounded-lg text-[10px] font-bold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all shadow-sm cursor-pointer"
                        >
                          +${val}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCashReceived(finalTotal.toString())}
                        className="py-1.5 bg-mex-green/10 text-mex-green rounded-lg text-[10px] font-black uppercase hover:bg-mex-green/20 active:scale-95 transition-all border border-mex-green/10 cursor-pointer"
                      >
                        Exacto
                      </button>
                      <button
                        type="button"
                        onClick={() => setCashReceived('')}
                        className="py-1.5 col-span-2 bg-stone-200 rounded-lg text-[10px] font-black uppercase text-stone-600 hover:bg-stone-300 active:scale-95 transition-all cursor-pointer"
                      >
                        Limpiar
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Customer Name Section for Credit Payments */}
                {paymentMethod === 'credit' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-3 duration-200">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block text-center">
                      Nombre del Cliente
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                      <input 
                        type="text"
                        className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-mex-green/25 focus:border-mex-green transition-all"
                        placeholder="Escribe el nombre del cliente..."
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Upload section for transfer receipt */}
                {paymentMethod === 'transfer' && (
                  <div className="space-y-2 animate-in fade-in-50 duration-200">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block text-center">
                      Foto del Comprobante (Opcional)
                    </label>
                    
                    {!transferReceipt ? (
                      <div
                        id="transfer-dropzone"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('receipt-upload')?.click()}
                        className={cn(
                          "border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1",
                          isDragging 
                            ? "border-mex-green bg-mex-green/5 text-mex-green scale-[1.02]" 
                            : "border-stone-200 bg-stone-50 hover:bg-stone-100/50 text-stone-500 hover:border-stone-300"
                        )}
                      >
                        <UploadCloud size={24} className={isDragging ? "text-mex-green" : "text-stone-450"} />
                        <p className="text-[11px] font-black leading-tight">
                          Arrastra la foto aquí o <span className="text-mex-brown underline">haz clic</span>
                        </p>
                        <p className="text-[9px] text-stone-400">JPG, PNG o WEBP (Opcional • máx. 10MB)</p>
                        <input 
                          id="receipt-upload"
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              processReceiptFile(e.target.files[0]);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="relative rounded-2xl overflow-hidden border border-stone-200 bg-stone-50 p-2">
                        <img 
                          src={transferReceipt} 
                          alt="Comprobante de Transferencia" 
                          className="w-full h-32 object-contain rounded-xl"
                        />
                        <button 
                          id="remove-receipt-button"
                          type="button"
                          onClick={() => setTransferReceipt(null)}
                          className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition-colors shadow-md cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                        <p className="text-[9px] text-center mt-1 text-stone-400 font-bold uppercase tracking-wider">Comprobante listo</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3 pt-2 text-center text-stone-500">
                  <p className="text-[10px] font-bold uppercase tracking-widest">Resumen</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs px-2">
                      <span>Consumo</span>
                      <span className="font-bold">{formatCurrency(selectedGroup.total)}</span>
                    </div>
                    {paymentMethod === 'card' && (
                      <div className="flex justify-between text-xs px-2 text-mex-green">
                        <span>Comisión</span>
                        <span className="font-bold">+{formatCurrency(cardFee)}</span>
                      </div>
                    )}
                    {paymentMethod === 'transfer' && (
                      <div className="flex justify-between text-xs px-2 text-purple-600">
                        <span>Comprobante</span>
                        <span className="font-bold">{transferReceipt ? "Cargado ✓" : "Sin foto (Opcional)"}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    variant="primary" 
                    className="w-full h-14 text-lg font-black rounded-xl bg-mex-green hover:bg-mex-green/90 shadow-lg shadow-mex-green/20 tracking-widest disabled:grayscale disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer" 
                    onClick={handleConfirmPayment}
                    disabled={isProcessingPayment || (paymentMethod === 'cash' && Number(cashReceived || 0) < finalTotal)}
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader2 className="animate-spin text-white" size={20} />
                        <span>PROCESANDO...</span>
                      </>
                    ) : paymentMethod === 'cash' && Number(cashReceived || 0) < finalTotal && Number(cashReceived || 0) > 0
                      ? `Faltan ${formatCurrency(finalTotal - Number(cashReceived || 0))}`
                      : 'CONFIRMAR PAGO'}
                  </Button>
                </div>
              </div>

            </div>
          </Card>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && lastPaymentData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="bg-mex-green text-white rounded-t-[2rem] p-6 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-2xl font-serif">¡Venta Exitosa!</h3>
              <p className="text-white/80 text-sm mt-1">El pago ha sido registrado</p>
            </CardHeader>
            <CardContent className="p-6">
              <div id="ticket-content" className="bg-white border-2 border-dashed border-stone-200 p-6 rounded-xl font-mono text-[10px] space-y-4 shadow-sm mb-6">
                <div className="text-center space-y-1">
                  <p className="font-bold text-xs">LAS CAZUELAS DEL CASTOR</p>
                  <p>Ticket de Venta</p>
                  <p>{new Date().toLocaleString()}</p>
                </div>
                <div className="border-t border-stone-200 pt-2 space-y-1">
                  <p>Mesa: {lastPaymentData.group.displayTitle}</p>
                  <p>Folios: {lastPaymentData.group.folios.join(", ")}</p>
                  <p>Meseros: {lastPaymentData.group.waiterNames.join(", ")}</p>
                  {lastPaymentData.method === 'credit' && (
                    <>
                      <p className="font-bold text-red-700">MÉTODO: CRÉDITO</p>
                      {lastPaymentData.group.orders.find(o => o.clientName)?.clientName && (
                        <p className="font-bold text-red-700">CLIENTE: {lastPaymentData.group.orders.find(o => o.clientName)?.clientName}</p>
                      )}
                    </>
                  )}
                </div>
                <div className="border-t border-stone-200 pt-2 space-y-1">
                  {lastPaymentData.group.orders.map(order => 
                    order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.quantity}x {item.name}</span>
                        <span>{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-stone-200 pt-2 space-y-1 font-bold text-xs">
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span>{formatCurrency(lastPaymentData.total)}</span>
                  </div>
                  <p className="text-center pt-4 italic">¡Gracias por su visita!</p>
                </div>
              </div>

              {createPortal(
                <div id="print-ticket" className="print-only" style={{ fontFamily: 'monospace', fontSize: '12px', padding: '20px', width: '300px', margin: '0 auto' }}>
                  <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '14px', margin: '2px 0' }}>LAS CAZUELAS DEL CASTOR</p>
                    <p style={{ margin: '2px 0' }}>Ticket de Venta</p>
                    <p style={{ margin: '2px 0' }}>{new Date().toLocaleString()}</p>
                  </div>
                  <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '10px 0', margin: '10px 0' }}>
                    <p style={{ margin: '2px 0' }}>Mesa: {lastPaymentData.group.displayTitle}</p>
                    <p style={{ margin: '2px 0' }}>Folios: {lastPaymentData.group.folios.join(", ")}</p>
                    <p style={{ margin: '2px 0' }}>Meseros: {lastPaymentData.group.waiterNames.join(", ")}</p>
                  </div>
                  <div style={{ borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                    {lastPaymentData.group.orders.map(order => 
                      order.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                          <span>{item.quantity}x {item.name}</span>
                          <span>{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ fontWeight: 'bold' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total</span>
                      <span>{formatCurrency(lastPaymentData.total)}</span>
                    </div>
                  </div>
                  <p style={{ textAlign: 'center', marginTop: '20px', fontStyle: 'italic' }}>¡Gracias por su visita!</p>
                </div>,
                document.body
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="flex-col gap-2 h-20 rounded-2xl border-stone-100 hover:bg-stone-50"
                  onClick={() => generateTicketPDF(true)}
                >
                  <Package size={20} className="text-mex-gold" />
                  <span className="text-[10px] font-black uppercase">Guardar PDF</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-col gap-2 h-20 rounded-2xl border-stone-100 hover:bg-stone-50"
                  onClick={handleSendEmail}
                >
                  <Receipt size={20} className="text-blue-500" />
                  <span className="text-[10px] font-black uppercase">Enviar Mail</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-col gap-2 h-20 rounded-2xl border-stone-100 hover:bg-stone-50 md:col-span-2"
                  onClick={handlePrint}
                >
                  <History size={20} className="text-stone-400" />
                  <span className="text-[10px] font-black uppercase">Imprimir Ticket</span>
                </Button>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0">
              <Button 
                variant="primary" 
                className="w-full h-12 rounded-xl bg-mex-green hover:bg-mex-green/90 font-black tracking-widest text-xs uppercase"
                onClick={() => setShowSuccessModal(false)}
              >
                Cerrar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Closing Modal */}
      {showClosingModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl">
            <CardHeader className="bg-mex-brown text-white rounded-t-[2rem] p-6 text-center">
              <h3 className="text-2xl font-serif">Cierre de Caja</h3>
              <p className="text-[10px] text-mex-gold font-bold uppercase tracking-widest mt-1">Resumen del Turno</p>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3 px-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 italic">Apertura</span>
                  <span className="font-bold text-stone-700">{formatCurrency(sessionStats.opening)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 italic">Ventas (Efectivo)</span>
                  <span className="font-bold text-mex-green">+{formatCurrency(sessionStats.cashSales)}</span>
                </div>
                {sessionStats.creditSettlementsCash > 0 && (
                  <div className="flex justify-between items-center text-sm pl-2 border-l-2 border-rose-200">
                    <span className="text-stone-500 italic text-[11px]">Cobro Crédito (Efectivo)</span>
                    <span className="font-bold text-rose-600 text-[11px]">+{formatCurrency(sessionStats.creditSettlementsCash)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 italic">Ventas (Tarjeta)</span>
                  <span className="font-bold text-blue-600">+{formatCurrency(sessionStats.cardSales)}</span>
                </div>
                {sessionStats.creditSettlementsCard > 0 && (
                  <div className="flex justify-between items-center text-sm pl-2 border-l-2 border-rose-200">
                    <span className="text-stone-500 italic text-[11px]">Cobro Crédito (Tarjeta)</span>
                    <span className="font-bold text-rose-500 text-[11px]">+{formatCurrency(sessionStats.creditSettlementsCard)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 italic">Ventas (Transferencia)</span>
                  <span className="font-bold text-purple-600">+{formatCurrency(sessionStats.transferSales)}</span>
                </div>
                {sessionStats.creditSettlementsTransfer > 0 && (
                  <div className="flex justify-between items-center text-sm pl-2 border-l-2 border-rose-200">
                    <span className="text-stone-500 italic text-[11px]">Cobro Crédito (Transfer Trf.)</span>
                    <span className="font-bold text-rose-400 text-[11px]">+{formatCurrency(sessionStats.creditSettlementsTransfer)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 italic">Ventas (Crédito)</span>
                  <span className="font-bold text-rose-600">+{formatCurrency(sessionStats.creditSales)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500 italic">Gastos</span>
                  <span className="font-bold text-mex-red">-{formatCurrency(sessionStats.expenses)}</span>
                </div>
                <div className="pt-3 border-t border-stone-100 flex justify-between items-end">
                  <span className="text-xs font-black text-stone-400 uppercase tracking-widest">Total en Caja</span>
                  <span className="text-3xl font-serif font-bold text-mex-terracotta">{formatCurrency(totalCash)}</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 mt-4">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                <p className="text-[10px] text-amber-800 leading-relaxed italic">
                  Al confirmar el cierre, los pedidos "Served" o "Ready" no cobrados se mantendrán para el siguiente turno.
                </p>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0 flex gap-3">
              <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={() => setShowClosingModal(false)}>
                Atrás
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 h-12 text-xs font-black rounded-xl bg-mex-brown hover:bg-stone-800 shadow-lg shadow-mex-brown/20 tracking-widest uppercase" 
                onClick={handleCloseDay}
              >
                Cerrar Caja
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Log Modal (Create/Update) */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar">
            <CardHeader className="bg-mex-brown text-white rounded-t-[2rem] p-6 text-center shrink-0">
              <h3 className="text-2xl font-serif">{editingLog ? 'Editar Movimiento' : 'Movimiento de Caja'}</h3>
              <p className="text-[10px] text-mex-gold font-bold uppercase tracking-widest mt-1">Registrar entrada o salida</p>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={() => setLogForm({...logForm, type: 'income'})}
                  className={cn(
                    "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all cursor-pointer",
                    logForm.type === 'income' ? "bg-mex-green/5 border-mex-green text-mex-green shadow-sm" : "bg-stone-50 border-stone-100 text-stone-400"
                  )}
                >
                  Ingreso
                </button>
                <button 
                  type="button"
                  onClick={() => setLogForm({...logForm, type: 'expense'})}
                  className={cn(
                    "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all cursor-pointer",
                    logForm.type === 'expense' ? "bg-red-50 border-red-200 text-red-600 shadow-sm" : "bg-stone-50 border-stone-100 text-stone-400"
                  )}
                >
                  Egreso
                </button>
              </div>

              {/* Payment Method Selector (Efectivo / Transferencia / Tarjeta) */}
              {(logForm.type === 'income' || logForm.type === 'expense') && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Método de Operación</label>
                  <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl">
                    <button 
                      type="button"
                      onClick={() => setLogForm({...logForm, paymentMethod: 'cash'})}
                      className={cn(
                        "py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        logForm.paymentMethod === 'cash' ? "bg-white text-stone-850 shadow-sm font-bold" : "text-stone-500 hover:text-stone-700 hover:bg-stone-50/50"
                      )}
                    >
                      Efectivo
                    </button>
                    <button 
                      type="button"
                      onClick={() => setLogForm({...logForm, paymentMethod: 'transfer'})}
                      className={cn(
                        "py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        logForm.paymentMethod === 'transfer' ? "bg-purple-650 text-white shadow-sm font-bold" : "text-stone-500 hover:text-stone-700 hover:bg-stone-50/50"
                      )}
                    >
                      Transfer
                    </button>
                    <button 
                      type="button"
                      onClick={() => setLogForm({...logForm, paymentMethod: 'card'})}
                      className={cn(
                        "py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        logForm.paymentMethod === 'card' ? "bg-blue-655 text-white shadow-sm font-bold" : "text-stone-500 hover:text-stone-700 hover:bg-stone-50/50"
                      )}
                    >
                      Tarjeta
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Receipt for Transfer */}
              {(logForm.type === 'income' || logForm.type === 'expense') && logForm.paymentMethod === 'transfer' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">
                    Comprobante de Transferencia
                  </label>
                  {!logTransferReceipt ? (
                    <div
                      id="log-transfer-dropzone"
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingLogReceipt(true); }}
                      onDragLeave={() => setIsDraggingLogReceipt(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingLogReceipt(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          processLogReceiptFile(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => document.getElementById('log-receipt-upload')?.click()}
                      className={cn(
                        "border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1",
                        isDraggingLogReceipt 
                          ? "border-mex-green bg-mex-green/5 text-mex-green scale-[1.02]" 
                          : "border-stone-200 bg-stone-50 hover:bg-stone-100/50 text-stone-500 hover:border-stone-300"
                      )}
                    >
                      <UploadCloud size={20} className={isDraggingLogReceipt ? "text-mex-green animate-bounce" : "text-stone-400"} />
                      <p className="text-[9px] font-black leading-tight">
                        Arrastra foto o <span className="text-mex-brown underline">haz clic</span>
                      </p>
                      <input 
                        id="log-receipt-upload"
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            processLogReceiptFile(e.target.files[0]);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden border border-stone-200 bg-stone-50 p-1.5 flex flex-col items-center">
                      <img 
                        src={logTransferReceipt} 
                        alt="Comprobante Movimiento" 
                        className="w-full h-24 object-contain rounded-xl"
                      />
                      <button 
                        type="button"
                        onClick={() => setLogTransferReceipt(null)}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1 rounded-full transition-colors shadow-md cursor-pointer flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                      <p className="text-[8px] text-center mt-1 text-stone-400 font-bold uppercase tracking-wider leading-none">Comprobante de movimiento listo</p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Monto</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input 
                      type="number" 
                      value={logForm.amount}
                      onChange={(e) => setLogForm({...logForm, amount: e.target.value})}
                      className="w-full pl-11 pr-4 py-4 text-2xl font-black bg-stone-50 rounded-2xl border border-stone-200 focus:border-mex-brown focus:ring-0 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Concepto</label>
                  <textarea 
                    value={logForm.reason}
                    onChange={(e) => setLogForm({...logForm, reason: e.target.value})}
                    className="w-full px-5 py-4 text-sm font-medium bg-stone-50 rounded-2xl border border-stone-200 focus:border-mex-brown focus:ring-0 outline-none min-h-[100px] no-scrollbar"
                    placeholder="Escribe la razón del movimiento..."
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0 flex gap-3">
              <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={() => setShowLogModal(false)}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-[2] h-12 text-xs font-black rounded-xl bg-mex-brown hover:bg-stone-800 shadow-lg shadow-mex-brown/20 tracking-widest uppercase" 
                onClick={handleSaveLog}
              >
                {editingLog ? 'Actualizar' : 'Registrar'}
              </Button>
            </CardFooter>
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
              {confirmAction.requireReason && (
                <div className="mt-4">
                  <label className="text-[10px] font-black text-red-650 uppercase tracking-widest block mb-1">
                    Motivo de cancelación / eliminación (Obligatorio)
                  </label>
                  <textarea
                    value={cancelReasonText}
                    onChange={(e) => setCancelReasonText(e.target.value)}
                    placeholder="Ej: Se ingresó monto incorrecto, duplicado, error de dedo, etc."
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-red-400 focus:outline-none transition-all text-stone-700 min-h-[80px]"
                    required
                  />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2 p-4 bg-stone-50">
              <Button variant="ghost" className="flex-1" onClick={() => setShowConfirmModal(false)}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 gap-2 bg-mex-red hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none" 
                onClick={() => confirmAction.action(cancelReasonText)}
                disabled={!!confirmAction.requireReason && !cancelReasonText.trim()}
              >
                <CheckCircle2 size={18} />
                Confirmar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Lightbox Receipt Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in duration-205">
          <div className="relative w-full max-w-lg bg-stone-900 border border-stone-800 rounded-[2rem] p-4 flex flex-col items-center shadow-2xl">
            <button 
              onClick={() => setPreviewImage(null)} 
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full transition-colors z-[210] cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="w-full h-[65vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black">
              <img 
                src={previewImage} 
                alt="Comprobante de Transferencia" 
                className="max-w-full max-h-full object-contain rounded-xl"
              />
            </div>
            <p className="text-white/60 font-black text-[10px] mt-3 uppercase tracking-widest leading-none">
              Comprobante de Pago por Transferencia
            </p>
          </div>
        </div>
      )}

      {/* Audit Modal (Arqueo de Caja) */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-3xl rounded-[2rem] shadow-2xl bg-white overflow-hidden max-h-[90vh] flex flex-col">
            <CardHeader className="bg-purple-700 text-white p-6 shrink-0 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-2xl font-serif flex items-center gap-2">
                  <Calculator size={24} />
                  Arqueo de Caja
                </h3>
                <p className="text-[10.5px] text-purple-100 font-bold uppercase tracking-widest mt-0.5">
                  Turno/Jornada: {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button 
                onClick={() => setShowAuditModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </CardHeader>
            
            <CardContent className="p-6 overflow-y-auto space-y-6 no-scrollbar">
              {/* Type Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">
                  Tipo de Arqueo
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAuditType('opening')}
                    className={cn(
                      "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer",
                      auditType === 'opening' 
                        ? "bg-mex-green/5 border-mex-green text-mex-green shadow-sm" 
                        : "bg-stone-50 border-stone-200/60 text-stone-400 hover:bg-stone-100"
                    )}
                  >
                    <span className="text-base">🌅</span>
                    <span>Inicio de Jornada (Apertura)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditType('partial')}
                    className={cn(
                      "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer",
                      auditType === 'partial' 
                        ? "bg-purple-50 border-purple-400 text-purple-700 shadow-sm" 
                        : "bg-stone-50 border-stone-200/60 text-stone-400 hover:bg-stone-100"
                    )}
                  >
                    <span className="text-base">⚡</span>
                    <span>Control Parcial (Arqueo)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditType('closing')}
                    className={cn(
                      "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer",
                      auditType === 'closing' 
                        ? "bg-mex-brown/5 border-mex-brown text-mex-brown shadow-sm" 
                        : "bg-stone-50 border-stone-200/60 text-stone-400 hover:bg-stone-100"
                    )}
                  >
                    <span className="text-base">🌌</span>
                    <span>Fin de Jornada (Cierre)</span>
                  </button>
                </div>
                <p className="text-[10px] text-stone-450 italic px-1">
                  {auditType === 'opening' && "Apertura: Se usará para contar el efectivo inicial y establecer la apertura de caja."}
                  {auditType === 'partial' && "Parcial: Auditoría rápida de cajón para corroborar cierres parciales de turno."}
                  {auditType === 'closing' && "Cierre: Realiza el cierre oficial de jornada comparando el efectivo real contra el sistema."}
                </p>
              </div>

              {/* Day Before Loader / Adjustment helper for Opening Audit */}
              {auditType === 'opening' && (
                <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/70 border border-indigo-100 rounded-2xl p-5 space-y-4 shadow-sm">
                  {lastClosingAudit ? (
                    <>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-150 text-indigo-700 uppercase tracking-widest leading-none">
                            Cierre de Caja Anterior Registrado
                          </span>
                          <h4 className="text-base font-serif font-bold text-stone-850 mt-1">
                            La jornada anterior cerró con: <span className="text-indigo-700 font-sans font-black">{formatCurrency(lastClosingAudit.totalPhysical)}</span>
                          </h4>
                          <p className="text-[10.5px] text-stone-500 font-medium">
                            Arqueo realizado el {new Date(lastClosingAudit.timestamp).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} por <span className="font-bold">{lastClosingAudit.userName}</span>.
                          </p>
                        </div>
                        <div className="p-2.5 bg-indigo-100/50 text-indigo-700 rounded-2xl">
                          <History size={20} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <button
                          type="button"
                          onClick={handleLoadLastClosingCounts}
                          className="px-4 py-3 rounded-xl text-[10.5px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
                        >
                          📥 Cargar Efectivo del Día Anterior
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAdjustmentHelper(!showAdjustmentHelper)}
                          className={cn(
                            "px-4 py-3 rounded-xl text-[10.5px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 cursor-pointer",
                            showAdjustmentHelper 
                              ? "bg-indigo-100 border-indigo-300 text-indigo-850 font-bold" 
                              : "bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50/50"
                          )}
                        >
                          ⚙️ {showAdjustmentHelper ? 'Ocultar Ajustes de Ingreso' : 'Realizar Ajuste de Ingreso'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black bg-stone-150 text-stone-600 uppercase tracking-widest leading-none">
                            Arqueo Anterior No Encontrado
                          </span>
                          <h4 className="text-sm font-serif font-bold text-stone-850 mt-1">
                            No se detectó un arqueo de cierre de jornada anterior en el sistema.
                          </h4>
                          <p className="text-[10px] text-stone-450 italic">
                            Puedes configurar el efectivo inicial de apertura manualmente ingresándolas pieza por pieza, o preparar un ajuste libre a continuación:
                          </p>
                        </div>
                        <div className="p-2.5 bg-stone-100 text-stone-500 rounded-2xl">
                          <AlertTriangle className="text-amber-500" size={20} />
                        </div>
                      </div>
                      
                      <div className="flex justify-start">
                        <button
                          type="button"
                          onClick={() => setShowAdjustmentHelper(!showAdjustmentHelper)}
                          className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          ⚙️ {showAdjustmentHelper ? 'Ocultar Preparador de Ajustes' : 'Ajustes / Carga Rápida de Dinero'}
                        </button>
                      </div>
                    </div>
                  )}

                  {showAdjustmentHelper && (
                    <div className="bg-white/85 border border-indigo-100/80 rounded-2xl p-4 space-y-4 shadow-inner animate-in slide-in-from-top-1 duration-200">
                      <div>
                        <p className="text-[10.5px] font-black text-indigo-900 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                          <span>💸</span> Ajuste de Dinero para Fondo de Caja
                        </p>
                        <p className="text-[10px] text-stone-450 leading-relaxed">
                          Utiliza estas herramientas para sumar o restar importes de forma rápida. Los desgloses de billetes y monedas en el arqueo se actualizarán automáticamente.
                        </p>
                      </div>
                      
                      <div className="space-y-1.5">
                        <p className="text-[8.5px] font-black text-indigo-750 uppercase tracking-wider px-1">Preservar valores de cambio (Ajuste por pieza)</p>
                        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAddPresetDenomination("1000", 1)}
                            className="py-2 bg-indigo-50/40 hover:bg-indigo-150/55 text-indigo-700 border border-indigo-100/60 rounded-xl text-[10px] font-bold text-center transition-colors cursor-pointer"
                          >
                            +1 de $1,000
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddPresetDenomination("500", 1)}
                            className="py-2 bg-indigo-50/40 hover:bg-indigo-150/55 text-indigo-700 border border-indigo-100/60 rounded-xl text-[10px] font-bold text-center transition-colors cursor-pointer"
                          >
                            +1 de $500
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddPresetDenomination("200", 1)}
                            className="py-2 bg-indigo-50/40 hover:bg-indigo-150/55 text-indigo-700 border border-indigo-100/60 rounded-xl text-[10px] font-bold text-center transition-colors cursor-pointer"
                          >
                            +1 de $200
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddPresetDenomination("100", 1)}
                            className="py-2 bg-indigo-50/40 hover:bg-indigo-150/55 text-indigo-700 border border-indigo-100/60 rounded-xl text-[10px] font-bold text-center transition-colors cursor-pointer"
                          >
                            +1 de $100
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddPresetDenomination("50", 1)}
                            className="py-2 bg-indigo-50/40 hover:bg-indigo-150/55 text-indigo-700 border border-indigo-100/60 rounded-xl text-[10px] font-bold text-center transition-colors cursor-pointer"
                          >
                            +1 de $50
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddPresetDenomination("20_bill", 1)}
                            className="py-2 bg-indigo-50/40 hover:bg-indigo-150/55 text-indigo-700 border border-indigo-100/60 rounded-xl text-[10px] font-bold text-center transition-colors cursor-pointer"
                          >
                            +1 de $20 (B)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddPresetDenomination("10", 5)}
                            className="py-2 bg-indigo-50/40 hover:bg-indigo-150/55 text-indigo-700 border border-indigo-100/60 rounded-xl text-[10px] font-bold text-center transition-colors cursor-pointer"
                          >
                            +5 de $10
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddPresetDenomination("5", 5)}
                            className="py-2 bg-indigo-50/40 hover:bg-indigo-150/55 text-indigo-700 border border-indigo-100/60 rounded-xl text-[10px] font-bold text-center transition-colors cursor-pointer"
                          >
                            +5 de $5
                          </button>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-indigo-100/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 md:max-w-[360px]">
                          <span className="text-[10px] font-black text-indigo-850 uppercase tracking-widest whitespace-nowrap">Ingreso / Ajuste Libre:</span>
                          <div className="relative flex items-center w-full">
                            <span className="absolute left-3 text-xs font-bold text-stone-400">$</span>
                            <input
                              type="number"
                              placeholder="Ej: 500, -1000 ..."
                              className="w-full pl-7 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all"
                              value={customAdjustmentRaw}
                              onChange={(e) => setCustomAdjustmentRaw(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApplyCustomAdjustment(true)}
                            className="flex-1 md:flex-none px-4 py-2.5 bg-mex-green hover:bg-mex-green-dark text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md active:scale-[0.98] transition-all cursor-pointer border-none"
                          >
                            📥 Surtir Ajuste de Ingreso
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyCustomAdjustment(false)}
                            className="flex-1 md:flex-none px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md active:scale-[0.98] transition-all cursor-pointer border-none"
                          >
                            📤 Retirar del Cajón
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Session Cash Flow Summary */}
              {auditType !== 'opening' && (
                <div className="bg-stone-50 border border-stone-200/60 p-4 rounded-2xl space-y-4 shadow-inner">
                  {auditType === 'closing' ? (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between px-1">
                        <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest flex items-center gap-1">
                          <span>🌌</span> ARQUEO DE CIERRE FIN DE JORNADA
                        </p>
                        <span className="text-[9px] text-stone-400 font-bold font-mono uppercase">Resumen del Turno</span>
                      </div>

                      {/* Side-by-side total money entered vs. cash in register */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* LEFT: TOTAL DEL DINERO QUE INGRESO (suma efectivo, tarjeta, transferencia) */}
                        <div className="bg-white p-4.5 rounded-2xl border border-stone-150 shadow-sm flex flex-col justify-between">
                          <div>
                            <span className="text-[9px] text-stone-400 font-black uppercase tracking-wider block">
                              Total del Dinero que Ingresó
                            </span>
                            <span className="text-2xl font-black text-stone-900 mt-1 block">
                              {formatCurrency(
                                sessionCashSales +
                                sessionCardSales +
                                sessionTransferSales +
                                (sessionStats.creditSettlementsCash || 0) +
                                (sessionStats.creditSettlementsCard || 0) +
                                (sessionStats.creditSettlementsTransfer || 0)
                              )}
                            </span>
                            <p className="text-[9px] text-stone-400 mt-1 italic leading-relaxed">
                              Suma total de pagos recibidos hoy (Efectivo, Tarjeta, Transferencia y Cobros de Crédito)
                            </p>
                          </div>
                          
                          <div className="mt-4 pt-3 border-t border-stone-100 grid grid-cols-3 gap-2">
                            <div className="flex flex-col">
                              <span className="text-[8px] text-stone-400 font-extrabold uppercase">Efectivo</span>
                              <span className="text-[10.5px] font-bold text-stone-800 leading-tight mt-0.5">
                                {formatCurrency(sessionCashSales + (sessionStats.creditSettlementsCash || 0))}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] text-stone-400 font-extrabold uppercase">Tarjeta</span>
                              <span className="text-[10.5px] font-bold text-stone-800 leading-tight mt-0.5">
                                {formatCurrency(sessionCardSales + (sessionStats.creditSettlementsCard || 0))}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] text-stone-400 font-extrabold uppercase">Transfer.</span>
                              <span className="text-[10.5px] font-bold text-stone-800 leading-tight mt-0.5">
                                {formatCurrency(sessionTransferSales + (sessionStats.creditSettlementsTransfer || 0))}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT: DINERO EN CAJA */}
                        <div className="bg-purple-50/40 p-4.5 rounded-2xl border border-purple-100 shadow-sm flex flex-col justify-between">
                          <div>
                            <span className="text-[9px] text-purple-700 font-black uppercase tracking-wider block">
                              Efectivo Esperado en Caja (Sistema)
                            </span>
                            <span className="text-2xl font-black text-purple-800 mt-1 block">
                              {formatCurrency(totalCash)}
                            </span>
                            <p className="text-[9px] text-purple-600 mt-1 italic leading-relaxed">
                              Efectivo que debe haber físicamente en cajón (Fondo Inicial + Ventas Efectivo - Gastos)
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-purple-100 grid grid-cols-2 gap-2">
                            <div className="flex flex-col">
                              <span className="text-[8px] text-purple-600 font-extrabold uppercase">Físico Contado</span>
                              <span className="text-[11px] font-black text-purple-700 leading-tight mt-0.5">
                                {formatCurrency(calculatePhysicalTotal(auditCounts))}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] text-purple-600 font-extrabold uppercase">Fondo Inicial</span>
                              <span className="text-[11px] font-bold text-stone-700 leading-tight mt-0.5">
                                {formatCurrency(sessionOpeningCash)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* LO INGRESADO O EGRESADO */}
                      <div className="bg-white p-3.5 rounded-2xl border border-stone-150 shadow-sm grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[8px] text-stone-450 font-black uppercase block leading-none">
                            Dinero Ingresado a Caja (Fondo Apertura)
                          </span>
                          <span className="text-sm font-black text-mex-green block mt-1.5 font-sans">
                            +{formatCurrency(sessionOpeningCash)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] text-stone-450 font-black uppercase block leading-none">
                            Dinero Egresado de Caja (Gastos / Retiros)
                          </span>
                          <span className="text-sm font-black text-red-600 block mt-1.5 font-sans">
                            -{formatCurrency(sessionExpenses)}
                          </span>
                        </div>
                      </div>

                      {/* DIFERENCIA DE ARQUEO: FÍSICO CONTRA LO AGREGADO O SUSTRAIDO DE CAJA */}
                      {(() => {
                        const countedCash = calculatePhysicalTotal(auditCounts);
                        const expectedCash = totalCash;
                        const diffValue = countedCash - expectedCash;
                        return (
                          <div className={cn(
                            "p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left",
                            Math.abs(diffValue) < 0.01 
                              ? "bg-green-50/80 border-green-200 text-green-800" 
                              : diffValue < 0 
                                ? "bg-rose-50 border-rose-200 text-rose-800" 
                                : "bg-blue-50 border-blue-200 text-blue-800"
                          )}>
                            <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-widest leading-none">
                                Diferencia (Físico vs. Esperado)
                              </p>
                              <p className="text-[11px] text-stone-600 font-semibold leading-relaxed">
                                Diferencia del efectivo físico ingresado en arqueo (<strong className="font-extrabold">{formatCurrency(countedCash)}</strong>) contra el balance esperado de caja (<strong className="font-extrabold">{formatCurrency(expectedCash)}</strong>).
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              {Math.abs(diffValue) < 0.01 ? (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black bg-green-100 text-green-700 border border-green-200 uppercase tracking-widest">
                                  Perfecto✓
                                </span>
                              ) : (
                                <div className="flex flex-col items-end">
                                  <span className={cn(
                                    "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg",
                                    diffValue < 0 ? "bg-rose-100 text-rose-700 border border-rose-200" : "bg-blue-100 text-blue-700 border border-blue-200"
                                  )}>
                                    {diffValue < 0 ? 'FALTANTE 🔴' : 'SOBRANTE 🔵'}
                                  </span>
                                  <span className="text-lg font-black mt-1 font-mono leading-none">
                                    {diffValue > 0 ? '+' : ''}{formatCurrency(diffValue)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <>
                      {/* Original UI for other audit types (partial, etc.) */}
                      <div className="flex items-center justify-between px-1">
                        <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
                          📊 Flujo de Efectivo en Sistema (Turno Actual)
                        </p>
                        <span className="text-[9px] text-stone-400 font-bold font-mono">Resumen de Cuenta</span>
                      </div>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white p-2.5 rounded-xl border border-stone-150 flex flex-col justify-between shadow-sm">
                          <span className="text-[8px] text-stone-400 font-extrabold uppercase leading-none">Caja Inicial</span>
                          <span className="text-sm font-bold text-stone-700 mt-1">{formatCurrency(sessionOpeningCash)}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-stone-150 flex flex-col justify-between shadow-sm">
                          <span className="text-[8px] text-stone-400 font-extrabold uppercase leading-none">(+) Ventas Efectivo</span>
                          <span className="text-sm font-bold text-mex-green mt-1">+{formatCurrency(sessionCashSales + sessionStats.creditSettlementsCash)}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-stone-150 flex flex-col justify-between shadow-sm">
                          <span className="text-[8px] text-stone-400 font-extrabold uppercase leading-none">(-) Gastos/Egresos</span>
                          <span className="text-sm font-bold text-mex-red mt-1">-{formatCurrency(sessionExpenses)}</span>
                        </div>
                        <div className="bg-purple-600 p-2.5 rounded-xl border border-purple-700 flex flex-col justify-between shadow-lg">
                          <span className="text-[8px] text-purple-100 font-extrabold uppercase leading-none">Efectivo Esperado</span>
                          <span className="text-sm font-black text-white mt-1">{formatCurrency(totalCash)}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-stone-200/60">
                        <div className="bg-white/50 p-3 rounded-xl border border-stone-150 space-y-2">
                          <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest leading-none">Ventas Totales del Turno (Todas las formas de pago)</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="flex flex-col">
                              <span className="text-[8px] text-stone-400 font-bold uppercase">Efectivo</span>
                              <span className="text-[11px] font-bold text-stone-700">{formatCurrency(sessionCashSales)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] text-stone-400 font-bold uppercase">Tarjeta</span>
                              <span className="text-[11px] font-bold text-stone-700">{formatCurrency(sessionCardSales)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] text-stone-400 font-bold uppercase">Transf.</span>
                              <span className="text-[11px] font-bold text-stone-700">{formatCurrency(sessionTransferSales)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] text-stone-400 font-bold uppercase">Crédito</span>
                              <span className="text-[11px] font-bold text-stone-700">{formatCurrency(sessionCreditSales)}</span>
                            </div>
                          </div>
                          <div className="pt-1.5 mt-1.5 border-t border-stone-100 flex justify-between items-center">
                            <span className="text-[9px] font-black text-stone-800 uppercase">Total Ventas Brutas:</span>
                            <span className="text-sm font-black text-stone-900">{formatCurrency(sessionCashSales + sessionCardSales + sessionTransferSales + sessionCreditSales)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-amber-50/50 border border-amber-100 p-2.5 rounded-xl flex gap-2">
                        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={13} />
                        <p className="text-[9px] text-amber-800 leading-relaxed italic">
                          <span className="font-extrabold">Nota del Sistema:</span> Además, durante este turno se registraron <span className="font-bold">{formatCurrency(sessionCardSales)} en Tarjeta</span>, <span className="font-bold">{formatCurrency(sessionTransferSales)} por Transferencia</span> y <span className="font-bold">{formatCurrency(sessionCreditSales)} en Crédito</span>. Estos montos están en sistema pero <span className="font-bold">no afectan el efectivo esperado en el cajón físico</span> para evitar descuadres falsos.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Denominations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Billetes */}
                <div className="space-y-3 bg-stone-50/50 p-4 rounded-2xl border border-stone-200/50">
                  <h4 className="text-[11px] font-black text-stone-500 uppercase tracking-widest border-b border-stone-200/60 pb-2 flex items-center gap-2">
                    <span>💵</span> Billetes
                  </h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                    {DENOMINATIONS.filter(d => d.type === 'bill').map(d => (
                      <div key={d.id} className="flex items-center justify-between gap-1 p-2 bg-white rounded-xl border border-stone-100 shadow-sm animate-in fade-in duration-100">
                        <div className="min-w-[100px]">
                          <p className="text-xs font-bold text-stone-700">{d.label}</p>
                          <p className="text-[9px] text-stone-400 font-bold mt-0.5">{formatCurrency(d.val)} u.</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setAuditCounts(prev => ({ ...prev, [d.id]: Math.max(0, (prev[d.id] || 0) - 1) }))}
                            className="w-7 h-7 bg-stone-50 hover:bg-stone-100 text-stone-500 rounded-lg flex items-center justify-center font-bold text-sm cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={auditCounts[d.id] || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setAuditCounts(prev => ({ ...prev, [d.id]: isNaN(val) || val < 0 ? 0 : val }));
                            }}
                            className="w-10 h-7 text-center text-xs font-bold border border-stone-200 rounded-lg outline-none bg-stone-50/50"
                          />
                          <button
                            type="button"
                            onClick={() => setAuditCounts(prev => ({ ...prev, [d.id]: (prev[d.id] || 0) + 1 }))}
                            className="w-7 h-7 bg-stone-50 hover:bg-stone-100 text-stone-500 rounded-lg flex items-center justify-center font-bold text-sm cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        <div className="w-20 text-right font-mono text-xs font-bold text-stone-800">
                          {formatCurrency((auditCounts[d.id] || 0) * d.val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Monedas */}
                <div className="space-y-3 bg-stone-50/50 p-4 rounded-2xl border border-stone-200/50">
                  <h4 className="text-[11px] font-black text-stone-500 uppercase tracking-widest border-b border-stone-200/60 pb-2 flex items-center gap-2">
                    <span>🪙</span> Monedas
                  </h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                    {DENOMINATIONS.filter(d => d.type === 'coin').map(d => (
                       <div key={d.id} className="flex items-center justify-between gap-1 p-2 bg-white rounded-xl border border-stone-100 shadow-sm animate-in fade-in duration-100">
                        <div className="min-w-[100px]">
                          <p className="text-xs font-bold text-stone-700">{d.label}</p>
                          <p className="text-[9px] text-stone-400 font-bold mt-0.5">{formatCurrency(d.val)} u.</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setAuditCounts(prev => ({ ...prev, [d.id]: Math.max(0, (prev[d.id] || 0) - 1) }))}
                            className="w-7 h-7 bg-stone-50 hover:bg-stone-100 text-stone-500 rounded-lg flex items-center justify-center font-bold text-sm cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={auditCounts[d.id] || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setAuditCounts(prev => ({ ...prev, [d.id]: isNaN(val) || val < 0 ? 0 : val }));
                            }}
                            className="w-10 h-7 text-center text-xs font-bold border border-stone-200 rounded-lg outline-none bg-stone-50/50"
                          />
                          <button
                            type="button"
                            onClick={() => setAuditCounts(prev => ({ ...prev, [d.id]: (prev[d.id] || 0) + 1 }))}
                            className="w-7 h-7 bg-stone-50 hover:bg-stone-100 text-stone-500 rounded-lg flex items-center justify-center font-bold text-sm cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        <div className="w-20 text-right font-mono text-xs font-bold text-stone-800">
                          {formatCurrency((auditCounts[d.id] || 0) * d.val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Notas / Observaciones de Auditómanas</label>
                <textarea
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  className="w-full px-5 py-3 text-xs font-medium bg-stone-50 rounded-2xl border border-stone-200 focus:border-purple-500 focus:ring-0 outline-none min-h-[60px] max-h-[100px] no-scrollbar"
                  placeholder="Ej: Se dejó cambio para mañana, se detectó descuadre menor por bolsas de hielo, etc."
                />
              </div>

              {/* Calculations comparison */}
              <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200/60 shadow-sm space-y-4">
                <div className="flex flex-col items-center justify-center text-center pb-2">
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Ecuación de Diferencia</p>
                  <p className="text-[11px] font-bold text-stone-600 bg-white px-3 py-1 rounded-full border border-stone-200 shadow-sm">
                    Diferencia = <span className="text-purple-700">Físico</span> - <span className="text-stone-800">Esperado</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-white rounded-xl border border-stone-150/65 shadow-inner">
                    <p className="text-[9px] text-stone-400 font-extrabold uppercase tracking-wider leading-none">Contado (Físico)</p>
                    <p className="text-xl font-serif font-black text-purple-700 mt-1">
                      {formatCurrency(calculatePhysicalTotal(auditCounts))}
                    </p>
                    <p className="text-[8px] text-stone-400 mt-1 italic">(Dinero real en cajón)</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-stone-150/65 shadow-inner">
                    <p className="text-[9px] text-stone-400 font-extrabold uppercase tracking-wider leading-none">Esperado (Sistema)</p>
                    <p className="text-xl font-serif font-black text-stone-750 mt-1">
                      {auditType === 'opening' 
                        ? formatCurrency(lastClosingAudit ? lastClosingAudit.totalPhysical : 0) 
                        : formatCurrency(totalCash)}
                    </p>
                    <p className="text-[8px] text-stone-400 mt-1 italic">
                      {auditType === 'opening' ? "(Cierre anterior)" : "(Inicio + Ventas - Gastos)"}
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-stone-150/65 shadow-inner flex flex-col justify-center items-center">
                    <p className="text-[9px] text-stone-400 font-extrabold uppercase tracking-wider leading-none">Diferencia</p>
                    {(() => {
                      const expected = auditType === 'opening' 
                        ? (lastClosingAudit ? lastClosingAudit.totalPhysical : 0) 
                        : totalCash;
                      const diff = calculatePhysicalTotal(auditCounts) - expected;
                      if (Math.abs(diff) < 0.01) {
                        return (
                          <span className="inline-flex items-center px-4 py-1.5 rounded-xl text-[10px] font-black bg-green-100 text-green-700 uppercase tracking-widest leading-none mt-1 shadow-sm border border-green-200">
                            Cuadrado ✓
                          </span>
                        );
                      } else if (diff < 0) {
                        return (
                          <span className="inline-flex flex-col items-center px-1.5 py-1.5 rounded-xl bg-red-50 border border-red-200 mt-1 shadow-sm w-full">
                            <span className="text-[9px] font-black text-red-700 uppercase tracking-widest">Faltante</span>
                            <span className="text-lg font-black text-red-600 leading-none mt-0.5">{formatCurrency(Math.abs(diff))}</span>
                          </span>
                        );
                      } else {
                        return (
                          <span className="inline-flex flex-col items-center px-1.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 mt-1 shadow-sm w-full">
                            <span className="text-[9px] font-black text-blue-700 uppercase tracking-widest">Sobrante</span>
                            <span className="text-lg font-black text-blue-600 leading-none mt-0.5">+{formatCurrency(diff)}</span>
                          </span>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-6 pt-0 border-t border-stone-100 bg-stone-50/50 shrink-0 flex gap-3">
              <Button 
                variant="ghost" 
                className="flex-1 h-12 rounded-xl text-stone-500 font-bold hover:bg-stone-100/60" 
                onClick={() => {
                  setShowAuditModal(false);
                  setEditingAuditId(null);
                  setShowAdjustmentHelper(false);
                  setCustomAdjustmentRaw('');
                  setAuditCounts({
                    "1000": 0, "500": 0, "200": 0, "100": 0, "50": 0, "20_bill": 0, "20_coin": 0, "10": 0, "5": 0, "2": 0, "1": 0, "0.5": 0
                  });
                }}
              >
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 h-12 text-xs font-black rounded-xl bg-purple-700 hover:bg-purple-800 shadow-lg shadow-purple-650/20 tracking-widest uppercase cursor-pointer" 
                onClick={handleSaveAudit}
              >
                Guardar Arqueo {auditType === 'opening' ? '🌅' : auditType === 'closing' ? '🌌' : '⚡'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Audit History Modal (Historial de Arqueos) */}
      {showAuditHistory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl rounded-[2rem] shadow-2xl bg-white overflow-hidden max-h-[85vh] flex flex-col">
            <CardHeader className="bg-stone-850 text-white p-6 shrink-0 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-xl font-serif flex items-center gap-2">
                  <ClipboardCheck className="text-mex-gold" size={22} />
                  Historial de Arqueos
                </h3>
                <p className="text-[10px] text-stone-300 font-bold uppercase tracking-widest">
                  Registro de auditorías físicas y conciliaciones
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAuditHistory(false);
                  setSelectedHistoricalAudit(null);
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </CardHeader>

            <CardContent className="p-6 overflow-y-auto space-y-4 flex-1 no-scrollbar">
              {cashAudits.length === 0 ? (
                <div className="text-center py-12 text-stone-400">
                  <Calculator size={48} className="mx-auto text-stone-300 mb-3 animate-bounce" />
                  <p className="font-bold text-sm">Sin Arqueos Registrados</p>
                  <p className="text-xs text-stone-450 mt-1">Realiza tu primer arqueo físico para comenzar a ver el historial.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cashAudits.map((audit) => {
                    const isSelected = selectedHistoricalAudit?.id === audit.id;
                    const diff = audit.difference || 0;
                    
                    return (
                      <div 
                        key={audit.id} 
                        className={cn(
                          "rounded-2xl border transition-all p-4.5 flex flex-col gap-3.5 relative overflow-hidden",
                          audit.cancelled 
                            ? "border-red-150 bg-red-50/10 opacity-75 shadow-none" 
                            : isSelected 
                              ? "border-purple-400 bg-purple-50/20 shadow-md" 
                              : "border-stone-150 bg-stone-50/40 hover:bg-stone-50"
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-lg shadow-sm font-bold",
                              audit.cancelled ? "bg-red-50 text-red-500 border border-red-150" :
                              audit.type === 'opening' ? "bg-green-50 text-mex-green border border-green-100" : 
                              audit.type === 'closing' ? "bg-amber-50 text-mex-brown border border-amber-100" :
                              "bg-purple-50 text-purple-600 border border-purple-100"
                            )}>
                              {audit.cancelled ? "❌" : audit.type === 'opening' ? "🌅" : audit.type === 'closing' ? "🌌" : "⚡"}
                            </div>
                            <div>
                              <p className="text-sm sm:text-base font-black text-stone-900 flex items-center gap-1.5 leading-tight">
                                <span>
                                  {audit.type === 'opening' ? "Apertura" : audit.type === 'closing' ? "Cierre de Caja" : "Control"}
                                </span>
                                <span className="text-[11px] sm:text-xs text-stone-500 font-bold">&#8226; {audit.userName}</span>
                              </p>
                              <p className="text-[11px] sm:text-xs text-stone-450 font-bold mt-1.5 font-mono">
                                {new Date(audit.timestamp).toLocaleString('es-MX')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3.5 sm:text-right shrink-0">
                            <div>
                              <p className="text-[10px] sm:text-xs text-stone-400 font-extrabold uppercase leading-none">Monto Físico</p>
                              <p className="text-base sm:text-lg font-black text-purple-700 font-serif leading-none mt-1">
                                {formatCurrency(audit.totalPhysical)}
                              </p>
                            </div>

                            <div className="sm:w-28 text-right shrink-0">
                              <p className="text-[10px] sm:text-xs text-stone-400 font-extrabold uppercase tracking-wider">Diferencia</p>
                              <div className="mt-1">
                                {audit.cancelled ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200 uppercase tracking-widest leading-none">
                                    CANCELADO
                                  </span>
                                ) : audit.type === 'opening' ? (
                                  (() => {
                                    let opDiff = audit.openingDifference;
                                    let hasStoredDiff = opDiff !== undefined;
                                    let prevCloseVal = audit.previousClosingAmount;

                                    if (!hasStoredDiff) {
                                      const opTime = new Date(audit.timestamp).getTime();
                                      const prevCloseAudit = cashAudits.find(a => a.type === 'closing' && new Date(a.timestamp).getTime() < opTime);
                                      if (prevCloseAudit) {
                                        opDiff = audit.totalPhysical - prevCloseAudit.totalPhysical;
                                        prevCloseVal = prevCloseAudit.totalPhysical;
                                        hasStoredDiff = true;
                                      }
                                    }

                                    const isBalanced = !hasStoredDiff || Math.abs(opDiff) < 0.01;
                                    const isShortage = hasStoredDiff && opDiff < 0;

                                    return (
                                      <div className="flex flex-col items-end gap-0.5">
                                        <span className={cn(
                                          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black border uppercase tracking-widest leading-none",
                                          isBalanced 
                                            ? "bg-green-100 text-green-750 border-green-200" 
                                            : isShortage 
                                              ? "bg-red-50 text-red-700 border-red-200" 
                                              : "bg-blue-50 text-blue-700 border-blue-200"
                                        )}>
                                          {isBalanced ? "APERTURA OK ✓" : isShortage ? "FALTANTE INICIO" : "SOBRANTE INICIO"}
                                        </span>
                                        {hasStoredDiff && prevCloseVal !== null && prevCloseVal !== undefined && (
                                          <span className="text-[9px] text-stone-450 font-bold">
                                            Base: {formatCurrency(prevCloseVal)} 
                                            {Math.abs(opDiff) >= 0.01 && ` (Diferencia: ${opDiff > 0 ? '+' : ''}${formatCurrency(opDiff)})`}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()
                                ) : Math.abs(diff) < 0.01 ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-green-100 text-green-700 border border-green-200 uppercase tracking-widest leading-none">
                                    EFECTIVO OK
                                  </span>
                                ) : diff < 0 ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200 uppercase tracking-widest leading-none">
                                    {formatCurrency(diff)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-widest leading-none">
                                    +{formatCurrency(diff)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {audit.notes && (
                          <div className="bg-white p-3 rounded-xl border border-stone-150 text-[11px] sm:text-xs text-stone-600 font-semibold italic">
                            <span className="font-extrabold text-stone-400 uppercase tracking-wider text-[10px] mr-1 block sm:inline">Notas:</span>
                            "{audit.notes}"
                          </div>
                        )}

                        {audit.cancelled && (
                          <div className="bg-red-50/60 p-3 rounded-xl border border-red-200 text-[11px] sm:text-xs text-red-700 font-semibold italic">
                            <span className="font-extrabold text-red-500 uppercase tracking-wider text-[10px] mr-1 block sm:inline">MOTIVO DE CANCELACIÓN:</span>
                            "{audit.cancelReason || 'Sin motivo especificado'}"
                            {audit.cancelledAt && (
                              <span className="block text-[9px] text-stone-450 font-medium not-italic mt-1">
                                Cancelado por {audit.cancelledBy || 'Usuario'} el {new Date(audit.cancelledAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}

                        {audit.type === 'closing' && (
                          <div className="bg-stone-50 border border-stone-200/50 p-3 rounded-xl grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] sm:text-xs font-semibold text-stone-600">
                            <div>
                              <span className="text-[8px] text-stone-400 font-extrabold uppercase block leading-none">Total Ingresado (Suma):</span>
                              <span className="text-stone-800 font-black block mt-0.5">
                                {formatCurrency(audit.totalIncomeEntered !== undefined ? audit.totalIncomeEntered : (audit.totalSystem || 0))}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8px] text-stone-400 font-extrabold uppercase block leading-none">Dinero en Caja (Esperado):</span>
                              <span className="text-stone-800 font-black block mt-0.5">
                                {formatCurrency(audit.cashInRegisterExpected !== undefined ? audit.cashInRegisterExpected : (audit.totalSystem || 0))}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8px] text-stone-400 font-extrabold uppercase block leading-none">Apertura (Ingresado):</span>
                              <span className="text-mex-green font-bold block mt-0.5">
                                +{formatCurrency(audit.cashOpeningIngress !== undefined ? audit.cashOpeningIngress : 0)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8px] text-stone-400 font-extrabold uppercase block leading-none">Gastos (Egresado):</span>
                              <span className="text-red-500 font-bold block mt-0.5">
                                -{formatCurrency(audit.cashExpensesEgress !== undefined ? audit.cashExpensesEgress : 0)}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center bg-white/40 px-2 py-1.5 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setSelectedHistoricalAudit(isSelected ? null : audit)}
                            className="text-[11px] sm:text-xs font-black uppercase text-purple-700 cursor-pointer hover:underline"
                          >
                            {isSelected ? "Ocultar Desglose ▲" : "Ver Desglose de Monedas/Billetes ▼"}
                          </button>
                          <div className="flex items-center gap-1">
                             {!audit.cancelled && (
                               <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 font-bold" onClick={() => handleDeleteAudit(audit.id)}>
                                 <Trash2 size={15} />
                               </Button>
                             )}
                          </div>
                        </div>

                        {isSelected && audit.counts && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-white rounded-2xl p-4.5 border border-stone-200 text-[11px] sm:text-xs font-bold animate-in slide-in-from-top-1 shadow-inner">
                            {Object.entries(audit.counts)
                              .filter(([_, q]) => (q as number) > 0)
                              .map(([id, q]) => {
                                const d = DENOMINATIONS.find(item => item.id === id);
                                if (!d) return null;
                                return (
                                  <div key={id} className="p-2 bg-stone-50 border border-stone-100 rounded-lg flex flex-col justify-center">
                                    <span className="text-stone-400 leading-none mb-1 text-[10px] sm:text-[11px] font-black uppercase">{d.label}</span>
                                    <span className="text-stone-800 text-xs sm:text-sm font-black font-mono">
                                      {q as number} pzs = {formatCurrency((q as number) * d.val)}
                                    </span>
                                  </div>
                                );
                              })}
                            {Object.values(audit.counts).filter(q => (q as number) > 0).length === 0 && (
                              <p className="col-span-full text-center text-stone-400 font-medium italic text-xs">Sin billetes ni monedas registrados</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>

            <CardFooter className="p-6 pt-0 border-t border-stone-100 bg-stone-50 shrink-0">
              <Button 
                variant="primary" 
                className="w-full h-12 text-xs font-black rounded-xl bg-stone-800 hover:bg-stone-900 tracking-widest uppercase cursor-pointer" 
                onClick={() => {
                  setShowAuditHistory(false);
                  setSelectedHistoricalAudit(null);
                }}
              >
                Cerrar Historial
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
      {showLoanModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md rounded-[2.5rem] shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-amber-600 text-white p-6 shrink-0 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-xl font-serif flex items-center gap-2">
                  <Plus className="text-amber-200" size={22} />
                  Nuevo Préstamo de Propina
                </h3>
                <p className="text-[10px] text-amber-100 font-bold uppercase tracking-widest">
                  Registra salida de dinero de la caja de propinas
                </p>
              </div>
              <button 
                onClick={() => setShowLoanModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Importe del Préstamo</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-5 py-4 bg-stone-50 border-none rounded-2xl font-black text-2xl focus:ring-2 focus:ring-amber-500/20 outline-none placeholder:text-stone-300"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Quién recibe el dinero</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="text"
                    value={loanBorrower}
                    onChange={(e) => setLoanBorrower(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full pl-11 pr-5 py-3.5 bg-stone-50 border-none rounded-2xl font-bold text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Motivo del Préstamo</label>
                <textarea
                  value={loanReason}
                  onChange={(e) => setLoanReason(e.target.value)}
                  placeholder="Ej: Adelanto de sueldo, cambio para propinas, etc."
                  className="w-full px-5 py-3.5 bg-stone-50 border-none rounded-2xl font-bold text-sm focus:ring-2 focus:ring-amber-500/20 outline-none min-h-[100px] resize-none"
                />
              </div>
            </CardContent>

            <CardFooter className="p-6 pt-0 flex gap-3">
              <Button 
                variant="ghost" 
                className="flex-1 h-12 rounded-2xl text-stone-500 font-bold hover:bg-stone-100" 
                onClick={() => setShowLoanModal(false)}
                disabled={isSubmittingLoan}
              >
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-[2] h-12 text-xs font-black rounded-2xl bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20 tracking-widest uppercase disabled:opacity-50" 
                onClick={handleAddTipLoan}
                disabled={isSubmittingLoan || !loanAmount || !loanReason}
              >
                {isSubmittingLoan ? 'REGISTRANDO...' : 'CONFIRMAR PRÉSTAMO'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Printable Report View (renders only under print media query) */}
      {printReportData && createPortal(
        <div id="print-report" className="print-only" style={{ fontFamily: 'monospace', fontSize: '12px', padding: '15px', color: '#000', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 5px 0' }}>LAS CAZUELAS DEL CASTOR</h2>
            <h3 style={{ fontSize: '14px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>REPORTE GENERAL DE FLUJO DE CAJA</h3>
            <p style={{ margin: '2px 0', fontSize: '11px' }}>Período: <strong>{printReportData.periodLabel}</strong></p>
            <p style={{ margin: '2px 0', fontSize: '10px' }}>Fecha de Emisión: {new Date(printReportData.timestamp).toLocaleString('es-MX')}</p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ borderBottom: '1px solid #ccc', paddingBottom: '3px', margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>1. RESUMEN FINANCIERO</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '11px' }}>
              <span>Ventas Totales:</span>
              <span style={{ fontWeight: 'bold' }}>{formatCurrency(printReportData.totalSales)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '11px' }}>
              <span>Total de Gastos/Egresos:</span>
              <span style={{ fontWeight: 'bold', color: '#ff0000' }}>-{formatCurrency(printReportData.totalExpenses)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', borderTop: '1px double #000', paddingTop: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              <span>Flujo Neto Restante:</span>
              <span>{formatCurrency(printReportData.totalSales - printReportData.totalExpenses)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '11px' }}>
              <span>Transacciones Totales:</span>
              <span>{printReportData.totalTransactions}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '11px' }}>
              <span>Ticket Promedio:</span>
              <span>{formatCurrency(printReportData.averageTicket)}</span>
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ borderBottom: '1px solid #ccc', paddingBottom: '3px', margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>1.B CONCILIACIÓN DE CAJA</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '11px' }}>
              <span>Efectivo en Caja Total:</span>
              <span style={{ fontWeight: 'bold' }}>{formatCurrency(printReportData.totalCashInDrawer)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '11px' }}>
              <span>Tarjetas Total:</span>
              <span style={{ fontWeight: 'bold' }}>{formatCurrency(printReportData.totalCard)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '11px' }}>
              <span>Transferencias Total:</span>
              <span style={{ fontWeight: 'bold' }}>{formatCurrency(printReportData.totalTransfer)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '11px' }}>
              <span>Recuperación de Créditos:</span>
              <span style={{ fontWeight: 'bold' }}>{formatCurrency(printReportData.totalCreditRecovery)}</span>
            </div>
          </div>

          {printReportData.paymentMethodPieData && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ borderBottom: '1px solid #ccc', paddingBottom: '3px', margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>2. VENTAS POR MÉTODO DE PAGO</h4>
              {printReportData.paymentMethodPieData.map((item: any) => (
                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '11px' }}>
                  <span>{item.name}:</span>
                  <span style={{ fontWeight: 'bold' }}>{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ borderBottom: '1px solid #ccc', paddingBottom: '3px', margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>3. HISTORIAL DE AGREGADOS (DÍAS CON REPORTE)</h4>
            <div style={{ fontSize: '11px', marginTop: '5px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000', fontSize: '10px' }}>
                    <th style={{ padding: '4px 0' }}>Período / Día</th>
                    <th style={{ padding: '4px 0', textAlign: 'right' }}>Ventas</th>
                    <th style={{ padding: '4px 0', textAlign: 'right' }}>Gastos</th>
                    <th style={{ padding: '4px 0', textAlign: 'right' }}>Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedHistory.daily.slice(0, 15).map((row: any) => (
                    <tr key={row.period} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '4px 0' }}>{row.period}</td>
                      <td style={{ padding: '4px 0', textAlign: 'right' }}>{formatCurrency(row.sales)}</td>
                      <td style={{ padding: '4px 0', textAlign: 'right' }}>{formatCurrency(row.expenses)}</td>
                      <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(row.net)}</td>
                    </tr>
                  ))}
                  {aggregatedHistory.daily.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '10px 0', textAlign: 'center', color: '#777' }}>Sin historiales agregados</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {printReportData.topProducts && printReportData.topProducts.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ borderBottom: '1px solid #ccc', paddingBottom: '3px', margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>4. PRODUCTOS DESTACADOS</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000', fontSize: '10px' }}>
                    <th style={{ padding: '4px 0' }}>Producto</th>
                    <th style={{ padding: '4px 0', textAlign: 'center' }}>Cant.</th>
                    <th style={{ padding: '4px 0', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {printReportData.topProducts.slice(0, 8).map((p: any) => (
                    <tr key={p.name} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '4px 0' }}>{p.name}</td>
                      <td style={{ padding: '4px 0', textAlign: 'center' }}>{p.quantity}</td>
                      <td style={{ padding: '4px 0', textAlign: 'right' }}>{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(printReportData.period === 'today' || printReportData.period === 'yesterday') && printReportData.filteredLogs && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ borderBottom: '1px solid #ccc', paddingBottom: '3px', margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>5. DESGLOSE DE VENTAS DEL PERÍODO</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000', fontSize: '10px' }}>
                    <th style={{ padding: '4px 0' }}>Hora</th>
                    <th style={{ padding: '4px 0' }}>Detalle</th>
                    <th style={{ padding: '4px 0', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {printReportData.filteredLogs
                    .filter((log: any) => log.type === 'income' && !log.cancelled)
                    .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    .map((log: any) => (
                      <tr key={log.id || Math.random().toString()} style={{ borderBottom: '1px dashed #eee' }}>
                        <td style={{ padding: '4px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                          {new Date(log.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '4px 0', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 'bold' }}>{log.amount > 0 ? "Venta" : "Registro"}</div>
                          <div style={{ fontSize: '9px', color: '#555', marginTop: '1px' }}>{log.reason}</div>
                          {log.itemsSummary && log.itemsSummary.length > 0 && (
                            <ul style={{ margin: '2px 0 0 10px', padding: 0, fontSize: '9px', color: '#444' }}>
                              {log.itemsSummary.map((item: any, idx: number) => (
                                <li key={idx} style={{ listStyleType: 'circle' }}>
                                  {item.quantity}x {item.name}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td style={{ padding: '4px 0', textAlign: 'right', verticalAlign: 'top', fontWeight: 'bold' }}>
                          {formatCurrency(log.amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div style={{ paddingTop: '8px', borderTop: '1px solid #000', textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>
                Total de Órdenes: {printReportData.filteredLogs.filter((log: any) => log.type === 'income' && !log.cancelled).length}
              </div>
            </div>
          )}

          <div style={{ borderTop: '2px solid #000', paddingTop: '10px', textAlign: 'center', fontSize: '10px', color: '#555', marginTop: '30px' }}>
            <p>Reporte Oficial de Caja - Las Cazuelas del Castor</p>
            <p>Fin del Reporte</p>
          </div>
        </div>,
        document.body
      )}

      {/* Visual Report Preview Modal (On-screen interface) */}
      {printReportData && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[250] p-4 backdrop-blur-sm no-print overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-stone-100 max-w-2xl w-full rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-stone-200">
            {/* Header / Actions bar */}
            <div className="bg-white border-b border-stone-200 px-6 py-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-serif text-stone-800 flex items-center gap-2">
                  <Printer className="text-mex-brown" size={20} />
                  Vista Previa de Reporte
                </h3>
                <p className="text-xs text-stone-500">Período: <strong className="text-mex-brown">{printReportData.periodLabel}</strong></p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  className="bg-mex-green hover:bg-mex-green/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm"
                  onClick={() => window.print()}
                >
                  <Printer size={15} />
                  Imprimir / PDF Nativo
                </Button>
                
                <Button
                  variant="outline"
                  className="bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 border border-stone-200 shadow-sm"
                  onClick={() => generatePdf('print-report', `Reporte_${printReportData.period}_${new Date().getTime()}.pdf`)}
                >
                  <DownloadCloud size={15} className="text-mex-gold" />
                  Descargar PDF
                </Button>

                <Button
                  variant="ghost"
                  className="bg-stone-150 hover:bg-stone-200 text-stone-600 font-bold text-xs p-2 rounded-full cursor-pointer"
                  onClick={() => setPrintReportData(null)}
                >
                  <X size={15} />
                </Button>
              </div>
            </div>

            {/* Simulated Paper Draft Container */}
            <div className="p-6 overflow-y-auto flex-1 flex justify-center bg-stone-200/50">
              <div className="bg-white shadow-lg border border-stone-300 p-8 w-full max-w-lg rounded-2xl min-h-[500px]" style={{ fontFamily: 'monospace', fontSize: '12px', color: '#000' }}>
                
                {/* Simulated receipt design */}
                <div className="text-center pb-4 mb-4 border-b-2 border-stone-800 space-y-1">
                  <h2 className="text-base font-black tracking-tight text-stone-900">LAS CAZUELAS DEL CASTOR</h2>
                  <h3 className="text-xs font-bold text-stone-600 uppercase">REPORTE GENERAL DE FLUJO DE CAJA</h3>
                  <p className="text-[11px] text-stone-500">Período: <strong>{printReportData.periodLabel}</strong></p>
                  <p className="text-[10px] text-stone-400">Fecha de Emisión: {new Date(printReportData.timestamp).toLocaleString('es-MX')}</p>
                </div>

                {/* Resumen Financiero */}
                <div className="mb-6 space-y-2">
                  <h4 className="border-b border-stone-300 pb-1 text-xs font-bold text-stone-700">1. RESUMEN FINANCIERO</h4>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-stone-600">Ventas Totales:</span>
                    <span className="font-bold text-stone-900">{formatCurrency(printReportData.totalSales)}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-stone-600">Total de Gastos/Egresos:</span>
                    <span className="font-bold text-red-600">-{formatCurrency(printReportData.totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1 border-t border-dashed border-stone-300 font-bold text-stone-900">
                    <span>Flujo Neto Restante:</span>
                    <span>{formatCurrency(printReportData.totalSales - printReportData.totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-stone-500 pt-1">
                    <span>Transacciones Totales:</span>
                    <span>{printReportData.totalTransactions}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-stone-500">
                    <span>Ticket Promedio:</span>
                    <span>{formatCurrency(printReportData.averageTicket)}</span>
                  </div>
                </div>

                {/* Conciliación de Caja */}
                <div className="mb-6 space-y-2">
                  <h4 className="border-b border-stone-300 pb-1 text-xs font-bold text-stone-700">1.B CONCILIACIÓN DE CAJA</h4>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-stone-600">Efectivo en Caja Total:</span>
                    <span className="font-bold text-stone-900">{formatCurrency(printReportData.totalCashInDrawer)}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-stone-600">Tarjetas Total:</span>
                    <span className="font-bold text-stone-900">{formatCurrency(printReportData.totalCard)}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-stone-600">Transferencias Total:</span>
                    <span className="font-bold text-stone-900">{formatCurrency(printReportData.totalTransfer)}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-stone-600">Recuperación de Créditos:</span>
                    <span className="font-bold text-stone-900">{formatCurrency(printReportData.totalCreditRecovery)}</span>
                  </div>
                </div>

                {/* Métodos de Pago */}
                {printReportData.paymentMethodPieData && (
                  <div className="mb-6 space-y-2">
                    <h4 className="border-b border-stone-300 pb-1 text-xs font-bold text-stone-700">2. VENTAS POR MÉTODO DE PAGO</h4>
                    {printReportData.paymentMethodPieData.map((item: any) => (
                      <div key={item.name} className="flex justify-between text-xs py-0.5">
                        <span className="text-stone-600">{item.name}:</span>
                        <span className="font-bold text-stone-900">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Historial de Agregados */}
                <div className="mb-6 space-y-2">
                  <h4 className="border-b border-stone-300 pb-1 text-xs font-bold text-stone-700 font-bold">3. HISTORIAL DE AGREGADOS</h4>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-400 text-[10px] text-stone-500">
                        <th className="py-1">Período / Día</th>
                        <th className="py-1 text-right">Ventas</th>
                        <th className="py-1 text-right">Gastos</th>
                        <th className="py-1 text-right">Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {aggregatedHistory.daily.slice(0, 5).map((row: any) => (
                        <tr key={row.period} className="text-[11px]">
                          <td className="py-1 text-stone-700">{row.period}</td>
                          <td className="py-1 text-right font-medium text-stone-900">{formatCurrency(row.sales)}</td>
                          <td className="py-1 text-right text-red-650">{formatCurrency(row.expenses)}</td>
                          <td className="py-1 text-right font-bold text-stone-900">{formatCurrency(row.net)}</td>
                        </tr>
                      ))}
                      {aggregatedHistory.daily.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-2 text-center text-stone-400">Sin historiales agregados</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Productos Destacados */}
                {printReportData.topProducts && printReportData.topProducts.length > 0 && (
                  <div className="mb-6 space-y-2">
                    <h4 className="border-b border-stone-300 pb-1 text-xs font-bold text-stone-700">4. PRODUCTOS DESTACADOS</h4>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-stone-400 text-[10px] text-stone-500">
                          <th className="py-1">Producto</th>
                          <th className="py-1 text-center font-bold">Cant.</th>
                          <th className="py-1 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {printReportData.topProducts.slice(0, 6).map((p: any) => (
                          <tr key={p.name} className="text-[11px]">
                            <td className="py-1 text-stone-700">{p.name}</td>
                            <td className="py-1 text-center text-stone-600">{p.quantity}</td>
                            <td className="py-1 text-right font-bold text-stone-900">{formatCurrency(p.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Desglose de Ventas del Día */}
                {printReportData.filteredLogs && (
                  <div className="mb-6 space-y-2">
                    <h4 className="border-b border-stone-300 pb-1 text-xs font-bold text-stone-700">5. DESGLOSE DE VENTAS</h4>
                    <div className="max-h-[255px] overflow-y-auto pr-1">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-stone-400 text-[10px] text-stone-500">
                            <th className="py-1">Hora</th>
                            <th className="py-1">Detalle</th>
                            <th className="py-1 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {printReportData.filteredLogs
                            .filter((log: any) => log.type === 'income' && !log.cancelled)
                            .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                            .map((log: any) => (
                              <tr key={log.id || Math.random().toString()} className="text-[11px]">
                                <td className="py-1 text-stone-500" style={{ verticalAlign: 'top' }}>
                                  {new Date(log.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-1" style={{ verticalAlign: 'top' }}>
                                  <div className="font-bold text-stone-800">{log.amount > 0 ? "Venta" : "Registro"}</div>
                                  <div className="text-[10px] text-stone-500 whitespace-pre-wrap">{log.reason}</div>
                                  {log.itemsSummary && log.itemsSummary.length > 0 && (
                                    <ul className="mt-1 pl-4 list-disc text-[10px] text-stone-600">
                                      {log.itemsSummary.map((item: any, idx: number) => (
                                        <li key={idx} className="list-disc leading-tight">
                                          {item.quantity}x {item.name}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </td>
                                <td className="py-1 text-right font-bold text-stone-900" style={{ verticalAlign: 'top' }}>
                                  {formatCurrency(log.amount)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="pt-2 border-t border-stone-300 text-right font-bold text-xs text-stone-900">
                      Total de Órdenes: {printReportData.filteredLogs.filter((log: any) => log.type === 'income' && !log.cancelled).length}
                    </div>
                  </div>
                )}

                <div className="text-center pt-6 mt-6 border-t-2 border-stone-800 text-[10px] text-stone-500">
                  <p>Reporte Oficial de Caja - Las Cazuelas del Castor</p>
                  <p>Fin del Reporte</p>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-stone-200 px-6 py-4 shrink-0 flex justify-end gap-2 text-xs">
              <Button
                variant="outline"
                className="font-bold text-stone-600 hover:bg-stone-50 border-stone-200 cursor-pointer"
                onClick={() => setPrintReportData(null)}
              >
                Cerrar Reporte
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual de Operación Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-4xl rounded-[2rem] shadow-2xl bg-white overflow-hidden max-h-[85vh] flex flex-col">
            <CardHeader className="bg-stone-850 text-white p-6 shrink-0 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-xl font-serif flex items-center gap-2">
                  <BookOpen className="text-mex-gold" size={22} />
                  Manual de Operación de Caja
                </h3>
                <p className="text-[10px] text-stone-300 font-bold uppercase tracking-widest">
                  Guía completa de opciones, totales y flujos del sistema
                </p>
              </div>
              <button 
                onClick={() => setShowManualModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </CardHeader>

            <CardContent className="p-6 overflow-y-auto space-y-4 flex-1 no-scrollbar bg-stone-50">
              <div className="flex justify-end mb-2 shrink-0">
                <Button
                  variant="primary"
                  className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs gap-2 shadow-md cursor-pointer h-10 px-4"
                  onClick={() => generatePdf("manual-pdf-content", "Manual_de_Operacion_Caja.pdf")}
                >
                  <DownloadCloud size={16} />
                  Descargar Manual PDF
                </Button>
              </div>

              {/* Printable container */}
              <div id="manual-pdf-content" className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm text-stone-850 space-y-6 font-sans">
                {/* PDF Header */}
                <div className="border-b-2 border-stone-850 pb-4 flex justify-between items-end">
                  <div>
                    <h1 className="text-2xl font-serif font-black text-stone-900 tracking-tight">LAS CAZUELAS</h1>
                    <p className="text-xs text-stone-500 font-bold uppercase tracking-widest mt-0.5">MANUAL DE OPERACIÓN Y ARQUEOS</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-stone-400 font-bold font-mono">Control y Conciliación Financiera</p>
                    <p className="text-[9px] text-purple-700 font-extrabold uppercase tracking-wider mt-0.5">Versión Oficial 2026.1</p>
                  </div>
                </div>

                {/* Content Sections */}
                <div className="space-y-6 text-xs md:text-sm leading-relaxed text-stone-800">
                  <section className="space-y-2">
                    <h2 className="text-sm font-black text-stone-950 pb-1 border-b border-stone-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="text-purple-700">1.</span> INTRODUCCIÓN AL CONTROL DE CAJA
                    </h2>
                    <p className="text-stone-650">
                      Este manual estandariza la administración del dinero en efectivo y medios de pago alternativos en el punto de venta de <strong>Las Cazuelas</strong>. Un control minucioso garantiza la transparencia en la recaudación diaria, reduce el riesgo de faltantes y facilita la conciliación de cada jornada de manera automática.
                    </p>
                  </section>

                  <section className="space-y-3">
                    <h2 className="text-sm font-black text-stone-950 pb-1 border-b border-stone-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="text-purple-700">2.</span> TOTALES DEL SISTEMA Y FLUJO COMERCIAL
                    </h2>
                    <p className="text-stone-650">
                      El panel de control muestra diversas opciones en el totalizador para reflejar con precisión el estado financiero de la jornada activa:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="p-4 rounded-xl bg-stone-50 border border-stone-150">
                        <h3 className="font-bold text-xs text-stone-900 uppercase tracking-wide">Total del Dinero que Ingresó</h3>
                        <p className="text-xs text-stone-600 mt-1">
                          Suma de todas las ventas del día independientemente del método de pago (Efectivo, Tarjeta, Transferencia) y cobros de adeudos recibidos. Muestra el volumen general comercial.
                        </p>
                        <div className="mt-2 text-[10px] font-mono font-bold bg-white p-2 rounded border border-stone-200/80">
                          Fórmula: (Ventas Efectivo + Tarjeta + Transf) + Cobros de Créditos
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100">
                        <h3 className="font-bold text-xs text-purple-900 uppercase tracking-wide">Efectivo Esperado en Caja (Sistema)</h3>
                        <p className="text-xs text-stone-600 mt-1">
                          Representa la cantidad exacta de dinero líquido en billetes y monedas que <strong>debe estar físicamente presente en la gaveta</strong>.
                        </p>
                        <div className="mt-2 text-[10px] font-mono font-bold bg-white p-2 rounded border border-purple-200/80">
                          Fórmula: Fondo Inicial + Ventas Efectivo + Cobros Crédito - Gastos/Egresos
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h2 className="text-sm font-black text-stone-950 pb-1 border-b border-stone-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="text-purple-700">3.</span> MÉTODOS DE PAGO Y DESGLOSE DE CAJA
                    </h2>
                    <ul className="list-disc pl-5 space-y-1 text-stone-650">
                      <li><strong>Efectivo (Cash):</strong> Dinero físico inmediato. Afecta directamente al Efectivo Esperado en Caja y se cuenta físicamente en el arqueo.</li>
                      <li><strong>Tarjeta de Crédito / Débito (Card):</strong> Transacciones procesadas vía terminal. El sistema aplica una comisión de operación (4%). No se cuenta físicamente en el arqueo de efectivo pero sí suma al Flujo de Ingreso Total.</li>
                      <li><strong>Transferencia SPEI (Transfer):</strong> Pagos directos a la cuenta bancaria. Los movimientos se asocian con comprobantes adjuntos y no aumentan el efectivo de la gaveta.</li>
                      <li><strong>Ventas a Crédito:</strong> Consumo asignado a la cuenta pendiente del cliente. Se registra como venta comercial pero no genera ingresos de efectivo hasta que el cliente realice su cobro de adeudo.</li>
                    </ul>
                  </section>

                  <div style={{ pageBreakAfter: 'always' }} />

                  <section className="space-y-3 pt-4">
                    <h2 className="text-sm font-black text-stone-950 pb-1 border-b border-stone-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="text-purple-700">4.</span> PROCEDIMIENTO DE ARQUEO FÍSICO
                    </h2>
                    <p className="text-stone-650">
                      El Arqueo de Caja debe realizarse de forma obligatoria al inicio del turno (Apertura) y al final de la jornada (Cierre). Opcionalmente se pueden hacer Arqueos Parciales de Control.
                    </p>
                    <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200/60 space-y-1">
                      <p className="font-bold text-amber-900 uppercase text-[10px] tracking-wider">Guía de Operación Paso a Paso:</p>
                      <ol className="list-decimal pl-4 space-y-1 mt-1 text-stone-700">
                        <li>Haga clic en el botón <strong>"Arqueo"</strong> en la barra superior.</li>
                        <li>Seleccione el tipo de arqueo correspondiente (<em>Apertura, Parcial o Cierre</em>).</li>
                        <li>Cuente físicamente los billetes y monedas por denominación y capture las piezas exactas.</li>
                        <li>Verifique el <strong>Total Físico Contado</strong> en tiempo real en la calculadora de arqueo.</li>
                        <li>Añada comentarios de control en el campo de observaciones (ej. detalles de gastos o retiros de efectivo).</li>
                        <li>Presione <strong>"Guardar Arqueo"</strong> para registrar en la base de datos de manera permanente.</li>
                      </ol>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h2 className="text-sm font-black text-stone-950 pb-1 border-b border-stone-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="text-purple-700">5.</span> ANÁLISIS DE DIFERENCIAS Y CONCILIACIÓN
                    </h2>
                    <p className="text-stone-650">
                      Al guardar un arqueo, el sistema compara el dinero físico real contra el cálculo teórico de transacciones:
                    </p>
                    <div className="border border-stone-200 rounded-xl overflow-hidden mt-1">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-stone-100 font-bold border-b border-stone-200 text-stone-700">
                            <th className="p-2 text-left">Estado</th>
                            <th className="p-2 text-left">Condición</th>
                            <th className="p-2 text-left">Causas Comunes</th>
                            <th className="p-2 text-left">Acción Sugerida</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 text-stone-600">
                          <tr>
                            <td className="p-2 font-bold text-green-700">Arqueo OK</td>
                            <td className="p-2">Diferencia = $0.00</td>
                            <td className="p-2">El efectivo en caja coincide perfectamente con las ventas.</td>
                            <td className="p-2">No se requiere acción. Registrar cierre.</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold text-red-600">Faltante</td>
                            <td className="p-2">Diferencia &lt; $0.00</td>
                            <td className="p-2">Cambio mal entregado, retiros sin registrar, ventas omitidas.</td>
                            <td className="p-2">Revisar historial de ventas y capturas de gastos.</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold text-blue-600">Sobrante</td>
                            <td className="p-2">Diferencia &gt; $0.00</td>
                            <td className="p-2">Cobro de más a clientes, propinas mezcladas, fondo inicial erróneo.</td>
                            <td className="p-2">Revisar fondo inicial o registrar el dinero sobrante como ajuste.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h2 className="text-sm font-black text-stone-950 pb-1 border-b border-stone-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="text-purple-700">6.</span> REGISTRO DE GASTOS Y MOVIMIENTOS
                    </h2>
                    <p className="text-stone-650">
                      Cualquier retiro o salida de efectivo para gastos operativos, compras directas o pago a proveedores debe capturarse en tiempo real a través del botón <strong>"Movimiento"</strong>. Al registrar el egreso, el monto se resta automáticamente del "Efectivo Esperado en Caja", manteniendo el arqueo perfectamente sincronizado y evitando diferencias al momento del cierre.
                    </p>
                  </section>
                </div>

                {/* Footer of PDF page */}
                <div className="pt-6 mt-8 border-t border-stone-200 text-center text-[10px] text-stone-400 font-bold">
                  <p>Las Cazuelas - Sistema de Auditoría y Control de Puntos de Venta</p>
                  <p className="mt-1">© 2026 Todos los derechos reservados. Confidencial - Uso Interno.</p>
                </div>
              </div>
            </CardContent>

            <CardFooter className="bg-stone-150 px-6 py-4 shrink-0 flex justify-end gap-2 text-xs">
              <Button
                variant="outline"
                className="font-bold text-stone-600 hover:bg-stone-50 border-stone-200 cursor-pointer"
                onClick={() => setShowManualModal(false)}
              >
                Cerrar Manual
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
