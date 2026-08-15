import { initializeApp } from "firebase/app";
import { getFirestore, deleteDoc, doc } from "firebase/firestore";
import dotenv from "dotenv";
import fs from "fs";

if (fs.existsSync(".env.local")) {
  const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runAudit() {
  console.log("Deleting erroneous returns...");
  
  // 1 Pk on 15 Aug
  await deleteDoc(doc(db, "returns", "lXm38icfc2sZnuwbUO8i"));
  console.log("Deleted return ID: lXm38icfc2sZnuwbUO8i (1 Pk, 15 Aug)");

  // Duplicate 51 Pk on 5 Aug
  await deleteDoc(doc(db, "returns", "uBdQVKuLlzTVkhroP0Fv"));
  console.log("Deleted duplicate return ID: uBdQVKuLlzTVkhroP0Fv (51 Pk, 5 Aug)");

  process.exit(0);
}

runAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
