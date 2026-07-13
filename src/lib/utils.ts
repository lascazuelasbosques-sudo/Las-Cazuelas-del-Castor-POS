import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function customRound(value: number): number {
  const integerPart = Math.floor(value);
  const decimalPart = value - integerPart;
  // Redondear a 2 decimales para evitar problemas de precisión flotante
  const roundedDecimal = Math.round(decimalPart * 100) / 100;
  
  if (roundedDecimal > 0.20) {
    return integerPart + 1;
  } else {
    return integerPart;
  }
}

export function formatCurrency(amount: number) {
  const value = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  // Usar toLocaleString para obtener separadores de miles adecuados en México (ej. 1,234.56)
  const formattedNumber = value.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${formattedNumber}`;
}

export function getRoleLabel(role: string): string {
  const roles: Record<string, string> = {
    admin: 'Administrador',
    waiter: 'Mesero',
    kitchen: 'Cocina',
    cashier: 'Cajero',
    parrilla: 'Parrilla'
  };
  return roles[role] || role;
}
