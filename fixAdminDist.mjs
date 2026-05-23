import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/\r/g, '');
});

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

async function fix() {
  const distsSnap = await getDocs(collection(db, 'distributions'));
  const productDist = {};

  // Sum all admin distributions per product
  for (const d of distsSnap.docs) {
    const data = d.data();
    if (data.source !== 'captain' && data.productId) {
      if (!productDist[data.productId]) productDist[data.productId] = 0;
      productDist[data.productId] += (data.totalPacksDistributed || 0);
    }
  }

  // Update products
  const productsSnap = await getDocs(collection(db, 'products'));
  const batch = writeBatch(db);
  
  for (const p of productsSnap.docs) {
    const adminDist = productDist[p.id] || 0;
    console.log(`Product: ${p.data().name}, Admin Distributed: ${adminDist}`);
    batch.update(p.ref, { adminDistributedPacks: adminDist });
  }

  await batch.commit();
  console.log('Fixed all products!');
  process.exit(0);
}
fix();
