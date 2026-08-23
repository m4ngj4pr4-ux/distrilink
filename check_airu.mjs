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
  const prods = await getDocs(collection(db, "products"));
  const airuProds = prods.docs.filter(d => d.data().name.toLowerCase().includes("airu")).map(d => ({id: d.id, ...d.data()}));
  
  const distSnap = await getDocs(collection(db, "distributions"));
  const distributions = distSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(d => d.productName && d.productName.toLowerCase().includes("airu"));
  
  const salesSnap = await getDocs(collection(db, "sales_transactions"));
  const sales = salesSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(d => d.productName && d.productName.toLowerCase().includes("airu"));
  
  const retSnap = await getDocs(collection(db, "returns"));
  const returns = retSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(d => d.productName && d.productName.toLowerCase().includes("airu"));

  const factRetSnap = await getDocs(collection(db, "factory_returns"));
  const factReturns = factRetSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(d => d.productName && d.productName.toLowerCase().includes("airu"));

  console.log("=== PRODUCT: " + airuProds.map(p => p.name).join(", "));
  
  const teams = {};
  const getTeam = (id, name) => {
    if (!teams[id]) teams[id] = { name, dist: 0, sold: 0, ret: 0 };
    return teams[id];
  };

  distributions.forEach(d => {
    getTeam(d.teamId, d.teamName).dist += d.totalPacksDistributed || 0;
  });
  sales.forEach(s => {
    if (s.tipe === "drop") getTeam(s.teamId, s.teamName).sold += s.jumlahDrop || 0;
  });
  returns.forEach(r => {
    getTeam(r.teamId, r.teamName).ret += r.totalPacksReturned || 0;
  });

  let totalDist = 0;
  console.log("\n--- SALES TEAMS SUMMARY ---");
  for (const tid in teams) {
    const t = teams[tid];
    const sisa = t.dist - t.sold - t.ret;
    totalDist += t.dist;
    console.log(`Team: ${t.name.padEnd(20)} | Dropped: ${t.dist} | Sold: ${t.sold} | Returned: ${t.ret} => Sisa: ${sisa} pk`);
  }

  const totalFactRet = factReturns.reduce((sum, r) => sum + (r.totalPacksReturned || 0), 0);
  console.log(`\n--- TOTALS ---`);
  console.log(`Total Dropped to Teams : ${totalDist} pk`);
  console.log(`Total Returns from Teams: ${returns.reduce((sum, r) => sum + (r.totalPacksReturned||0), 0)} pk`);
  console.log(`Total Returns to Factory: ${totalFactRet} pk (${totalFactRet/600} Ct)`);

  process.exit(0);
}
run();
