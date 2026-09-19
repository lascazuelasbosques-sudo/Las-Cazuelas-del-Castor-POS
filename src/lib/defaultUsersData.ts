import { User } from "../types";

export const DEFAULT_CACHED_USERS: User[] = [
  { 
    id: 'usr-admin', 
    name: 'Carlos Mendoza (Administrador)', 
    username: 'admin', 
    password: 'admin', 
    role: 'admin', 
    pin: '1234', 
    active: true 
  },
  { 
    id: 'usr-cocina', 
    name: 'Chef Doña Rosa (Cocina)', 
    username: 'cocina', 
    password: 'cocina', 
    role: 'kitchen', 
    pin: '1234', 
    active: true 
  },
  { 
    id: 'usr-parrilla', 
    name: 'Beto Parrillero (Parrilla/Plancha)', 
    username: 'parrilla', 
    password: 'parrilla', 
    role: 'parrilla', 
    pin: '1234', 
    active: true 
  },
  { 
    id: 'usr-caja', 
    name: 'Valeria Gómez (Caja y Cobro)', 
    username: 'caja', 
    password: 'caja', 
    role: 'cashier', 
    pin: '1234', 
    active: true 
  },
  { 
    id: 'usr-mesero', 
    name: 'Luis Hernández (Mesero)', 
    username: 'mesero', 
    password: 'mesero', 
    role: 'waiter', 
    pin: '1234', 
    active: true 
  },
  { 
    id: 'usr-abigail', 
    name: 'Antonieta Abigail Villagómez', 
    username: 'abigail', 
    password: 'abigail', 
    role: 'kitchen', 
    pin: '1234', 
    active: true 
  }
];
