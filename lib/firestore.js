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
    createdAt: serverTimestamp(),
  });
}

export async function updateProduct(productId, data) {
  const ref = doc(db, "products", productId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteProduct(productId) {
  const ref = doc(db, "products", productId);
  await deleteDoc(ref);
}

export async function seedProducts() {
  const existing = await getProducts();
  if (existing.length > 0) return; // sudah ada data

  const defaults = [
    {
      name: "NEW GUDANG HARUM 12",
      packsPerSlop: 10,
      slopsPerBall: 20,
      ballsPerKarton: 5,
    },
    {
      name: "NEW GUDANG HARUM 20",
      packsPerSlop: 10,
      slopsPerBall: 10,
      ballsPerKarton: 6,
    },
    {
      name: "S'A MANGO 78 12",
      packsPerSlop: 10,
      slopsPerBall: 20,
      ballsPerKarton: 5,
    },
    {
      name: "S'A BERRY 78 12",
      packsPerSlop: 10,
      slopsPerBall: 20,
      ballsPerKarton: 5,
    },
    {
      name: "AIRU 16",
      packsPerSlop: 10,
      slopsPerBall: 10,
      ballsPerKarton: 8,
    },
  ];

  for (const prod of defaults) {
    await addProduct(prod);
  }
}

// ──────────────────────────────────────────────
// INVENTARIS (single document "warehouse")
// ──────────────────────────────────────────────
const INVENTORY_DOC = doc(db, "inventory", "warehouse");

export async function getInventory() {
  const snap = await getDoc(INVENTORY_DOC);
  if (snap.exists()) return snap.data();
  const init = { totalCartons: 0, updatedAt: serverTimestamp() };
  await setDoc(INVENTORY_DOC, init);
  return init;
}

export function subscribeInventory(callback) {
  return onSnapshot(INVENTORY_DOC, (snap) => {
    callback(snap.exists() ? snap.data() : { totalCartons: 0 });
  });
}

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

export async function deletePurchase(purchaseId, data) {
  const ref = doc(db, "purchases", purchaseId);
  
  // 1. Hapus dokumen PO
  await deleteDoc(ref);

  // 2. Koreksi Stok Gudang (Kurangi)
  await updateInventoryStock(-Math.abs(data.jumlahKarton));

  // 3. Koreksi Hutang (Kurangi)
  await incrementSummaryField("factoryDebt", -Math.abs(data.sisaHutang || 0));

  // 4. Koreksi Total Aset (Kurangi)
  await incrementSummaryField("totalAssets", -Math.abs(data.totalFaktur || 0));
}

export async function getLastPurchase(productName) {
  const q = query(
    purchasesCol,
    where("productName", "==", productName),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ──────────────────────────────────────────────
// RINGKASAN (single document "dashboard")
// ──────────────────────────────────────────────
const SUMMARY_DOC = doc(db, "summary", "dashboard");

export async function getSummary() {
  const snap = await getDoc(SUMMARY_DOC);
  if (snap.exists()) return snap.data();
  const init = {
    totalAssets: 0,
    factoryDebt: 0,
    salesReceivables: 0,
    updatedAt: serverTimestamp(),
  };
  await setDoc(SUMMARY_DOC, init);
  return init;
}

export function subscribeSummary(callback) {
  return onSnapshot(SUMMARY_DOC, (snap) => {
    callback(
      snap.exists()
        ? snap.data()
        : { totalAssets: 0, factoryDebt: 0, salesReceivables: 0 }
    );
  });
}

export async function updateSummary(fields) {
  await setDoc(
    SUMMARY_DOC,
    { ...fields, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function incrementSummaryField(field, value) {
  await setDoc(
    SUMMARY_DOC,
    { [field]: increment(value), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ──────────────────────────────────────────────
// BUKU BESAR PENJUALAN (sales_ledger)
// ──────────────────────────────────────────────
const salesCol = collection(db, "sales_ledger");

export async function getSalesTeams() {
  const snap = await getDocs(salesCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function subscribeSalesTeams(callback) {
  return onSnapshot(salesCol, (snap) => {
    const teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Urutkan berdasarkan nama
    teams.sort((a, b) => {
      const numA = parseInt(a.name?.replace(/\D/g, "") || "0");
      const numB = parseInt(b.name?.replace(/\D/g, "") || "0");
      return numA - numB;
    });
    callback(teams);
  });
}

export async function addSalesTeam(name) {
  return addDoc(salesCol, {
    name,
    goodsDropped: 0,
    totalDeposited: 0,
    createdAt: serverTimestamp(),
  });
}

export async function updateSalesTeam(teamId, fields) {
  const teamRef = doc(db, "sales_ledger", teamId);
  await updateDoc(teamRef, { ...fields, updatedAt: serverTimestamp() });
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
  const { teamId, amount, jumlahKarton } = data;
  
  // 1. Update saldo barang turun di tim sales
  await addGoodsDropped(teamId, amount);

  // 2. Kurangi stok gudang (menggunakan float untuk fraksi karton)
  await updateInventoryStock(-Math.abs(parseFloat(jumlahKarton)));

  // 3. Tambah piutang sales di summary
  await incrementSummaryField("salesReceivables", amount);

  // 4. Catat log distribusi
  const distCol = collection(db, "distributions");
  await addDoc(distCol, {
    ...data,
    createdAt: serverTimestamp()
  });
}

export function subscribeDistributions(teamId, callback) {
  const distCol = collection(db, "distributions");
  const q = query(
    distCol, 
    where("teamId", "==", teamId)
  );
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Urutkan manual berdasarkan tanggal terbaru
    data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    callback(data);
  });
}

export async function deleteSalesTeam(teamId) {
  const teamRef = doc(db, "sales_ledger", teamId);
  await deleteDoc(teamRef);
}

// ──────────────────────────────────────────────
// SEED TIM SALES AWAL (jalankan sekali)
// ──────────────────────────────────────────────
export async function seedSalesTeams() {
  const existing = await getSalesTeams();
  if (existing.length > 0) return;

  const teams = [
    "Tim 1",
    "Tim 2",
    "Tim 3",
    "Tim 4",
    "Tim 5",
    "Tim 6",
    "Tim 7",
  ];
  for (const name of teams) {
    await addSalesTeam(name);
  }
}

// ──────────────────────────────────────────────
// RETUR BARANG (returns)
// ──────────────────────────────────────────────
const returnsCol = collection(db, "returns");

export function subscribeReturns(callback) {
  const q = query(returnsCol, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addReturn(data) {
  // 1. Simpan data retur
  const docRef = await addDoc(returnsCol, {
    ...data,
    createdAt: serverTimestamp(),
  });

  // 2. Kurangi stok gudang (cartons)
  await updateInventoryStock(-Math.abs(data.jumlahKarton));

  // 3. Update Ringkasan (kurangi Aset)
  // Hitung perkiraan nilai aset yang berkurang (Qty * HPP)
  const assetLoss = data.jumlahKarton * (data.hpp || 0);
  await incrementSummaryField("totalAssets", -Math.abs(assetLoss));

  // 4. Jika retur ke pabrik, kurangi hutang
  if (data.type === "factory" && data.totalFaktur) {
    await incrementSummaryField("factoryDebt", -Math.abs(data.totalFaktur));
  }

  return docRef;
}
