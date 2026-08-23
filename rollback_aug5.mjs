import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, runTransaction, serverTimestamp } from "firebase/firestore";
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

async function deleteReturnTransaction(returnId, returnData) {
  const { teamId, productId, totalPacksReturned, returnAmount, hppSnapshot } = returnData;
  const teamRef = doc(db, "sales_ledger", teamId);
  const productRef = doc(db, "products", productId);
  const SUMMARY_DOC = doc(db, "summary", "dashboard");
  const returnRef = doc(db, "returns", returnId);

  return runTransaction(db, async (transaction) => {
    const teamSnap = await transaction.get(teamRef);
    const productSnap = await transaction.get(productRef);
    const summarySnap = await transaction.get(SUMMARY_DOC);

    if (teamSnap.exists()) {
      transaction.update(teamRef, {
        goodsDropped: (teamSnap.data().goodsDropped || 0) + Math.abs(returnAmount),
        updatedAt: serverTimestamp()
      });
    }

    if (productSnap.exists()) {
      transaction.update(productRef, {
        totalPacks: Math.max(0, (productSnap.data().totalPacks || 0) - Math.abs(totalPacksReturned)),
        adminDistributedPacks: (productSnap.data().adminDistributedPacks || 0) + Math.abs(totalPacksReturned),
        updatedAt: serverTimestamp()
      });
    }

    if (summarySnap.exists()) {
      const profitReversed = returnAmount - (Math.abs(totalPacksReturned) * (hppSnapshot || 0));
      transaction.update(SUMMARY_DOC, {
        salesReceivables: (summarySnap.data().salesReceivables || 0) + Math.abs(returnAmount),
        totalLabaKotor: (summarySnap.data().totalLabaKotor || 0) + profitReversed,
        sisaLabaBelumDibagikan: (summarySnap.data().sisaLabaBelumDibagikan || 0) + profitReversed,
        updatedAt: serverTimestamp()
      });
    }

    transaction.delete(returnRef);
  });
}

async function run() {
  const retSnap = await getDocs(collection(db, "returns"));
  const returns = retSnap.docs.map(d => ({id: d.id, ...d.data()}))
    .filter(d => d.productName && d.productName.toLowerCase().includes("airu"));
  
  // Find returns on 5 August 2026
  const aug5Returns = returns.filter(r => {
    if (!r.createdAt) return false;
    const date = new Date(r.createdAt.seconds * 1000);
    return date.getDate() === 5 && date.getMonth() === 7 && date.getFullYear() === 2026;
  });

  console.log(`Found ${aug5Returns.length} duplicate returns on 5 August 2026.`);
  
  for (const r of aug5Returns) {
    console.log(`Deleting duplicate return ID: ${r.id} | Team: ${r.teamName} | Qty: ${r.totalPacksReturned}`);
    try {
      await deleteReturnTransaction(r.id, r);
      console.log(`Success deleting ${r.id}`);
    } catch (e) {
      console.error(`Failed deleting ${r.id}:`, e);
    }
  }

  process.exit(0);
}
run();
