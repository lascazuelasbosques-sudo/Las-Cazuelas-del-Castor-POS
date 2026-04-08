import { db } from "./firebase";
import { collection, addDoc, getDocs, query, limit, deleteDoc, doc, writeBatch, where } from "firebase/firestore";

export const seedDatabase = async (force = false) => {
  try {
    // Check if categories already exist
    const catSnap = await getDocs(query(collection(db, "categories"), limit(1)));
    if (!catSnap.empty && !force) {
      console.log("Database already seeded");
      return;
    }

    if (force) {
      console.log("Force seeding: clearing existing data...");
      const cats = await getDocs(collection(db, "categories"));
      const prods = await getDocs(collection(db, "products"));
      
      for (const d of cats.docs) await deleteDoc(doc(db, "categories", d.id));
      for (const d of prods.docs) await deleteDoc(doc(db, "products", d.id));
    }

    // Seed Categories
    const categories = [
      { name: 'Especialidades', order: 1 },
      { name: 'Antojitos', order: 2 },
      { name: 'Huaraches y Quesadillas', order: 3 },
      { name: 'Tacos y Tostadas', order: 4 },
      { name: 'Bebidas', order: 5 },
      { name: 'Extras', order: 6 },
    ];

    const catRefs: { [key: string]: string } = {};
    for (const cat of categories) {
      const docRef = await addDoc(collection(db, "categories"), cat);
      catRefs[cat.name] = docRef.id;
    }

    // Seed Products
    const products = [
      // Especialidades
      { name: 'Pozole Rojo', description: 'Tradicional caldo de maíz cacahuazintle con carne de cerdo (maciza o surtida).', price: 95, categoryId: catRefs['Especialidades'], stock: 50, available: true },
      { name: 'Pancita', description: 'Delicioso caldo de res condimentado con chiles secos y especias.', price: 95, categoryId: catRefs['Especialidades'], stock: 30, available: true },
      
      // Antojitos
      { name: 'Enchiladas', description: 'Tortillas rellenas de pollo bañadas en salsa verde o roja, con crema y queso.', price: 75, categoryId: catRefs['Antojitos'], stock: 40, available: true },
      { name: 'Enmoladas', description: 'Tortillas rellenas de pollo bañadas en mole poblano artesanal.', price: 90, categoryId: catRefs['Antojitos'], stock: 30, available: true },
      { name: 'Burritos', description: 'Tortilla de harina grande rellena de guisado a elegir, frijoles y queso.', price: 75, categoryId: catRefs['Antojitos'], stock: 40, available: true },
      { name: 'Flautas (Pollo o Res)', description: 'Tortillas enrolladas y fritas rellenas de pollo o res, servidas con guarnición.', price: 60, categoryId: catRefs['Antojitos'], stock: 50, available: true },
      { name: 'Gorditas', description: 'Masa de maíz rellena de chicharrón prensado, servida con cilantro y cebolla.', price: 40, categoryId: catRefs['Antojitos'], stock: 60, available: true },
      { name: 'Chilaquiles', description: 'Totopos bañados en salsa con crema, queso y proteína a elegir (Bistec, Pollo o Huevo).', price: 65, categoryId: catRefs['Antojitos'], stock: 40, available: true },
      { name: 'Pambazo', description: 'Pan bañado en salsa de chile guajillo, relleno de papa con chorizo.', price: 40, categoryId: catRefs['Antojitos'], stock: 30, available: true },

      // Huaraches y Quesadillas
      { name: 'Huarache Sencillo', description: 'Base de maíz alargada con frijoles, salsa, cebolla y queso.', price: 45, categoryId: catRefs['Huaraches y Quesadillas'], stock: 50, available: true },
      { name: 'Huarache (Quesillo o Huevo)', description: 'Huarache preparado con quesillo fundido o huevo al gusto.', price: 60, categoryId: catRefs['Huaraches y Quesadillas'], stock: 40, available: true },
      { name: 'Huarache con Carne', description: 'Huarache con Bistec, Longaniza, Pollo o Tinga.', price: 70, categoryId: catRefs['Huaraches y Quesadillas'], stock: 40, available: true },
      { name: 'Quesadillas', description: 'Tortilla de maíz doblada con queso fundido y guisado (Tinga, Res, Chicharrón, Hongos).', price: 40, categoryId: catRefs['Huaraches y Quesadillas'], stock: 100, available: true },

      // Tacos y Tostadas
      { name: 'Tacos de Guisado', description: 'Tortilla de maíz con el guisado del día preparado al estilo tradicional.', price: 28, categoryId: catRefs['Tacos y Tostadas'], stock: 100, available: true },
      { name: 'Tacos (Bistec, Longaniza, Pollo)', description: 'Tacos de carne asada o guisada servidos con cebolla y cilantro.', price: 35, categoryId: catRefs['Tacos y Tostadas'], stock: 100, available: true },
      { name: 'Tostadas Guisado', description: 'Tostada crujiente con frijoles, guisado, lechuga, crema y queso.', price: 40, categoryId: catRefs['Tacos y Tostadas'], stock: 80, available: true },

      // Bebidas
      { name: 'Agua 1 Litro', description: 'Agua fresca de fruta natural del día.', price: 40, categoryId: catRefs['Bebidas'], stock: 50, available: true },
      { name: 'Agua 1/2 Litro', description: 'Agua fresca de fruta natural del día.', price: 20, categoryId: catRefs['Bebidas'], stock: 50, available: true },
      { name: 'Refrescos', description: 'Variedad de refrescos embotellados.', price: 24, categoryId: catRefs['Bebidas'], stock: 100, available: true },
      { name: 'Café de Olla', description: 'Café tradicional preparado con canela y piloncillo.', price: 20, categoryId: catRefs['Bebidas'], stock: 40, available: true },

      // Extras
      { name: 'Orden de Crema', description: 'Porción extra de crema espesa.', price: 15, categoryId: catRefs['Extras'], stock: 100, available: true },
      { name: 'Orden de Tostadas/Tortillas', description: '5 piezas de tostadas o tortillas calientes.', price: 15, categoryId: catRefs['Extras'], stock: 100, available: true },
      { name: 'Queso Oaxaca Extra', description: 'Porción extra de queso Oaxaca para cualquier alimento.', price: 8, categoryId: catRefs['Extras'], stock: 100, available: true },
    ];

    for (const prod of products) {
      await addDoc(collection(db, "products"), prod);
    }

    // Seed initial Admin User if not exists
    const userSnap = await getDocs(query(collection(db, "users"), where("username", "==", "admin"), limit(1)));
    if (userSnap.empty) {
      await addDoc(collection(db, "users"), {
        name: "Administrador",
        username: "admin",
        password: "admin", // Default password, user should change it
        role: "admin",
        active: true,
        createdAt: new Date().toISOString()
      });
      console.log("Initial admin user created");
    }

    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
};
