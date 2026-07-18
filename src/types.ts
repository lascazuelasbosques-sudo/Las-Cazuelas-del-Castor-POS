export type UserRole = 'admin' | 'waiter' | 'kitchen' | 'cashier' | 'parrilla';

export interface User {
  id: string;
  name: string;
  username?: string;
  password?: string;
  email?: string;
  role: UserRole;
  active: boolean;
  pin?: string;
  isGoogleUser?: boolean;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  stock: number;
  available: boolean;
  imageUrl?: string;
  station?: 'plancha' | 'cocina' | 'comun';
  allowsExtraCheese?: boolean;
  printOrder?: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  status?: 'pending' | 'preparing' | 'completed' | 'cancelled';
  station?: 'plancha' | 'cocina' | 'comun';
  hasExtraCheese?: boolean;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit';

export interface OrderMovementLog {
  action: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
}

export interface Order {
  id: string;
  folio?: string;
  tableNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  subtotal?: number;
  isTakeaway: boolean;
  takeawayFee: number;
  cardFee?: number;
  paymentMethod?: PaymentMethod;
  transferReceiptUrl?: string;
  clientName?: string;
  isDelivered?: boolean;
  isPaid?: boolean;
  creditStatus?: 'pending' | 'paid';
  creditPaidAt?: string;
  creditPaidMethod?: 'cash' | 'card' | 'transfer';
  createdAt: string;
  updatedAt: string;
  waiterId: string;
  waiterName: string;
  notes?: string;
  whatsAppConfirmed?: boolean;
  movementLogs?: OrderMovementLog[];
}

export type CashLogType = 'opening' | 'closing' | 'expense' | 'income';

export interface CashLog {
  id: string;
  type: CashLogType;
  amount: number;
  reason: string;
  timestamp: string;
  userId: string;
  userName: string;
  itemsSummary?: { name: string, quantity: number, price: number }[];
  cancelled?: boolean;
  cancelledAt?: string;
  cancelledBy?: string;
  orderIds?: string[];
  clientName?: string;
  isCreditSettlement?: boolean;
}

export interface TipLoan {
  id: string;
  amount: number;
  reason: string;
  borrowerName?: string;
  status: 'pending' | 'returned';
  createdAt: string;
  returnedAt?: string;
  userId: string;
  userName: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  orderCount: number;
  totalPaid: number;
}

export interface ChatChannel {
  id: string; // usually client's phone or auto-id
  clientName: string;
  clientPhone: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'open' | 'archived';
  activeOrderId?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'client' | 'staff';
  text: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  orderId?: string; // option: references order created via whatsapp
}

