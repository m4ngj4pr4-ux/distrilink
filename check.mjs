import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

// Load env
const env = fs.readFileSync('.env.local', 'utf-8').split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/\r/g, '');
});

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function dump() {
  console.log("=== PRODUCTS ===");
  const products = await getDocs(collection(db, "products"));
  let djamruId = null;
  for (const p of products.docs) {
    if (p.data().name && p.data().name.includes("DJAMRU")) {
      console.log("PRODUCT:", p.id, p.data().name, "totalPacks:", p.data().totalPacks);
      djamruId = p.id;
    }
  }

  console.log("\n=== PURCHASES ===");
  const pos = await getDocs(collection(db, "purchases"));
  for (const po of pos.docs) {
    const data = po.data();
    if (data.productId === djamruId) {
      console.log("PO:", po.id, data.createdAt?.toDate(), "jumlahKarton:", data.jumlahKarton, "totalPack:", data.totalPack, "conversion:", data.conversion);
    }
  }

  console.log("\n=== DISTRIBUTIONS ===");
  const dists = await getDocs(collection(db, "distributions"));
  let totalDist = 0;
  for (const d of dists.docs) {
    const data = d.data();
    if (data.productId === djamruId) {
      totalDist += data.totalPacksDistributed || 0;
      console.log("DIST:", d.id, data.createdAt?.toDate(), "qty:", data.qtyOriginal, data.unit, "-> totalPacks:", data.totalPacksDistributed);
    }
  }
  console.log("Total Distributed DJAMRU:", totalDist);

  console.log("\n=== INVENTORY LOGS ===");
  const logs = await getDocs(collection(db, "inventory_logs"));
  for (const l of logs.docs) {
    const data = l.data();
    if (data.productId === djamruId) {
      console.log("LOG:", l.id, data.type, "delta:", data.deltaPacks, "note:", data.note, data.timestamp?.toDate());
    }
  }
}

dump().then(() => process.exit(0)).catch(console.error);
