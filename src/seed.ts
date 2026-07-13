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
      // FRENTE (printOrder 1 to 18)
      { name: 'Pozole Rojo (Maciza o Surtida)', description: 'Tradicional caldo de maíz cacahuazintle con carne de cerdo.', price: 95, categoryId: catRefs['Especialidades'], stock: 50, available: true, printOrder: 1 },
      { name: 'Pancita', description: 'Delicioso caldo de res condimentado con chiles secos y especias.', price: 95, categoryId: catRefs['Especialidades'], stock: 30, available: true, printOrder: 2 },
      { name: 'Tostadas Guisado', description: 'Tostada crujiente con frijoles, guisado, lechuga, crema y queso.', price: 40, categoryId: catRefs['Tacos y Tostadas'], stock: 80, available: true, printOrder: 3 },
      { name: 'Quesadillas (Pollo, Chicharrón, Tingas, Champiñones, Bistec, Papas c/ Longaniza, Queso)', description: 'Tortilla de maíz doblada con queso fundido y guisado o ingrediente a elegir.', price: 40, categoryId: catRefs['Huaraches y Quesadillas'], stock: 100, available: true, printOrder: 4, allowsExtraCheese: true },
      { name: 'Huarache Sencillo', description: 'Base de maíz alargada con frijoles, salsa, cebolla y queso.', price: 45, categoryId: catRefs['Huaraches y Quesadillas'], stock: 50, available: true, printOrder: 5 },
      { name: 'Huarache (Quesillo o Huevo)', description: 'Huarache preparado con quesillo fundido o huevo al gusto.', price: 60, categoryId: catRefs['Huaraches y Quesadillas'], stock: 40, available: true, printOrder: 6 },
      { name: 'Huarache (Bistec, Longaniza, Pollo, Tinga)', description: 'Huarache con carne a elegir.', price: 70, categoryId: catRefs['Huaraches y Quesadillas'], stock: 40, available: true, printOrder: 7 },
      { name: 'Flautas (Pollo o Res)', description: 'Tortillas enrolladas y fritas rellenas de pollo o res, servidas con guarnición.', price: 60, categoryId: catRefs['Antojitos'], stock: 50, available: true, printOrder: 8 },
      { name: 'Tacos (Bistec, Longaniza, Pollo)', description: 'Tacos de carne asada o guisada servidos con cebolla y cilantro.', price: 35, categoryId: catRefs['Tacos y Tostadas'], stock: 100, available: true, printOrder: 9 },
      { name: 'Gorditas', description: 'Masa de maíz rellena de chicharrón prensado o requesón.', price: 40, categoryId: catRefs['Antojitos'], stock: 60, available: true, printOrder: 10 },
      { name: 'Gorditas (C/B)', description: 'Masa de maíz rellena de chicharrón prensado, con bistec.', price: 50, categoryId: catRefs['Antojitos'], stock: 60, available: true, printOrder: 11 },
      { name: 'Chilaquiles (Bistec, Pollo o Huevo)', description: 'Totopos bañados en salsa con crema, queso y proteína (Pollo o Huevo).', price: 65, categoryId: catRefs['Antojitos'], stock: 40, available: true, printOrder: 12 },
      { name: 'Chilaquiles (C/B)', description: 'Totopos bañados en salsa con crema, queso y bistec.', price: 70, categoryId: catRefs['Antojitos'], stock: 40, available: true, printOrder: 13 },
      { name: 'Pambazo', description: 'Pan bañado en salsa de chile guajillo, relleno de papa con chorizo.', price: 40, categoryId: catRefs['Antojitos'], stock: 30, available: true, printOrder: 14 },
      { name: 'Pambazo (C/B)', description: 'Pan bañado en salsa de chile guajillo, relleno de papa con chorizo y bistec.', price: 50, categoryId: catRefs['Antojitos'], stock: 30, available: true, printOrder: 15 },
      { name: 'Agua Litro', description: 'Agua fresca de fruta natural del día.', price: 40, categoryId: catRefs['Bebidas'], stock: 50, available: true, printOrder: 16 },
      { name: 'Agua Medio Litro', description: 'Agua fresca de fruta natural del día.', price: 20, categoryId: catRefs['Bebidas'], stock: 50, available: true, printOrder: 17 },
      { name: 'Refrescos', description: 'Variedad de refrescos embotellados.', price: 24, categoryId: catRefs['Bebidas'], stock: 100, available: true, printOrder: 18 },

      // ATRAS (printOrder 19+)
      { name: 'Enchiladas', description: 'Tortillas rellenas de pollo bañadas en salsa verde o roja, con crema y queso.', price: 70, categoryId: catRefs['Antojitos'], stock: 40, available: true, printOrder: 19 },
      { name: 'Enchiladas (C/B)', description: 'Tortillas rellenas de pollo bañadas en salsa verde o roja con bistec.', price: 75, categoryId: catRefs['Antojitos'], stock: 40, available: true, printOrder: 20 },
      { name: 'Enmoladas', description: 'Tortillas rellenas de pollo bañadas en mole poblano artesanal.', price: 90, categoryId: catRefs['Antojitos'], stock: 30, available: true, printOrder: 21 },
      { name: 'Burritos', description: 'Tortilla de harina grande rellena de guisado a elegir, frijoles y queso.', price: 75, categoryId: catRefs['Antojitos'], stock: 40, available: true, printOrder: 22 },
      { name: 'Tacos de Guisado', description: 'Tortilla de maíz con el guisado del día.', price: 29, categoryId: catRefs['Tacos y Tostadas'], stock: 100, available: true, printOrder: 23 },
      { name: 'Orden de Crema', description: 'Porción extra de crema espesa.', price: 15, categoryId: catRefs['Extras'], stock: 100, available: true, printOrder: 24 },
      { name: 'Orden Extra de Tostadas o Tortillas (5 Pzas)', description: '5 piezas de tostadas o tortillas calientes.', price: 15, categoryId: catRefs['Extras'], stock: 100, available: true, printOrder: 25 },
      { name: 'Café de Olla o Agua para Nescafé', description: 'Café tradicional o agua caliente.', price: 20, categoryId: catRefs['Bebidas'], stock: 40, available: true, printOrder: 26 },
      { name: 'Queso Oaxaca para cualquier alimento', description: 'Porción extra de queso.', price: 8, categoryId: catRefs['Extras'], stock: 100, available: true, printOrder: 27 },
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

    // Seed initial Kitchen (Cocina) User if not exists
    const kitchenSnap = await getDocs(query(collection(db, "users"), where("username", "==", "cocina"), limit(1)));
    if (kitchenSnap.empty) {
      await addDoc(collection(db, "users"), {
        name: "Cocina Principal",
        username: "cocina",
        password: "cocina",
        role: "kitchen",
        active: true,
        createdAt: new Date().toISOString()
      });
      console.log("Initial kitchen user created");
    }

    // Seed initial Parrilla (Grill) User if not exists
    const parrillaSnap = await getDocs(query(collection(db, "users"), where("username", "==", "parrilla"), limit(1)));
    if (parrillaSnap.empty) {
      await addDoc(collection(db, "users"), {
        name: "Parrilla",
        username: "parrilla",
        password: "parrilla",
        role: "parrilla",
        active: true,
        createdAt: new Date().toISOString()
      });
      console.log("Initial parrilla user created");
    }

    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
};

