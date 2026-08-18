import { Category, Product } from "../types";

export const DEFAULT_FALLBACK_CATEGORIES: Category[] = [
  { id: 'cat_especialidades', name: 'Especialidades', order: 1 },
  { id: 'cat_antojitos', name: 'Antojitos', order: 2 },
  { id: 'cat_huaraches_quesadillas', name: 'Huaraches y Quesadillas', order: 3 },
  { id: 'cat_tacos_tostadas', name: 'Tacos y Tostadas', order: 4 },
  { id: 'cat_bebidas', name: 'Bebidas', order: 5 },
  { id: 'cat_extras', name: 'Extras', order: 6 },
];

export const DEFAULT_FALLBACK_PRODUCTS: Product[] = [
  // Especialidades
  {
    id: 'prod_pozole_rojo',
    name: 'Pozole Rojo (Maciza o Surtida)',
    description: 'Tradicional caldo de maíz cacahuazintle con carne de cerdo.',
    price: 95,
    categoryId: 'cat_especialidades',
    stock: 50,
    available: true,
    station: 'cocina',
    printOrder: 1
  },
  {
    id: 'prod_pancita',
    name: 'Pancita',
    description: 'Delicioso caldo de res condimentado con chiles secos y especias.',
    price: 95,
    categoryId: 'cat_especialidades',
    stock: 30,
    available: true,
    station: 'cocina',
    printOrder: 2
  },

  // Tacos y Tostadas
  {
    id: 'prod_tostadas_guisado',
    name: 'Tostadas Guisado',
    description: 'Tostada crujiente con frijoles, guisado, lechuga, crema y queso.',
    price: 40,
    categoryId: 'cat_tacos_tostadas',
    stock: 80,
    available: true,
    station: 'cocina',
    printOrder: 3
  },
  {
    id: 'prod_tacos_carne',
    name: 'Tacos (Bistec, Longaniza, Pollo)',
    description: 'Tacos de carne asada o guisada servidos con cebolla y cilantro.',
    price: 35,
    categoryId: 'cat_tacos_tostadas',
    stock: 100,
    available: true,
    station: 'plancha',
    printOrder: 9
  },
  {
    id: 'prod_tacos_guisado',
    name: 'Tacos de Guisado',
    description: 'Tortilla de maíz con el guisado del día.',
    price: 29,
    categoryId: 'cat_tacos_tostadas',
    stock: 100,
    available: true,
    station: 'cocina',
    printOrder: 23
  },

  // Huaraches y Quesadillas
  {
    id: 'prod_quesadillas',
    name: 'Quesadillas (Pollo, Chicharrón, Tingas, Champiñones, Bistec, Papas c/ Longaniza, Queso)',
    description: 'Tortilla de maíz doblada con queso fundido y guisado o ingrediente a elegir.',
    price: 40,
    categoryId: 'cat_huaraches_quesadillas',
    stock: 100,
    available: true,
    station: 'plancha',
    allowsExtraCheese: true,
    printOrder: 4
  },
  {
    id: 'prod_huarache_sencillo',
    name: 'Huarache Sencillo',
    description: 'Base de maíz alargada con frijoles, salsa, cebolla y queso.',
    price: 45,
    categoryId: 'cat_huaraches_quesadillas',
    stock: 50,
    available: true,
    station: 'plancha',
    printOrder: 5
  },
  {
    id: 'prod_huarache_quesillo_huevo',
    name: 'Huarache (Quesillo o Huevo)',
    description: 'Huarache preparado con quesillo fundido o huevo al gusto.',
    price: 60,
    categoryId: 'cat_huaraches_quesadillas',
    stock: 40,
    available: true,
    station: 'plancha',
    printOrder: 6
  },
  {
    id: 'prod_huarache_carne',
    name: 'Huarache (Bistec, Longaniza, Pollo, Tinga)',
    description: 'Huarache con carne a elegir.',
    price: 70,
    categoryId: 'cat_huaraches_quesadillas',
    stock: 40,
    available: true,
    station: 'plancha',
    printOrder: 7
  },

  // Antojitos
  {
    id: 'prod_flautas',
    name: 'Flautas (Pollo o Res)',
    description: 'Tortillas enrolladas y fritas rellenas de pollo o res, servidas con guarnición.',
    price: 60,
    categoryId: 'cat_antojitos',
    stock: 50,
    available: true,
    station: 'cocina',
    printOrder: 8
  },
  {
    id: 'prod_gorditas',
    name: 'Gorditas',
    description: 'Masa de maíz rellena de chicharrón prensado o requesón.',
    price: 40,
    categoryId: 'cat_antojitos',
    stock: 60,
    available: true,
    station: 'plancha',
    printOrder: 10
  },
  {
    id: 'prod_gorditas_cb',
    name: 'Gorditas (C/B)',
    description: 'Masa de maíz rellena de chicharrón prensado, con bistec.',
    price: 50,
    categoryId: 'cat_antojitos',
    stock: 60,
    available: true,
    station: 'plancha',
    printOrder: 11
  },
  {
    id: 'prod_chilaquiles',
    name: 'Chilaquiles (Bistec, Pollo o Huevo)',
    description: 'Totopos bañados en salsa con crema, queso y proteína (Pollo o Huevo).',
    price: 65,
    categoryId: 'cat_antojitos',
    stock: 40,
    available: true,
    station: 'cocina',
    printOrder: 12
  },
  {
    id: 'prod_chilaquiles_cb',
    name: 'Chilaquiles (C/B)',
    description: 'Totopos bañados en salsa con crema, queso y bistec.',
    price: 70,
    categoryId: 'cat_antojitos',
    stock: 40,
    available: true,
    station: 'cocina',
    printOrder: 13
  },
  {
    id: 'prod_pambazo',
    name: 'Pambazo',
    description: 'Pan bañado en salsa de chile guajillo, relleno de papa con chorizo.',
    price: 40,
    categoryId: 'cat_antojitos',
    stock: 30,
    available: true,
    station: 'plancha',
    printOrder: 14
  },
  {
    id: 'prod_pambazo_cb',
    name: 'Pambazo (C/B)',
    description: 'Pan bañado en salsa de chile guajillo, relleno de papa con chorizo y bistec.',
    price: 50,
    categoryId: 'cat_antojitos',
    stock: 30,
    available: true,
    station: 'plancha',
    printOrder: 15
  },
  {
    id: 'prod_enchiladas',
    name: 'Enchiladas',
    description: 'Tortillas rellenas de pollo bañadas en salsa verde o roja, con crema y queso.',
    price: 70,
    categoryId: 'cat_antojitos',
    stock: 40,
    available: true,
    station: 'cocina',
    printOrder: 19
  },
  {
    id: 'prod_enchiladas_cb',
    name: 'Enchiladas (C/B)',
    description: 'Tortillas rellenas de pollo bañadas en salsa verde o roja con bistec.',
    price: 75,
    categoryId: 'cat_antojitos',
    stock: 40,
    available: true,
    station: 'cocina',
    printOrder: 20
  },
  {
    id: 'prod_enmoladas',
    name: 'Enmoladas',
    description: 'Tortillas rellenas de pollo bañadas en mole poblano artesanal.',
    price: 90,
    categoryId: 'cat_antojitos',
    stock: 30,
    available: true,
    station: 'cocina',
    printOrder: 21
  },
  {
    id: 'prod_burritos',
    name: 'Burritos',
    description: 'Tortilla de harina grande rellena de guisado a elegir, frijoles y queso.',
    price: 75,
    categoryId: 'cat_antojitos',
    stock: 40,
    available: true,
    station: 'plancha',
    printOrder: 22
  },

  // Bebidas
  {
    id: 'prod_agua_litro',
    name: 'Agua Litro',
    description: 'Agua fresca de fruta natural del día.',
    price: 40,
    categoryId: 'cat_bebidas',
    stock: 50,
    available: true,
    station: 'cocina',
    printOrder: 16
  },
  {
    id: 'prod_agua_medio_litro',
    name: 'Agua Medio Litro',
    description: 'Agua fresca de fruta natural del día.',
    price: 20,
    categoryId: 'cat_bebidas',
    stock: 50,
    available: true,
    station: 'cocina',
    printOrder: 17
  },
  {
    id: 'prod_refrescos',
    name: 'Refrescos',
    description: 'Variedad de refrescos embotellados.',
    price: 24,
    categoryId: 'cat_bebidas',
    stock: 100,
    available: true,
    station: 'cocina',
    printOrder: 18
  },
  {
    id: 'prod_cafe_de_olla',
    name: 'Café de Olla o Agua para Nescafé',
    description: 'Café tradicional o agua caliente.',
    price: 20,
    categoryId: 'cat_bebidas',
    stock: 40,
    available: true,
    station: 'cocina',
    printOrder: 26
  },

  // Extras
  {
    id: 'prod_orden_crema',
    name: 'Orden de Crema',
    description: 'Porción extra de crema espesa.',
    price: 15,
    categoryId: 'cat_extras',
    stock: 100,
    available: true,
    station: 'cocina',
    printOrder: 24
  },
  {
    id: 'prod_orden_tostadas_tortillas',
    name: 'Orden Extra de Tostadas o Tortillas (5 Pzas)',
    description: '5 piezas de tostadas o tortillas calientes.',
    price: 15,
    categoryId: 'cat_extras',
    stock: 100,
    available: true,
    station: 'cocina',
    printOrder: 25
  },
  {
    id: 'prod_queso_oaxaca',
    name: 'Queso Oaxaca para cualquier alimento',
    description: 'Porción extra de queso.',
    price: 8,
    categoryId: 'cat_extras',
    stock: 100,
    available: true,
    station: 'cocina',
    printOrder: 27
  },
  {
    id: 'prod_desechable',
    name: 'Desechable',
    description: 'Empaque desechable para llevar.',
    price: 5,
    categoryId: 'cat_extras',
    stock: 500,
    available: true,
    station: 'cocina',
    printOrder: 28
  }
];
