export type UserRole = 'admin' | 'waiter' | 'kitchen' | 'cashier';

export interface User {
  id: string;
  name: string;
  username?: string;
  password?: string;
  email?: string;
  role: UserRole;
  active: boolean;
  pin?: string;
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
  station?: 'plancha' | 'cocina';
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  status?: 'pending' | 'preparing' | 'completed';
  station?: 'plancha' | 'cocina';
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';

export type PaymentMethod = 'cash' | 'card';

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
  createdAt: string;
  updatedAt: string;
  waiterId: string;
  waiterName: string;
  notes?: string;
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
}
