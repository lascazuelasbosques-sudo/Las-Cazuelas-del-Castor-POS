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
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}
