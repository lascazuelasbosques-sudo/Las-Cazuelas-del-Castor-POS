/**
 * Curated preset gallery of authentic Mexican street food images
 * sourced from high-quality royalty-free photo repositories.
 */
export const PRESET_FOOD_GALLERY = [
  {
    label: "Pozole Rojo 🥣",
    url: "https://images.unsplash.com/photo-1625938146369-adc83368bda7?auto=format&fit=crop&w=600&q=80",
    keywords: ["pozole", "pancita", "caldo", "sopa", "consome"]
  },
  {
    label: "Pancita de Res 🍲",
    url: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80",
    keywords: ["pancita", "menudo", "caldo", "mondongo"]
  },
  {
    label: "Tostadas Crujientes 🌮",
    url: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80",
    keywords: ["tostada", "tostadas", "guisado"]
  },
  {
    label: "Quesadillas Doraditas 🌮",
    url: "https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?auto=format&fit=crop&w=600&q=80",
    keywords: ["quesadilla", "quesadillas", "quesillo"]
  },
  {
    label: "Huarache Tradicional 🫓",
    url: "https://images.unsplash.com/photo-1615870216519-2f9fa575fa5c?auto=format&fit=crop&w=600&q=80",
    keywords: ["huarache", "sope", "sopes", "sencillo"]
  },
  {
    label: "Huarache Especial 🥩",
    url: "https://images.unsplash.com/photo-1562059390-a761a0847685?auto=format&fit=crop&w=600&q=80",
    keywords: ["huarache (bistec", "bistec", "longaniza", "pollo"]
  },
  {
    label: "Flautas Crujientes 🥢",
    url: "https://images.unsplash.com/photo-1568106690101-fd6822e876f6?auto=format&fit=crop&w=600&q=80",
    keywords: ["flauta", "flautas", "dorados"]
  },
  {
    label: "Tacos de Carne 🌮",
    url: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=600&q=80",
    keywords: ["taco", "tacos", "guisado"]
  },
  {
    label: "Gorditas Rellenas 🫓",
    url: "https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=600&q=80",
    keywords: ["gordita", "gorditas", "requeson", "chicharron"]
  },
  {
    label: "Chilaquiles con Crema 🍛",
    url: "https://images.unsplash.com/photo-1600331735139-4aa79919f993?auto=format&fit=crop&w=600&q=80",
    keywords: ["chilaquiles", "totopos", "salsa"]
  },
  {
    label: "Pambazo Tradicional 🍔",
    url: "https://images.unsplash.com/photo-1536184071535-79166ae8fa12?auto=format&fit=crop&w=600&q=80",
    keywords: ["pambazo", "pambazos", "chorizo"]
  },
  {
    label: "Agua Fresca Frutal 🥤",
    url: "https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=600&q=80",
    keywords: ["agua litro", "agua medio", "fresca", "jarra", "bebida"]
  },
  {
    label: "Refresco de Botella 🥤",
    url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80",
    keywords: ["refresco", "refrescos", "coca", "boing", "soda"]
  },
  {
    label: "Enchiladas Verdes 🍛",
    url: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80",
    keywords: ["enchilada", "enchiladas", "suizas", "enmoladas"]
  },
  {
    label: "Burrito Relleno 🌯",
    url: "https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=600&q=80",
    keywords: ["burrito", "burritos", "wrap"]
  },
  {
    label: "Café de Olla Caliente ☕",
    url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
    keywords: ["café", "cafe", "olla", "nescafe"]
  },
  {
    label: "Crema y Acompañamientos 🍯",
    url: "https://images.unsplash.com/photo-1528750951167-a0e240c1f4fc?auto=format&fit=crop&w=600&q=80",
    keywords: ["crema", "salsa", "limon", "cebolla", "extra"]
  },
  {
    label: "Queso Oaxaca Extra 🧀",
    url: "https://images.unsplash.com/photo-1528750951167-a0e240c1f4fc?auto=format&fit=crop&w=600&q=80",
    keywords: ["queso oaxaca", "quesillo", "hebra"]
  }
];

/**
 * Automatically maps a product name to the most representative preset image.
 * Uses keyword matching for maximum accuracy.
 */
export const getFallbackProductImage = (productName: string): string => {
  if (!productName) return PRESET_FOOD_GALLERY[2].url; // Default to tostadas/Mexican food icon
  
  const nameLower = productName.toLowerCase();
  
  // Try to find a preset with matching keywords
  for (const preset of PRESET_FOOD_GALLERY) {
    if (preset.keywords.some(keyword => nameLower.includes(keyword))) {
      return preset.url;
    }
  }
  
  // Broad category fallbacks if no specific keyword matches
  if (nameLower.includes("taco") || nameLower.includes("tostada")) {
    return PRESET_FOOD_GALLERY[7].url; // Tacos
  }
  if (nameLower.includes("gordita") || nameLower.includes("sope") || nameLower.includes("huarache")) {
    return PRESET_FOOD_GALLERY[4].url; // Huarache
  }
  if (nameLower.includes("agua") || nameLower.includes("jugo") || nameLower.includes("bebida") || nameLower.includes("refresco")) {
    return PRESET_FOOD_GALLERY[11].url; // Agua Fresca
  }
  if (nameLower.includes("caldo") || nameLower.includes("sopa") || nameLower.includes("pozole")) {
    return PRESET_FOOD_GALLERY[0].url; // Pozole
  }
  
  // General Mexican street food fallback
  return "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80";
};