export const restoreDeletedProducts = async () => {
  try {
    console.log("Starting reconstruction of deleted standard products...");
    const catSnap = await getDocs(collection(db, "categories"));
    const prodSnap = await getDocs(collection(db, "products"));

    const existingCats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    const existingProds = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const defaultCategories = [
      { name: 'Especialidades', order: 1 },
      { name: 'Antojitos', order: 2 },
      { name: 'Huaraches y Quesadillas', order: 3 },
      { name: 'Tacos y Tostadas', order: 4 },
      { name: 'Bebidas', order: 5 },
      { name: 'Extras', order: 6 },
    ];

    const catRefs: { [key: string]: string } = {};

    for (const dCat of defaultCategories) {
      const match = existingCats.find(c => c.name.toLowerCase() === dCat.name.toLowerCase());
      if (match) {
        catRefs[dCat.name] = match.id;
      } else {
        const docRef = await addDoc(collection(db, "categories"), dCat);
        catRefs[dCat.name] = docRef.id;
        console.log(`Created missing category: ${dCat.name}`);
      }
    }

    const defaultProducts = [
      // FRENTE (printOrder 1 to 18)
      { name: 'Pozole Rojo (Maciza o Surtida)', description: 'Tradicional caldo de maíz cacahuazintle con carne de cerdo.', price: 95, categoryName: 'Especialidades', stock: 50, available: true, printOrder: 1 },
      { name: 'Pancita', description: 'Delicioso caldo de res condimentado con chiles secos y especias.', price: 95, categoryName: 'Especialidades', stock: 30, available: true, printOrder: 2 },
      { name: 'Tostadas Guisado', description: 'Tostada crujiente con frijoles, guisado, lechuga, crema y queso.', price: 40, categoryName: 'Tacos y Tostadas', stock: 80, available: true, printOrder: 3 },
      { name: 'Quesadillas (Pollo, Chicharrón, Tingas, Champiñones, Bistec, Papas c/ Longaniza, Queso)', description: 'Tortilla de maíz doblada con queso fundido y guisado o ingrediente a elegir.', price: 40, categoryName: 'Huaraches y Quesadillas', stock: 100, available: true, printOrder: 4, allowsExtraCheese: true },
      { name: 'Huarache Sencillo', description: 'Base de maíz alargada con frijoles, salsa, cebolla y queso.', price: 45, categoryName: 'Huaraches y Quesadillas', stock: 50, available: true, printOrder: 5 },
      { name: 'Huarache (Quesillo o Huevo)', description: 'Huarache preparado con quesillo fundido o huevo al gusto.', price: 60, categoryName: 'Huaraches y Quesadillas', stock: 40, available: true, printOrder: 6 },
      { name: 'Huarache (Bistec, Longaniza, Pollo, Tinga)', description: 'Huarache con carne a elegir.', price: 70, categoryName: 'Huaraches y Quesadillas', stock: 40, available: true, printOrder: 7 },
      { name: 'Flautas (Pollo o Res)', description: 'Tortillas enrolladas y fritas rellenas de pollo o res, servidas con guarnición.', price: 60, categoryName: 'Antojitos', stock: 50, available: true, printOrder: 8 },
      { name: 'Tacos (Bistec, Longaniza, Pollo)', description: 'Tacos de carne asada o guisada servidos con cebolla y cilantro.', price: 35, categoryName: 'Tacos y Tostadas', stock: 100, available: true, printOrder: 9 },
      { name: 'Gorditas', description: 'Masa de maíz rellena de chicharrón prensado o requesón.', price: 40, categoryName: 'Antojitos', stock: 60, available: true, printOrder: 10 },
      { name: 'Gorditas (C/B)', description: 'Masa de maíz rellena de chicharrón prensado, con bistec.', price: 50, categoryName: 'Antojitos', stock: 60, available: true, printOrder: 11 },
      { name: 'Chilaquiles (Bistec, Pollo o Huevo)', description: 'Totopos bañados en salsa con crema, queso y proteína (Pollo o Huevo).', price: 65, categoryName: 'Antojitos', stock: 40, available: true, printOrder: 12 },
      { name: 'Chilaquiles (C/B)', description: 'Totopos bañados en salsa con crema, queso y bistec.', price: 70, categoryName: 'Antojitos', stock: 40, available: true, printOrder: 13 },
      { name: 'Pambazo', description: 'Pan bañado en salsa de chile guajillo, relleno de papa con chorizo.', price: 40, categoryName: 'Antojitos', stock: 30, available: true, printOrder: 14 },
      { name: 'Pambazo (C/B)', description: 'Pan bañado en salsa de chile guajillo, relleno de papa con chorizo y bistec.', price: 50, categoryName: 'Antojitos', stock: 30, available: true, printOrder: 15 },
      { name: 'Agua Litro', description: 'Agua fresca de fruta natural del día.', price: 40, categoryName: 'Bebidas', stock: 50, available: true, printOrder: 16 },
      { name: 'Agua Medio Litro', description: 'Agua fresca de fruta natural del día.', price: 20, categoryName: 'Bebidas', stock: 50, available: true, printOrder: 17 },
      { name: 'Refrescos', description: 'Variedad de refrescos embotellados.', price: 24, categoryName: 'Bebidas', stock: 100, available: true, printOrder: 18 },

      // ATRAS (printOrder 19+)
      { name: 'Enchiladas', description: 'Tortillas rellenas de pollo bañadas en salsa verde o roja, con crema y queso.', price: 70, categoryName: 'Antojitos', stock: 40, available: true, printOrder: 19 },
      { name: 'Enchiladas (C/B)', description: 'Tortillas rellenas de pollo bañadas en salsa verde o roja con bistec.', price: 75, categoryName: 'Antojitos', stock: 40, available: true, printOrder: 20 },
      { name: 'Enmoladas', description: 'Tortillas rellenas de pollo bañadas en mole poblano artesanal.', price: 90, categoryName: 'Antojitos', stock: 30, available: true, printOrder: 21 },
      { name: 'Burritos', description: 'Tortilla de harina grande rellena de guisado a elegir, frijoles y queso.', price: 75, categoryName: 'Antojitos', stock: 40, available: true, printOrder: 22 },
      { name: 'Tacos de Guisado', description: 'Tortilla de maíz con el guisado del día.', price: 29, categoryName: 'Tacos y Tostadas', stock: 100, available: true, printOrder: 23 },
      { name: 'Orden de Crema', description: 'Porción extra de crema espesa.', price: 15, categoryName: 'Extras', stock: 100, available: true, printOrder: 24 },
      { name: 'Orden Extra de Tostadas o Tortillas (5 Pzas)', description: '5 piezas de tostadas o tortillas calientes.', price: 15, categoryName: 'Extras', stock: 100, available: true, printOrder: 25 },
      { name: 'Café de Olla o Agua para Nescafé', description: 'Café tradicional o agua caliente.', price: 20, categoryName: 'Bebidas', stock: 40, available: true, printOrder: 26 },
      { name: 'Queso Oaxaca para cualquier alimento', description: 'Porción extra de queso.', price: 8, categoryName: 'Extras', stock: 100, available: true, printOrder: 27 },
    ];

    let restoredCount = 0;
    for (const dProd of defaultProducts) {
      const match = existingProds.find(p => p.name.toLowerCase() === dProd.name.toLowerCase());
      if (!match) {
        const categoryId = catRefs[dProd.categoryName];
        if (categoryId) {
          const { categoryName, ...restOfProd } = dProd;
          await addDoc(collection(db, "products"), {
            ...restOfProd,
            categoryId
          });
          restoredCount++;
          console.log(`Restored missing product: ${dProd.name}`);
        }
      }
    }
    console.log(`Reconstruction complete. Restored ${restoredCount} products.`);
    return restoredCount;
  } catch (error) {
    console.error("Error restoring missing products:", error);
    throw error;
  }
};
