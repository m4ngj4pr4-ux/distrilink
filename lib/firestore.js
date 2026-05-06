// lib/firestore.js — Semua operasi Firestore CRUD
import { db } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
  serverTimestamp,
  increment,
  onSnapshot,
} from "firebase/firestore";

// ──────────────────────────────────────────────
// PRODUK (Master Produk & Konversi Satuan)
// ──────────────────────────────────────────────
const productsCol = collection(db, "products");

export function subscribeProducts(callback) {
  return onSnapshot(productsCol, (snap) => {
    const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    products.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    callback(products);
  });
}

export async function getProducts() {
  const snap = await getDocs(productsCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addProduct(data) {
  return addDoc(productsCol, {
    ...data,
    totalPacks: 0,
    stockCartons: 0, // Legacy support
    createdAt: serverTimestamp(),
  });
}

export async function updateProduct(productId, data) {
  const ref = doc(db, "products", productId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function updateProductPackStock(productId, packsToAdd) {
  const ref = doc(db, "products", productId);
  await updateDoc(ref, {
    totalPacks: increment(packsToAdd),
    updatedAt: serverTimestamp()
  });
}

export async function syncProductPacks(products) {
  for (const p of products) {
    if ((p.totalPacks === undefined || p.totalPacks === 0) && p.stockCartons > 0) {
      const slopsPerKarton = (p.slopsPerBall || 20) * (p.ballsPerKarton || 5);
      const totalPacks = p.stockCartons * slopsPerKarton * (p.packsPerSlop || 10);
      const ref = doc(db, "products", p.id);
      await updateDoc(ref, { totalPacks: Math.round(totalPacks) });
    }
  }
}

export async function deleteProduct(productId) {
  const ref = doc(db, "products", productId);
  await deleteDoc(ref);
}

// ──────────────────────────────────────────────
// INVENTARIS (single document "warehouse")
// ──────────────────────────────────────────────
const INVENTORY_DOC = doc(db, "inventory", "warehouse");

export async function updateInventoryStock(cartonsToAdd) {
  await setDoc(
    INVENTORY_DOC,
    {
      totalCartons: increment(cartonsToAdd),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeInventory(callback) {
  return onSnapshot(INVENTORY_DOC, (snap) => {
    callback(snap.exists() ? snap.data() : { totalCartons: 0 });
  });
}

// ──────────────────────────────────────────────
// PEMBELIAN (purchases)
// ──────────────────────────────────────────────
const purchasesCol = collection(db, "purchases");

export async function addPurchase(data) {
  return addDoc(purchasesCol, {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export function subscribePurchases(callback) {
  const q = query(purchasesCol, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function updatePO(poId, data) {
  const poRef = doc(db, "purchases", poId);
  return updateDoc(poRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deletePurchase(purchaseId, data) {
  const ref = doc(db, "purchases", purchaseId);
  await deleteDoc(ref);

  // Koreksi Stok & Summary
  await updateInventoryStock(-Math.abs(data.jumlahKarton || 0));
  if (data.productId) {
    const packsPerSlop = data.conversion?.packsPerSlop || 10;
    const slopsPerKarton = (data.conversion?.slopsPerBall || 20) * (data.conversion?.ballsPerKarton || 5);
    const packsToDelete = (data.jumlahKarton || 0) * slopsPerKarton * packsPerSlop;
    await updateProductPackStock(data.productId, -Math.abs(packsToDelete));
  }
  await incrementSummaryField("factoryDebt", -Math.abs(data.sisaHutang || 0));
  await incrementSummaryField("totalAssets", -Math.abs(data.totalFaktur || 0));
}

// ──────────────────────────────────────────────
// RINGKASAN (dashboard summary)
// ──────────────────────────────────────────────
const SUMMARY_DOC = doc(db, "summary", "dashboard");

export function subscribeSummary(callback) {
  return onSnapshot(SUMMARY_DOC, (snap) => {
    callback(snap.exists() ? snap.data() : { totalAssets: 0, factoryDebt: 0, salesReceivables: 0 });
  });
}

export async function incrementSummaryField(field, value) {
  await setDoc(SUMMARY_DOC, { [field]: increment(value), updatedAt: serverTimestamp() }, { merge: true });
}

export async function recalculateSummary() {
  const purchaseSnap = await getDocs(collection(db, "purchases"));
  const salesSnap = await getDocs(collection(db, "sales_ledger"));
  const distSnap = await getDocs(collection(db, "distributions"));
  const productSnap = await getDocs(collection(db, "products"));

  let totalDebt = 0;
  let totalPOValue = 0;
  let productStockMap = {};
  let productPriceMap = {};

  // 1. Hitung barang masuk, keuangan, dan harga terakhir dari PO
  purchaseSnap.forEach(d => {
    const data = d.data();
    totalDebt += (data.sisaHutang || 0);
    totalPOValue += (data.totalFaktur || 0);

    if (data.productId) {
      const packsPerSlop = data.conversion?.packsPerSlop || 10;
      const slopsPerKarton = (data.conversion?.slopsPerBall || 20) * (data.conversion?.ballsPerKarton || 5);
      const totalPacks = (data.jumlahKarton || 0) * slopsPerKarton * packsPerSlop;

      if (!productStockMap[data.productId]) productStockMap[data.productId] = 0;
      productStockMap[data.productId] += totalPacks;

      // Simpan harga terbaru
      productPriceMap[data.productId] = {
        hpp: data.hpp || 0,
        targetJual: data.targetHargaJual || 0
      };
    }
  });

  // 2. Hitung barang keluar (Kurangi dari Distribusi Sales)
  distSnap.forEach(d => {
     const data = d.data();
     if (data.productId && productStockMap[data.productId] !== undefined) {
         productStockMap[data.productId] -= (data.totalPacksDistributed || 0);
     }
  });

  // 3. Hitung total Piutang Sales
  let totalReceivables = 0;
  salesSnap.forEach(d => {
    const data = d.data();
    totalReceivables += (data.goodsDropped || 0) - (data.totalDeposited || 0);
  });

  // 4. Simpan Keuangan ke Dokumen Ringkasan
  await setDoc(SUMMARY_DOC, {
    totalAssets: totalPOValue,
    factoryDebt: totalDebt,
    salesReceivables: totalReceivables,
    updatedAt: serverTimestamp()
  });

  // 5. Simpan stok & harga akurat kembali ke masing-masing Produk
  let totalCartonsGlobal = 0;
  for (const p of productSnap.docs) {
      const newPacks = productStockMap[p.id] || 0;
      const priceInfo = productPriceMap[p.id];
      const prodData = p.data();
      const packsPerSlop = prodData.packsPerSlop || 10;
      const slopsPerKarton = (prodData.slopsPerBall || 20) * (prodData.ballsPerKarton || 5);
      
      const convFactor = packsPerSlop * slopsPerKarton;
      totalCartonsGlobal += convFactor > 0 ? (newPacks / convFactor) : 0;

      await updateDoc(doc(db, "products", p.id), {
          totalPacks: newPacks,
          lastHPP: priceInfo ? priceInfo.hpp : null,
          currentSellingPrice: priceInfo ? priceInfo.targetJual : null,
          updatedAt: serverTimestamp()
      });
  }

  // 6. Simpan total karton inventaris global
  await setDoc(INVENTORY_DOC, {
    totalCartons: totalCartonsGlobal,
    updatedAt: serverTimestamp()
  });

  console.log("Recalculation complete (Super Mode with Price Reset)");
}

export async function payFactoryDebt(purchaseId, amount) {
  const poRef = doc(db, "purchases", purchaseId);
  // Potong sisa hutang di PO tersebut
  await updateDoc(poRef, {
    sisaHutang: increment(-amount),
    updatedAt: serverTimestamp()
  });
  // Potong total Hutang Pabrik global
  await incrementSummaryField("factoryDebt", -amount);
  // Catat riwayat pembayaran pabrik
  await addDoc(collection(db, "factory_payments"), {
    purchaseId,
    amount,
    createdAt: serverTimestamp()
  });
}

export function subscribeFactoryPayments(purchaseId, callback) {
  const q = query(
    collection(db, "factory_payments"), 
    where("purchaseId", "==", purchaseId)
  );
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Urutkan terbaru di atas
    data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    callback(data);
  });
}

// ──────────────────────────────────────────────
// 5. RIWAYAT SETORAN (DEPOSITS)
// ──────────────────────────────────────────────

export async function addDepositTransaction(teamId, amount) {
  const teamRef = doc(db, "sales_ledger", teamId);
  // Update total setoran tim
  await updateDoc(teamRef, {
    totalDeposited: increment(amount),
    updatedAt: serverTimestamp(),
  });

  // Kurangi Piutang Sales Global
  // NOTE: Kita TIDAK menambah totalAssets di sini untuk memperbaiki bug double-counting.
  // Karena uang piutang yang masuk sudah dihitung sebagai aset sejak awal (barang keluar).
  await incrementSummaryField("salesReceivables", -amount);
  
  // Simpan ke riwayat audit
  await addDoc(collection(db, "deposits"), {
    teamId,
    amount,
    createdAt: serverTimestamp(),
  });
}

export function subscribeDeposits(teamId, callback) {
  const q = query(
    collection(db, "deposits"), 
    where("teamId", "==", teamId)
  );
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Urutkan terbaru di atas
    data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    callback(data);
  });
}

// ──────────────────────────────────────────────
// SALES LEDGER
// ──────────────────────────────────────────────
const salesCol = collection(db, "sales_ledger");

export function subscribeSalesTeams(callback) {
  return onSnapshot(salesCol, (snap) => {
    const teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    teams.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    callback(teams);
  });
}

export async function addSalesTeam(name, pin) {
  return addDoc(salesCol, {
    name,
    pin: pin || "123456", // Fallback if not provided
    goodsDropped: 0,
    totalDeposited: 0,
    createdAt: serverTimestamp(),
  });
}

export async function updateSalesTeam(teamId, fields) {
  const teamRef = doc(db, "sales_ledger", teamId);
  await updateDoc(teamRef, { ...fields, updatedAt: serverTimestamp() });
}

export async function deleteSalesTeam(teamId, teamData) {
  const teamRef = doc(db, "sales_ledger", teamId);
  await deleteDoc(teamRef);

  // Kurangi Piutang Global jika tim dihapus
  if (teamData) {
    const balance = (teamData.goodsDropped || 0) - (teamData.totalDeposited || 0);
    await incrementSummaryField("salesReceivables", -Math.abs(balance));
  }
}

export async function addDeposit(teamId, amount) {
  const teamRef = doc(db, "sales_ledger", teamId);
  await updateDoc(teamRef, {
    totalDeposited: increment(amount),
    updatedAt: serverTimestamp(),
  });
}

export async function addGoodsDropped(teamId, amount) {
  const teamRef = doc(db, "sales_ledger", teamId);
  await updateDoc(teamRef, {
    goodsDropped: increment(amount),
    updatedAt: serverTimestamp(),
  });
}

export async function addGoodsDropTransaction(data) {
  const { teamId, amount, productId, totalPacksDistributed } = data;
  await addGoodsDropped(teamId, amount);
  if (productId) {
    await updateProductPackStock(productId, -Math.abs(totalPacksDistributed));
  }
  await incrementSummaryField("salesReceivables", amount);
  await addDoc(collection(db, "distributions"), { ...data, createdAt: serverTimestamp() });
}

export function subscribeDistributions(teamId, callback) {
  const q = query(collection(db, "distributions"), where("teamId", "==", teamId));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    callback(data);
  });
}

export function subscribeReturns(callback) {
  const q = query(collection(db, "returns"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
export function subscribeAllDistributions(callback) {
  const q = query(collection(db, "distributions"));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(data);
  });
}

export async function deleteDistribution(distId, data) {
  // 1. Kembalikan stok ke gudang
  if (data.productId) {
    await updateProductPackStock(data.productId, Math.abs(data.totalPacksDistributed || 0));
  }
  // 2. Kurangi total goodsDropped di tim sales
  if (data.teamId) {
    const teamRef = doc(db, "sales_ledger", data.teamId);
    await updateDoc(teamRef, {
      goodsDropped: increment(-Math.abs(data.amount || 0)),
      updatedAt: serverTimestamp()
    });
  }
  // 3. Kurangi Piutang Global
  await incrementSummaryField("salesReceivables", -Math.abs(data.amount || 0));
  // 4. Hapus datanya
  await deleteDoc(doc(db, "distributions", distId));
}

export async function factoryResetDatabase() {
  const collectionsToWipe = [
    "products", "purchases", "sales_ledger", 
    "distributions", "deposits", "factory_payments", "returns", "factory_returns",
    "retail_stores"
  ];

  // Hapus semua dokumen di setiap koleksi
  for (const colName of collectionsToWipe) {
    const snap = await getDocs(collection(db, colName));
    for (const docSnap of snap.docs) {
      await deleteDoc(doc(db, colName, docSnap.id));
    }
  }

  // Kembalikan ringkasan ke 0
  await setDoc(doc(db, "summary", "dashboard"), {
    totalAssets: 0,
    factoryDebt: 0,
    salesReceivables: 0,
    updatedAt: serverTimestamp()
  });

  // Kembalikan inventaris ke 0
  await setDoc(doc(db, "inventory", "warehouse"), {
    totalCartons: 0,
    updatedAt: serverTimestamp()
  });
}

export async function addReturnTransaction(data) {
  const { teamId, productId, totalPacksReturned, returnAmount } = data;

  // 1. Kurangi total goodsDropped di tim sales (mengurangi beban piutang mereka)
  const teamRef = doc(db, "sales_ledger", teamId);
  await updateDoc(teamRef, {
    goodsDropped: increment(-Math.abs(returnAmount)),
    updatedAt: serverTimestamp()
  });

  // 2. Kurangi Piutang Global
  await incrementSummaryField("salesReceivables", -Math.abs(returnAmount));

  // 3. Kembalikan stok ke gudang
  await updateProductPackStock(productId, Math.abs(totalPacksReturned));

  // 4. Simpan riwayat retur
  await addDoc(collection(db, "returns"), { ...data, createdAt: serverTimestamp() });
}

export async function addFactoryReturnTransaction(data) {
  const { productId, totalPacksReturned, returnAmount } = data;

  // 1. Kurangi Hutang Pabrik Global
  await incrementSummaryField("factoryDebt", -Math.abs(returnAmount));

  // 2. Kurangi Stok Gudang
  await updateProductPackStock(productId, -Math.abs(totalPacksReturned));

  // 3. Simpan riwayat retur pabrik
  await addDoc(collection(db, "factory_returns"), { ...data, createdAt: serverTimestamp() });
}

export function subscribeFactoryReturns(callback) {
  const q = query(collection(db, "factory_returns"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addRetailStore(data) {
  return addDoc(collection(db, "retail_stores"), {
    ...data,
    totalPiutang: 0,
    createdAt: serverTimestamp()
  });
}

export function subscribeRetailStores(callback) {
  const q = query(collection(db, "retail_stores"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function deleteRetailStore(storeId) {
  await deleteDoc(doc(db, "retail_stores", storeId));
}

export async function updateRetailStore(storeId, data) {
  const storeRef = doc(db, "retail_stores", storeId);
  return updateDoc(storeRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

// ──────────────────────────────────────────────
// SALES AUTHENTICATION
// ──────────────────────────────────────────────
export async function getSalesList() {
  const snapshot = await getDocs(collection(db, "sales_ledger"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function verifySalesLogin(nama, pin) {
  const q = query(
    collection(db, "sales_ledger"), 
    where("name", "==", nama), 
    where("pin", "==", pin)
  );
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    return userData;
  }
  return null;
}

export async function getStokBawaanSales(teamId) {
  try {
    const q = query(collection(db, "distributions"), where("teamId", "==", teamId));
    const snapshot = await getDocs(q);
    
    let totalPacks = 0;
    snapshot.forEach((doc) => {
      const data = doc.data();
      totalPacks += (data.totalPacksDistributed || 0); 
    });
    
    return totalPacks;
  } catch (error) {
    console.error("Error fetching stok:", error);
    return 0;
  }
}

