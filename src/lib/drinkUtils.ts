import { OrderItem, Product, Category } from '../types';

/**
 * Helper to determine if an order item or product is a beverage/drink/refresco.
 * Drinks/refrescos go directly to charging/billing (caja/cobrar) without needing kitchen preparation.
 */
export function isDrinkItem(
  item: OrderItem | { name: string; productId?: string; categoryId?: string; station?: string },
  products?: Product[],
  categories?: Category[]
): boolean {
  if (!item || !item.name) return false;

  // Explicit station check
  if (item.station === ('barra' as any)) return true;

  // Check category if products and categories are supplied
  if (products && products.length > 0) {
    const prod = products.find(p => p.id === ('productId' in item ? item.productId : undefined) || p.name === item.name);
    if (prod) {
      if (prod.station === ('barra' as any)) return true;
      if (categories && categories.length > 0) {
        const cat = categories.find(c => c.id === prod.categoryId);
        if (cat) {
          const catNameLower = cat.name.toLowerCase();
          if (
            catNameLower.includes('bebida') ||
            catNameLower.includes('refresco') ||
            catNameLower.includes('agua') ||
            catNameLower.includes('jugo') ||
            catNameLower.includes('cerveza') ||
            catNameLower.includes('soda') ||
            catNameLower.includes('barra')
          ) {
            return true;
          }
        }
      }
    }
  }

  // Fallback keyword matching
  const nameLower = item.name.toLowerCase();
  
  // Desechables go directly to cashier (caja)
  if (nameLower.includes('desechable')) {
    return true;
  }

  const drinkKeywords = [
    "agua", "jugo", "bebida", "refresco", "café", "cafe", "coca", "soda",
    "fanta", "sprite", "boing", "cerveza", "licuado", "té", "te", "jarra",
    "fresca", "pepsi", "sidral", "squirt", "manzanita", "topochico", "topo chico",
    "agua mineral", "delaware", "sangria", "mirinda", "7up", "7-up", "mundet",
    "jarritos", "garrafon", "limonada", "naranjada", "horchata", "jamaica",
    "tamarindo", "expresso", "capuchino", "latte", "frappe", "smoothie", "smothie",
    "red bull", "monster", "electrolit", "gatorade"
  ];

  return drinkKeywords.some(keyword => nameLower.includes(keyword));
}
