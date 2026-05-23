import { db } from "./lib/firestore.js";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

async function dump() {
  const products = await getDocs(collection(db, "products"));
  for (const p of products.docs) {
    if (p.data().name.includes("DJAMRU")) {
      console.log("PRODUCT:", p.id, p.data().name, "totalPacks:", p.data().totalPacks);
    }
  }

  const pos = await getDocs(collection(db, "purchases"));
  for (const po of pos.docs) {
    const data = po.data();
    if (data.productName && data.productName.includes("DJAMRU")) {
      console.log("PO:", po.id, data.createdAt.toDate(), "totalPack:", data.totalPack);
    }
  }

  const dists = await getDocs(collection(db, "distributions"));
  let totalDist = 0;
  for (const d of dists.docs) {
    const data = d.data();
    if (data.productName && data.productName.includes("DJAMRU")) {
      totalDist += data.totalPacksDistributed || 0;
      console.log("DIST:", d.id, data.createdAt.toDate(), "qty:", data.totalPacksDistributed);
    }
  }
  console.log("Total Distributed DJAMRU:", totalDist);
}

dump().then(() => process.exit(0)).catch(console.error);
