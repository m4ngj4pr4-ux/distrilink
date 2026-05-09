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

export async function addDepositTransaction(teamId, amount, teamName) {
  const teamRef = doc(db, "sales_ledger", teamId);
  // Update total setoran tim
  await updateDoc(teamRef, {
    totalDeposited: increment(amount),
    updatedAt: serverTimestamp(),
  });

  // Kurangi Piutang Sales Global
  await incrementSummaryField("salesReceivables", -amount);
  
  // Simpan ke riwayat audit terpadu
  await addDoc(collection(db, "setoran_dana"), {
    teamId,
    namaSales: teamName || "Unknown",
    nominal: amount,
    waktu: serverTimestamp(),
    diinputOleh: "Admin",
    status: "Diverifikasi Admin",
    catatan: "Input Langsung oleh Admin"
  });
}

export function subscribeDeposits(teamId, callback) {
  const qNew = query(collection(db, "setoran_dana"), where("teamId", "==", teamId));
  const qOld = query(collection(db, "deposits"), where("teamId", "==", teamId));

  let newSetoran = [];
  let oldSetoran = [];

  const updateCallback = () => {
    const combined = [...newSetoran, ...oldSetoran];
    combined.sort((a, b) => {
      const timeA = (a.waktu || a.createdAt)?.toMillis() || 0;
      const timeB = (b.waktu || b.createdAt)?.toMillis() || 0;
      return timeB - timeA;
    });
    callback(combined);
  };

  const unsubNew = onSnapshot(qNew, (snap) => {
    newSetoran = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateCallback();
  });

  const unsubOld = onSnapshot(qOld, (snap) => {
    oldSetoran = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateCallback();
  });

  return () => {
    unsubNew();
    unsubOld();
  };
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

export async function getRetailStoresList() {
  const snapshot = await getDocs(collection(db, "retail_stores"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addDropTransaction(data) {
  // 1. Simpan transaksi drop
  await addDoc(collection(db, "sales_transactions"), { 
    ...data, 
    tipe: 'drop',
    waktu: serverTimestamp() 
  });

  // 2. Update store_inventory (stok di rak toko per produk)
  if (data.storeId && data.productName) {
    const invId = `${data.storeId}_${data.productName}`;
    const invRef = doc(db, "store_inventory", invId);
    const invSnap = await getDoc(invRef);
    
    if (invSnap.exists()) {
      await updateDoc(invRef, {
        currentStock: increment(data.jumlahDrop || 0),
        lastDropBy: data.namaSales || "",
        lastDropAt: serverTimestamp()
      });
    } else {
      await setDoc(invRef, {
        storeId: data.storeId,
        namaToko: data.namaToko || "",
        productName: data.productName,
        productId: data.productId || "",
        currentStock: data.jumlahDrop || 0,
        lastDropBy: data.namaSales || "",
        lastDropAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    }
  }
}

// ──────────────────────────────────────────────
// STORE INVENTORY AUDIT
// ──────────────────────────────────────────────

// Ambil stok bawaan per produk yang dimiliki sales (Distribusi - Drop)
export async function getSalesCarriedBrands(teamId) {
  try {
    // Total distribusi per produk
    const qDist = query(collection(db, "distributions"), where("teamId", "==", teamId));
    const snapDist = await getDocs(qDist);
    const assigned = {};
    snapDist.forEach(d => {
      const dt = d.data();
      if (!dt.productName) return;
      if (!assigned[dt.productName]) {
        assigned[dt.productName] = { productId: dt.productId, productName: dt.productName, total: 0 };
      }
      assigned[dt.productName].total += (dt.totalPacksDistributed || 0);
    });

    // Total drop per produk
    const qDrop = query(collection(db, "sales_transactions"), where("teamId", "==", teamId));
    const snapDrop = await getDocs(qDrop);
    const dropped = {};
    snapDrop.forEach(d => {
      const dt = d.data();
      if (!dt.productName) return;
      dropped[dt.productName] = (dropped[dt.productName] || 0) + (dt.jumlahDrop || 0);
    });

    // Ambil data produk untuk mendapatkan harga dan konversi unit
    const prodSnap = await getDocs(collection(db, "products"));
    const prodDetails = {};
    prodSnap.forEach(d => {
      const p = d.data();
      prodDetails[p.name] = {
        packsPerCt: p.packsPerCt || 800,
        packsPerBal: p.packsPerBal || 100,
        packsPerSlop: p.packsPerSlop || 10,
        // Gunakan currentSellingPrice (hasil kalkulasi terakhir) atau targetHargaJual
        sellingPrice: p.currentSellingPrice || p.targetHargaJual || p.lastHPP || 0
      };
    });

    // Hitung sisa per produk
    const result = {};
    Object.keys(assigned).forEach(name => {
      const sisa = assigned[name].total - (dropped[name] || 0);
      if (sisa > 0) {
        const pd = prodDetails[name] || {};
        result[name] = { 
          productId: assigned[name].productId, 
          productName: name, 
          sisa,
          packsPerCt: pd.packsPerCt || 800,
          packsPerBal: pd.packsPerBal || 100,
          packsPerSlop: pd.packsPerSlop || 10,
          sellingPrice: pd.sellingPrice
        };
      }
    });

    return result;
  } catch (error) {
    console.error("Error fetching carried brands:", error);
    return {};
  }
}

// Ambil inventori toko (stok di rak per produk)
export async function getStoreInventory(storeId) {
  try {
    const q = query(collection(db, "store_inventory"), where("storeId", "==", storeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error fetching store inventory:", error);
    return [];
  }
}

// Sales update stok fisik di rak toko (audit)
export async function updateStoreShelfStock(storeId, productName, newStock, auditorName) {
  const invId = `${storeId}_${productName}`;
  const invRef = doc(db, "store_inventory", invId);
  const invSnap = await getDoc(invRef);
  
  if (invSnap.exists()) {
    await updateDoc(invRef, {
      currentStock: newStock,
      lastAuditBy: auditorName,
      lastAuditAt: serverTimestamp()
    });
  } else {
    await setDoc(invRef, {
      storeId,
      productName,
      currentStock: newStock,
      lastAuditBy: auditorName,
      lastAuditAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });
  }
}

export async function getSisaStokSales(teamId) {
  try {
    // 1. Get Total Assigned (from distributions)
    const qDistribusi = query(collection(db, "distributions"), where("teamId", "==", teamId));
    const snapDistribusi = await getDocs(qDistribusi);
    let totalAssigned = 0;
    snapDistribusi.forEach((doc) => {
      totalAssigned += (doc.data().totalPacksDistributed || 0); 
    });

    // 2. Get Total Dropped (from sales_transactions)
    const qDrop = query(collection(db, "sales_transactions"), where("teamId", "==", teamId));
    const snapDrop = await getDocs(qDrop);
    let totalDropped = 0;
    snapDrop.forEach((doc) => {
      totalDropped += (doc.data().jumlahDrop || 0);
    });

    return totalAssigned - totalDropped;
  } catch (error) {
    console.error("Error calculating stock:", error);
    return 0;
  }
}

export async function getSalesStockBreakdown(teamId) {
  try {
    const qDist = query(collection(db, "distributions"), where("teamId", "==", teamId));
    const snapDist = await getDocs(qDist);
    
    const breakdown = {};
    snapDist.forEach(doc => {
      const data = doc.data();
      if (!data.productId) return;
      if (!breakdown[data.productId]) {
        breakdown[data.productId] = {
          productId: data.productId,
          productName: data.productName,
          totalAssigned: 0,
        };
      }
      breakdown[data.productId].totalAssigned += (data.totalPacksDistributed || 0);
    });

    // Fetch product details to get images
    const productsSnap = await getDocs(collection(db, "products"));
    const productsData = {};
    productsSnap.forEach(doc => {
      productsData[doc.id] = doc.data();
    });

    return Object.values(breakdown).map(item => ({
      ...item,
      imageUrl: productsData[item.productId]?.imageUrl || null,
      brand: productsData[item.productId]?.brand || ""
    }));
  } catch (error) {
    console.error("Error fetching stock breakdown:", error);
    return [];
  }
}

// Simpan transaksi setoran uang
export async function addSetoranDana(teamId, teamName, amount, metode = "Transfer Bank", catatan = "") {
  const initialStatus = metode === "Tunai ke Captain" ? "Menunggu Diterima Captain" : "Menunggu Verifikasi";
  
  return addDoc(collection(db, "setoran_dana"), {
    teamId,
    teamName,
    nominal: amount,
    metode,
    catatan: catatan || (metode === "Tunai ke Captain" ? "Titip Tunai ke Captain" : "Setoran Transfer"),
    status: initialStatus,
    waktu: serverTimestamp(),
  });
}

export async function getRiwayatSetoran(teamId) {
  try {
    const qNew = query(collection(db, "setoran_dana"), where("teamId", "==", teamId));
    const qOld = query(collection(db, "deposits"), where("teamId", "==", teamId));
    
    const [snapNew, snapOld] = await Promise.all([getDocs(qNew), getDocs(qOld)]);
    
    const newHistory = snapNew.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const oldHistory = snapOld.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      nominal: doc.data().amount,
      waktu: doc.data().createdAt,
      status: "Diverifikasi Admin",
      catatan: "Setoran Lama"
    }));
    
    const history = [...newHistory, ...oldHistory];
    
    return history.sort((a, b) => {
      const timeA = a.waktu?.toMillis() || 0;
      const timeB = b.waktu?.toMillis() || 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.error("Error fetching setoran history:", error);
    return [];
  }
}

export async function getSalesHistory(namaSales) {
  try {
    const q = query(collection(db, "sales_transactions"), where("namaSales", "==", namaSales));
    const snapshot = await getDocs(q);
    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return history.sort((a, b) => {
      const timeA = a.waktu?.toMillis() || 0;
      const timeB = b.waktu?.toMillis() || 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    return [];
  }
}

export async function getCountPendingSetoran() {
  try {
    const q = query(
      collection(db, "setoran_dana"), 
      where("status", "in", ["Menunggu Verifikasi", "Menunggu Verifikasi Admin"])
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error("Error fetching pending setoran count:", error);
    return 0;
  }
}

export async function getSemuaPendingSetoran() {
  try {
    const q = query(
      collection(db, "setoran_dana"), 
      where("status", "in", ["Menunggu Verifikasi", "Menunggu Verifikasi Admin"])
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort by newest first
    return data.sort((a, b) => {
      const timeA = a.waktu?.toMillis() || 0;
      const timeB = b.waktu?.toMillis() || 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.error("Error fetching pending setoran:", error);
    return [];
  }
}

export async function verifikasiSetoranAdmin(id, teamId, nominal) {
  // 1. Update total setoran tim di sales_ledger
  const teamRef = doc(db, "sales_ledger", teamId);
  await updateDoc(teamRef, {
    totalDeposited: increment(nominal),
    updatedAt: serverTimestamp(),
  });

  // 2. Kurangi Piutang Sales Global di summary
  await incrementSummaryField("salesReceivables", -nominal);

  // 3. Update status di setoran_dana
  const docRef = doc(db, "setoran_dana", id);
  return updateDoc(docRef, {
    status: "Diverifikasi Admin",
    updatedAt: serverTimestamp()
  });
}

export async function getSalesProfile(teamId) {
  try {
    const docSnap = await getDoc(doc(db, "sales_ledger", teamId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching sales profile:", error);
    return null;
  }
}

// Ambil inventori toko yang dikelompokkan per toko untuk sales tertentu
export async function getGroupedStoreInventory(teamId) {
  try {
    // 1. Ambil semua transaksi drop sales ini (hanya tipe 'drop', bukan distribusi internal)
    const qTx = query(
      collection(db, "sales_transactions"), 
      where("teamId", "==", teamId),
      where("tipe", "==", "drop")
    );
    const snapTx = await getDocs(qTx);
    
    // Kumpulkan storeId unik dan total drop per toko+produk
    const storeMap = {};
    snapTx.forEach(d => {
      const tx = d.data();
      if (!tx.storeId) return;
      
      if (!storeMap[tx.storeId]) {
        storeMap[tx.storeId] = {
          storeId: tx.storeId,
          namaToko: tx.namaToko || "Toko",
          totalDropped: 0,
          products: {}
        };
      }
      storeMap[tx.storeId].totalDropped += (tx.jumlahDrop || 0);
      
      const pName = tx.productName || "Produk Umum";
      if (!storeMap[tx.storeId].products[pName]) {
        storeMap[tx.storeId].products[pName] = { productName: pName, productId: tx.productId || "", totalDropped: 0 };
      }
      storeMap[tx.storeId].products[pName].totalDropped += (tx.jumlahDrop || 0);
    });
    
    // 1b. Ambil toko terdaftar milik sales ini dari retail_stores
    // agar toko baru yang belum pernah di-drop tetap muncul
    const qStores = query(collection(db, "retail_stores"), where("teamId", "==", teamId));
    const snapStores = await getDocs(qStores);
    snapStores.forEach(d => {
      const store = d.data();
      const sid = d.id;
      if (!storeMap[sid]) {
        storeMap[sid] = {
          storeId: sid,
          namaToko: store.namaToko || "Toko",
          totalDropped: 0,
          products: {}
        };
      }
    });

    // 2. Ambil store_inventory untuk melengkapi data stok rak
    const storeIds = Object.keys(storeMap);
    const inventoryMap = {};
    
    // Firestore 'in' query max 30, batch if needed
    for (let i = 0; i < storeIds.length; i += 30) {
      const batch = storeIds.slice(i, i + 30);
      const qInv = query(collection(db, "store_inventory"), where("storeId", "in", batch));
      const snapInv = await getDocs(qInv);
      snapInv.forEach(d => {
        const inv = d.data();
        const key = `${inv.storeId}_${inv.productName}`;
        inventoryMap[key] = inv;
      });
    }
    
    // 3. Gabungkan data
    const result = Object.values(storeMap).map(store => {
      const products = Object.values(store.products).map(prod => {
        const invKey = `${store.storeId}_${prod.productName}`;
        const inv = inventoryMap[invKey];
        return {
          ...prod,
          currentStock: inv?.currentStock ?? 0,
          lastAuditBy: inv?.lastAuditBy || null,
          lastAuditAt: inv?.lastAuditAt || null,
          lastDropBy: inv?.lastDropBy || null,
        };
      });
      return { ...store, products };
    });
    
    // Urutkan toko dari yang paling banyak di-drop
    result.sort((a, b) => b.totalDropped - a.totalDropped);
    return result;
  } catch (error) {
    console.error("Error fetching grouped store inventory:", error);
    return [];
  }
}

// ──────────────────────────────────────────────
// CAPTAIN MODE
// ──────────────────────────────────────────────

// Ambil daftar anggota tim (sales_ledger) selain captain itu sendiri
export async function getTeamMembersForCaptain(captainId) {
  const snapshot = await getDocs(collection(db, "sales_ledger"));
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => s.id !== captainId);
}


// Captain mendistribusikan stok ke anggota tim
export async function captainDistributeStock({ 
  captainId, captainName, targetTeamId, targetTeamName, 
  productId, productName, totalPacks, pricePerPack,
  qtyOriginal, unit 
}) {
  const totalAmount = totalPacks * pricePerPack;

  // 1. Catat distribusi untuk target sales
  await addDoc(collection(db, "distributions"), {
    teamId: targetTeamId,
    teamName: targetTeamName,
    productId,
    productName,
    totalPacksDistributed: totalPacks,
    qtyOriginal: qtyOriginal || totalPacks,
    unit: unit || "Pk",
    pricePerPack,
    amount: totalAmount,
    distributedBy: captainName,
    distributedByCaptainId: captainId,
    source: "captain",
    createdAt: serverTimestamp()
  });

  // 2. Update goodsDropped (piutang) target sales
  await addGoodsDropped(targetTeamId, totalAmount);

  // 3. Update piutang global
  await incrementSummaryField("salesReceivables", totalAmount);

  // 4. Catat sebagai "drop" dari stok captain (agar saldo captain berkurang)
  await addDoc(collection(db, "sales_transactions"), {
    teamId: captainId,
    namaSales: captainName,
    storeId: `captain_dist_${targetTeamId}`,
    namaToko: `Distribusi ke ${targetTeamName}`,
    productId,
    productName,
    jumlahDrop: totalPacks,
    qtyOriginal: qtyOriginal || totalPacks,
    unit: unit || "Pk",
    tipe: 'captain_distribute',
    catatan: `Distribusi oleh Captain ke ${targetTeamName}`,
    waktu: serverTimestamp()
  });
}

// Ambil setoran yang butuh atensi Captain (Tunai & Transfer)
export async function getTeamPendingSetoran() {
  const q = query(
    collection(db, "setoran_dana"),
    where("status", "in", ["Menunggu Verifikasi", "Menunggu Diterima Captain", "Kas di Captain"])
  );
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  return data.sort((a, b) => {
    const timeA = a.waktu?.toMillis() || 0;
    const timeB = b.waktu?.toMillis() || 0;
    return timeB - timeA;
  });
}

// Captain menerima uang tunai dari sales
export async function acceptCashDeposit(id) {
  const docRef = doc(db, "setoran_dana", id);
  return updateDoc(docRef, {
    status: "Kas di Captain",
    updatedAt: serverTimestamp()
  });
}

// Captain menyetor kumpulan uang tunai ke Admin
export async function captainDepositToAdmin(ids) {
  const batch = [];
  for (const id of ids) {
    const docRef = doc(db, "setoran_dana", id);
    batch.push(updateDoc(docRef, {
      status: "Menunggu Verifikasi Admin",
      updatedAt: serverTimestamp()
    }));
  }
  return Promise.all(batch);
}

// Captain memverifikasi setoran
export async function captainVerifikasiSetoran(id, teamId, nominal) {
  const teamRef = doc(db, "sales_ledger", teamId);
  await updateDoc(teamRef, {
    totalDeposited: increment(nominal),
    updatedAt: serverTimestamp(),
  });
  await incrementSummaryField("salesReceivables", -nominal);
  const docRef = doc(db, "setoran_dana", id);
  return updateDoc(docRef, {
    status: "Diverifikasi Captain",
    updatedAt: serverTimestamp()
  });
}

// ──────────────────────────────────────────────
// FINANCE MODULE: INVESTORS & LEDGER
// ──────────────────────────────────────────────

// --- Investors ---
export function subscribeInvestors(callback) {
  return onSnapshot(collection(db, "investors"), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));
    callback(data);
  });
}

export async function addInvestor(data) {
  return addDoc(collection(db, "investors"), { ...data, createdAt: serverTimestamp() });
}

export async function updateInvestor(id, data) {
  return updateDoc(doc(db, "investors", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteInvestor(id) {
  return deleteDoc(doc(db, "investors", id));
}

// --- Finance Ledger ---
export function subscribeFinanceLedger(callback) {
  const q = query(collection(db, "finance_ledger"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addFinanceEntry(data) {
  return addDoc(collection(db, "finance_ledger"), {
    ...data,
    createdAt: serverTimestamp()
  });
}

export async function deleteFinanceEntry(id) {
  return deleteDoc(doc(db, "finance_ledger", id));
}

// Hitung ringkasan keuangan dari ledger
export function calcFinanceSummary(ledger) {
  let totalModal = 0, totalHutang = 0, totalBayarHutang = 0;
  let totalPiutang = 0, totalTerimaPiutang = 0, totalBagiHasil = 0;

  ledger.forEach(e => {
    const n = e.nominal || 0;
    switch (e.tipeBuku) {
      case 'modal_masuk': totalModal += n; break;
      case 'hutang_masuk': totalHutang += n; break;
      case 'bayar_hutang': totalBayarHutang += n; break;
      case 'piutang_keluar': totalPiutang += n; break;
      case 'terima_piutang': totalTerimaPiutang += n; break;
      case 'bagi_hasil': totalBagiHasil += n; break;
    }
  });

  return {
    totalModal,
    sisaHutang: totalHutang - totalBayarHutang,
    sisaPiutang: totalPiutang - totalTerimaPiutang,
    totalBagiHasil,
  };
}

// ──────────────────────────────────────────────
// ADMIN USERS & AUTH
// ──────────────────────────────────────────────
const usersCol = collection(db, "users");

export async function adminLogin(email, password) {
  const q = query(usersCol, where("email", "==", email), where("password", "==", password));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const user = snap.docs[0].data();
  return { id: snap.docs[0].id, ...user };
}

export function subscribeAdminUsers(callback) {
  return onSnapshot(usersCol, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addAdminUser(data) {
  return addDoc(usersCol, {
    ...data,
    createdAt: serverTimestamp()
  });
}

export async function updateAdminUser(userId, data) {
  await updateDoc(doc(db, "users", userId), data);
}

export async function deleteAdminUser(userId) {
  await deleteDoc(doc(db, "users", userId));
}

export async function seedDefaultOwner() {
  const q = query(usersCol, where("role", "==", "owner"));
  const snap = await getDocs(q);
  if (snap.empty) {
    await addDoc(usersCol, {
      email: "owner@distrilink.com",
      password: "owner-owner",
      nama: "Owner Utama",
      role: "owner",
      createdAt: serverTimestamp()
    });
    console.log("Default owner seeded.");
  }
}

