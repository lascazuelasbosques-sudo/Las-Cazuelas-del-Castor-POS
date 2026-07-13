import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

const configPath = "firebase-applet-config.json";
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  // Assuming firebase-applet-config.json has the default payload
  const app = initializeApp(config.firebaseConfig || config);
  const db = getFirestore(app);
  
  await setDoc(doc(db, "settings", "branding"), {
    logoUrl: "https://scontent-qro1-2.xx.fbcdn.net/v/t39.30808-6/305224800_502697315191276_5159032473398491144_n.jpg?stp=dst-jpg_tt6&cstp=mx232x228&ctp=s232x228&_nc_cat=101&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=h_3tnDcE5TkQ7kNvwHQdJKX&_nc_oc=AdpcUo5eKmY7L6lBIqN4dRkSeTC4ZqL6zln8qojBxAEPE1Yp7YYC3P6PLDcjaGyXfDw&_nc_zt=23&_nc_ht=scontent-qro1-2.xx&_nc_gid=pIUzCEuZRvXaPrucIeAw9g&_nc_ss=7b289&oh=00_Af9dc_uxwX2tvvNJ_S1d4J1TUm4iL7W-es11wfcIUEWw0g&oe=6A2A6418"
  }, { merge: true });
  console.log("Updated!");
} else {
  console.log('No conf');
}
