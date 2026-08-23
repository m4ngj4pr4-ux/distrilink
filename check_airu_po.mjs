import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import dotenv from "dotenv";
import fs from "fs";

if (fs.existsSync(".env.local")) {
  const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
  for (const k in envConfig) process.env[k] = envConfig[k];
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

async function run() {
  const poSnap = await getDocs(collection(db, "purchases"));
  const pos = poSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(d => d.productName && d.productName.toLowerCase().includes("airu"));
  
  let totalPoPacks = 0;
  console.log("--- PURCHASES (PO) ---");
  pos.forEach(p => {
    let pack = p.totalPack;
    if (!pack && p.jumlahKarton) pack = p.jumlahKarton * 600;
    totalPoPacks += pack;
    console.log(`PO ID: ${p.id} | Qty: ${p.jumlahKarton} Ct (${pack} Pk) | Date: ${new Date(p.createdAt?.seconds * 1000).toLocaleString()}`);
  });
  console.log(`Total PO Packs: ${totalPoPacks}`);

  const distSnap = await getDocs(collection(db, "distributions"));
  const dists = distSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(d => d.productName && d.productName.toLowerCase().includes("airu"));
  
  console.log("\n--- DISTRIBUTIONS ---");
  dists.sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0)).forEach(d => {
    console.log(`Dist ID: ${d.id} | Team: ${d.teamName} | Qty: ${d.totalPacksDistributed} Pk | Date: ${new Date(d.createdAt?.seconds * 1000).toLocaleString()}`);
  });

  const retSnap = await getDocs(collection(db, "returns"));
  const returns = retSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(d => d.productName && d.productName.toLowerCase().includes("airu"));
  
  console.log("\n--- RETURNS FROM SALES ---");
  returns.sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0)).forEach(r => {
    console.log(`Ret ID: ${r.id} | Team: ${r.teamName} | Qty: ${r.totalPacksReturned} Pk | Date: ${new Date(r.createdAt?.seconds * 1000).toLocaleString()}`);
  });

  process.exit(0);
}
run();
