import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";
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
  const batch = writeBatch(db);
  
  // 1. DELETE GHOST DROPS & RETURNS FOR AIRU
  const distSnap = await getDocs(collection(db, "distributions"));
  const returnsSnap = await getDocs(collection(db, "returns"));
  
  let delDrops = 0;
  let delRets = 0;

  distSnap.docs.forEach(d => {
    const data = d.data();
    if (data.productName && data.productName.toLowerCase().includes("airu") && data.teamName === "Tim Gabungan") {
      const qty = data.totalPacksDistributed;
      if (qty === 9000 || qty === 7800 || qty === 4200) {
        batch.delete(d.ref);
        delDrops++;
      }
    }
  });

  returnsSnap.docs.forEach(r => {
    const data = r.data();
    if (data.productName && data.productName.toLowerCase().includes("airu")) {
      const qty = data.totalPacksReturned;
      const t = data.teamName;
      // 26 May, 6 Jun
      if (t === "Tim Gabungan" && (qty === 7800 || qty === 7170 || qty === 5232)) {
        batch.delete(r.ref);
        delRets++;
      }
      // 21 Jul
      if (t === "Busu Mani" && qty === 493) { batch.delete(r.ref); delRets++; }
      if (t === "H. Amar" && qty === 224) { batch.delete(r.ref); delRets++; }
      if (t === "Opek Martapura" && qty === 390) { batch.delete(r.ref); delRets++; }
      if (t === "Ari" && qty === 90) { batch.delete(r.ref); delRets++; }
      if (t === "Pak Amat" && qty === 130) { batch.delete(r.ref); delRets++; }
      if (t === "Sofyan" && qty === 44) { batch.delete(r.ref); delRets++; }
      if (t === "Rahmat (Amat)" && qty === 51) { batch.delete(r.ref); delRets++; } // Just in case there's another one
    }
  });

  console.log(`Will delete ${delDrops} ghost drops and ${delRets} ghost returns.`);
  await batch.commit();
  console.log("Deleted ghost data.");

  // 2. RECALCULATE EVERY PRODUCT'S TOTALPACKS & ADMINDISTRIBUTEDPACKS
  const allPos = (await getDocs(collection(db, "purchases"))).docs.map(d=>d.data());
  const allDists = (await getDocs(collection(db, "distributions"))).docs.map(d=>d.data());
  const allReturns = (await getDocs(collection(db, "returns"))).docs.map(d=>d.data());
  const allFactReturns = (await getDocs(collection(db, "factory_returns"))).docs.map(d=>d.data());

  const prodsSnap = await getDocs(collection(db, "products"));
  const prods = prodsSnap.docs;

  const b2 = writeBatch(db);
  for (const p of prods) {
    const pid = p.id;
    
    let totalIn = 0;
    allPos.filter(x => x.productId === pid).forEach(x => {
      let pack = x.totalPack;
      if (!pack && x.jumlahKarton) pack = x.jumlahKarton * (x.packsPerSlop||10) * (x.slopsPerBall||10) * (x.ballsPerKarton||6);
      if (!pack && x.jumlahKarton) pack = x.jumlahKarton * 600; // fallback
      totalIn += (pack || 0);
    });

    let totalOut = 0;
    allDists.filter(x => x.productId === pid).forEach(x => {
      totalOut += (x.totalPacksDistributed || 0);
    });

    let totalRet = 0;
    allReturns.filter(x => x.productId === pid).forEach(x => {
      totalRet += (x.totalPacksReturned || 0);
    });

    let totalFactRet = 0;
    allFactReturns.filter(x => x.productId === pid).forEach(x => {
      totalFactRet += (x.totalPacksReturned || 0);
    });

    const realTotalPacks = totalIn - totalOut + totalRet - totalFactRet;
    const realAdminDistributedPacks = totalOut - totalRet;
    
    b2.update(p.ref, {
      totalPacks: Math.max(0, realTotalPacks),
      adminDistributedPacks: Math.max(0, realAdminDistributedPacks)
    });
  }
  await b2.commit();
  console.log("Recalculated products.");

  // 3. RECALCULATE EVERY TEAM'S GOODSDROPPED
  const teamsSnap = await getDocs(collection(db, "sales_ledger"));
  const allTransfers = (await getDocs(collection(db, "stock_transfers"))).docs.map(d=>d.data());
  const b3 = writeBatch(db);

  for (const t of teamsSnap.docs) {
    const tid = t.id;
    let debt = 0;

    // Debt from drops
    allDists.filter(x => x.teamId === tid || x.distributedByCaptainId === tid).forEach(x => {
      debt += (x.totalPacksDistributed || 0) * (x.pricePerPack || 0);
    });

    // Subtracted by returns
    allReturns.filter(x => x.teamId === tid).forEach(x => {
      debt -= (x.returnAmount || 0);
    });

    // Transfers
    allTransfers.filter(x => x.toTeamId === tid).forEach(x => {
      debt += (x.totalAmount || 0);
    });
    allTransfers.filter(x => x.fromTeamId === tid).forEach(x => {
      debt -= (x.totalAmount || 0);
    });

    b3.update(t.ref, {
      goodsDropped: Math.max(0, debt)
    });
  }
  await b3.commit();
  console.log("Recalculated sales teams.");

  // 4. RECALCULATE SUMMARY SALESRECEIVABLES
  const teamsFinal = await getDocs(collection(db, "sales_ledger"));
  let totalSalesReceivables = 0;
  teamsFinal.docs.forEach(t => {
    const d = t.data();
    totalSalesReceivables += Math.max(0, (d.goodsDropped || 0) - (d.totalDeposited || 0));
  });

  const sumRef = doc(db, "summary", "dashboard");
  const b4 = writeBatch(db);
  b4.update(sumRef, { salesReceivables: totalSalesReceivables });
  await b4.commit();
  console.log("Recalculated summary.");

  process.exit(0);
}
run();
