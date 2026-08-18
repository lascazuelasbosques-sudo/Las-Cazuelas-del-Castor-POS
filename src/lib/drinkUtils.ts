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

  // Explicit kitchen stations are NEVER drinks
  if (item.station === 'cocina' || item.station === 'plancha') return false;
  if (item.station === ('barra' as any)) return true;

  // Check product and category definitions
  if (products && products.length > 0) {
    const prod = products.find(p => p.id === ('productId' in item ? item.productId : undefined) || p.name.toLowerCase() === item.name.toLowerCase());
    if (prod) {
      if (prod.station === 'cocina' || prod.station === 'plancha') return false;
      if (prod.station === ('barra' as any)) return true;
      if (categories && categories.length > 0) {
        const cat = categories.find(c => c.id === prod.categoryId);
        if (cat) {
          const catNameLower = cat.name.toLowerCase();
          if (
            catNameLower.includes('bebida') ||
            catNameLower.includes('refresco') ||
            catNameLower.includes('cerveza') ||
            catNameLower.includes('jugo') ||
            catNameLower.includes('agua') ||
            catNameLower.includes('soda') ||
            catNameLower.includes('barra')
          ) {
            return true;
          }
        }
      }
    }
  }

  const nameLower = item.name.toLowerCase();
  
  // Desechables go directly to cashier (caja)
  if (nameLower.includes('desechable')) {
    return true;
  }

  // Exact brands and beverage patterns using strict boundaries (so "bistec", "filete", "omelette", "aguacate" don't match)
  const drinkPatterns = [
    /\b(coca[\s-]?cola|coca|pepsi|fanta|sprite|boing|sidral|squirt|manzanita|topochico|topo[\s-]chico|delaware|sangria(\s+señorial|\s+senorial)?|mirinda|7[\s-]?up|mundet|jarritos?|red[\s-]?bull|monster|electrolit|gatorade)\b/i,
    /\b(refresco|refrescos|cerveza|cervezas|licuado|licuados|frappe|frappes|smoothie|smoothies|capuchino|expresso|latte|limonada|naranjada|horchata|jamaica|tamarindo)\b/i,
    /\b(café|cafe|cafecito)\b/i,
    /\b(té|te)\s+(de\s+|helado|verde|negro|manzanilla|limon|limón|canela|hierbabuena|chai|frío|frio|caliente)\b/i,
    /\b(infusion|infusiones)\b/i,
    /\b(agua\s+(fresca|natural|mineral|de\s+sabor|embotellada|purificada|ciel|bonafont|epura|simple))\b/i,
    /\b(aguas\s+frescas|jarra\s+de\s+agua|garrafon|garrafón)\b/i,
    /\b(jugo|jugos)\s+(de\s+|natural|verde|naranja|zanahoria|toronja|antigripal|mixto)\b/i,
    /\b(jugo|jugos)\b/i
  ];

  return drinkPatterns.some(pattern => pattern.test(nameLower));
}
