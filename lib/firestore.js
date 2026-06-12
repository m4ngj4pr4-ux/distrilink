// lib/firestore.js — Semua operasi Firestore CRUD
import { db, storage } from "./firebase";
import { 
  ref as sRef, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";
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
  runTransaction,
  writeBatch,
  Timestamp,
} from "firebase/firestore";

const INVENTORY_LOGS = collection(db, "inventory_logs");

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
      const slopsPerBall = p.slopsPerBall || 20;
      const ballsPerKarton = p.ballsPerKarton || 5;
      const ekstraSlop = p.ekstraSlopPerKarton || 0;
      const slopsPerKarton = (slopsPerBall * ballsPerKarton) + ekstraSlop;
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

export async function addPurchaseAtomic(data) {
  const SUMMARY_DOC = doc(db, "summary", "dashboard");
  const INVENTORY_DOC = doc(db, "inventory", "warehouse");
  const productRef = doc(db, "products", data.productId);
  const poRef = doc(collection(db, "purchases"));
  const financeRef = doc(collection(db, "finance_ledger"));

  return runTransaction(db, async (transaction) => {
    const summarySnap = await transaction.get(SUMMARY_DOC);
    const invSnap = await transaction.get(INVENTORY_DOC);
    const productSnap = await transaction.get(productRef);

    const status = data.status || "pengiriman";
    transaction.set(poRef, { ...data, status, createdAt: serverTimestamp() });

    if (summarySnap.exists()) {
      const sData = summarySnap.data();
      const newModal = (data.uangMuka > 0) ? Math.max(0, (sData.modalAktif || 0) - data.uangMuka) : (sData.modalAktif || 0);
      transaction.update(SUMMARY_DOC, {
        factoryDebt: (sData.factoryDebt || 0) + (data.sisaHutang || 0),
        totalAssets: (sData.totalAssets || 0) + (data.totalFaktur || 0),
        modalAktif: newModal,
        updatedAt: serverTimestamp()
      });
    }

    if (status !== "pengiriman") {
      if (invSnap.exists()) {
        const iData = invSnap.data();
        transaction.update(INVENTORY_DOC, {
          totalCartons: (iData.totalCartons || 0) + (data.jumlahKarton || 0),
          updatedAt: serverTimestamp()
        });
      }

      if (productSnap.exists()) {
        const pData = productSnap.data();
        transaction.update(productRef, {
          totalPacks: (pData.totalPacks || 0) + (data.totalPack || 0),
          currentSellingPrice: data.targetHargaJual,
          lastHPP: data.hpp,
          updatedAt: serverTimestamp()
        });
      }

      // 4. Log Inventaris
      const logRef = doc(INVENTORY_LOGS);
      transaction.set(logRef, {
        type: "PO_FACTORY",
        productId: data.productId,
        productName: data.productName,
        deltaPacks: data.totalPack || 0,
        referenceId: poRef.id,
        timestamp: serverTimestamp(),
        note: `Penerimaan PO Pabrik: ${data.jumlahKarton} Karton`
      });
    }

    // Stock-related debts are no longer mirrored in finance_ledger to separate stock from general finance.

    // 5. Jika ada DP (Uang Muka), masukkan ke Riwayat Pembayaran & Finance Ledger
    if (data.uangMuka > 0) {
      const payRef = doc(collection(db, "factory_payments"));
      transaction.set(payRef, {
        purchaseId: poRef.id,
        amount: data.uangMuka,
        isDP: true,
        createdAt: serverTimestamp()
      });

      const ledgerRef = doc(collection(db, "finance_ledger"));
      transaction.set(ledgerRef, {
        tipeBuku: "auto_bayar_po",
        nominal: data.uangMuka,
        keterangan: `[Auto] DP / Pembayaran Awal PO #${poRef.id.slice(-6).toUpperCase()}`,
        relasiId: poRef.id,
        isAutoJournal: true,
        createdAt: serverTimestamp()
      });
    }
  });
}

export function subscribePurchases(callback) {
  const q = query(purchasesCol, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function updatePO(poId, data) {
  const financeQuery = query(collection(db, "finance_ledger"), where("relasiId", "==", poId), limit(1));
  const financeSnap = await getDocs(financeQuery);

  const distQuery = query(collection(db, "distributions"), where("poId", "==", poId));
  const distDocsSnap = await getDocs(distQuery);

  const txQuery = query(collection(db, "sales_transactions"), where("poId", "==", poId));
  const txDocsSnap = await getDocs(txQuery);

  const poRef = doc(db, "purchases", poId);
  const SUMMARY_DOC = doc(db, "summary", "dashboard");
  const INVENTORY_DOC = doc(db, "inventory", "warehouse");

  return runTransaction(db, async (transaction) => {
    const poSnap = await transaction.get(poRef);
    if (!poSnap.exists()) throw new Error("PO tidak ditemukan");
    
    const oldData = poSnap.data();

    // Hitung Delta Keuangan
    const deltaHutang = (data.sisaHutang || 0) - (oldData.sisaHutang || 0);
    const deltaAset = (data.totalFaktur || 0) - (oldData.totalFaktur || 0);
    const deltaDP = (data.uangMuka || 0) - (oldData.uangMuka || 0);
    
    // Hitung Delta Stok
    const deltaKarton = (data.jumlahKarton || 0) - (oldData.jumlahKarton || 0);

    const oldPacksPerSlop = oldData.conversion?.packsPerSlop || 10;
    const oldBaseSlopsPerKarton = (oldData.conversion?.slopsPerBall || 20) * (oldData.conversion?.ballsPerKarton || 5);
    const oldExtraSlop = oldData.conversion?.ekstraSlop || oldData.conversion?.ekstraSlopPerKarton || 0;
    const oldTotalExtraSlops = (oldData.conversion?.isExtraPerKarton !== false && oldData.conversion?.ekstraSlopPerKarton !== undefined) 
      ? (oldExtraSlop * (oldData.jumlahKarton || 0)) 
      : ((oldData.conversion?.isExtraPerKarton) ? (oldExtraSlop * (oldData.jumlahKarton || 0)) : oldExtraSlop);
    const oldSlops = ((oldData.jumlahKarton || 0) * oldBaseSlopsPerKarton) + oldTotalExtraSlops;
    const oldPacks = oldSlops * oldPacksPerSlop;
    
    // Calculate new packs based on updated data
    let newPacks = data.totalPack;
    if (newPacks === undefined) {
      const newPacksPerSlop = data.conversion?.packsPerSlop || oldPacksPerSlop;
      const newBaseSlopsPerKarton = (data.conversion?.slopsPerBall || oldData.conversion?.slopsPerBall || 20) * (data.conversion?.ballsPerKarton || oldData.conversion?.ballsPerKarton || 5);
      const newExtraSlop = data.conversion?.ekstraSlop || data.conversion?.ekstraSlopPerKarton || oldExtraSlop;
      const newJumlahKarton = data.jumlahKarton !== undefined ? data.jumlahKarton : (oldData.jumlahKarton || 0);
      const newTotalExtraSlops = (data.conversion?.isExtraPerKarton) ? (newExtraSlop * newJumlahKarton) : newExtraSlop;
      const newSlops = (newJumlahKarton * newBaseSlopsPerKarton) + newTotalExtraSlops;
      newPacks = newSlops * newPacksPerSlop;
    }
    
    const deltaPacks = newPacks - oldPacks;

    // Read Summary & Inventory & Product
    const summarySnap = await transaction.get(SUMMARY_DOC);
    const invSnap = await transaction.get(INVENTORY_DOC);

    let productRef = null;
    let productSnap = null;
    if (oldData.productId) {
      productRef = doc(db, "products", oldData.productId);
      productSnap = await transaction.get(productRef);
    }

    // Update PO
    transaction.update(poRef, {
      ...data,
      updatedAt: serverTimestamp()
    });

    // Stock-related debts are no longer mirrored in finance_ledger.

    // Cascading Update: HPP di Distributions & Sales Transactions (Laba Rugi)
    for (const distDoc of distDocsSnap.docs) {
      transaction.update(distDoc.ref, { hppSnapshot: data.hpp });
    }
    for (const txDoc of txDocsSnap.docs) {
      transaction.update(txDoc.ref, { hppSnapshot: data.hpp });
    }

    // Update Summary
    if (summarySnap.exists()) {
      const sData = summarySnap.data();
      transaction.update(SUMMARY_DOC, {
        factoryDebt: Math.max(0, (sData.factoryDebt || 0) + deltaHutang),
        totalAssets: Math.max(0, (sData.totalAssets || 0) + deltaAset),
        modalAktif: Math.max(0, (sData.modalAktif || 0) - deltaDP),
        updatedAt: serverTimestamp()
      });
    }

    // Update Inventory
    if (oldData.status !== "pengiriman" && invSnap.exists() && deltaKarton !== 0) {
      const iData = invSnap.data();
      transaction.update(INVENTORY_DOC, {
        totalCartons: Math.max(0, (iData.totalCartons || 0) + deltaKarton),
        updatedAt: serverTimestamp()
      });
    }

    // Update Product Stock
    if (oldData.status !== "pengiriman" && productSnap?.exists()) {
      const pData = productSnap.data();
      transaction.update(productRef, {
        totalPacks: Math.max(0, (pData.totalPacks || 0) + deltaPacks),
        updatedAt: serverTimestamp()
      });
    }

    // Add Inventory Log for Correction
    if (oldData.status !== "pengiriman" && deltaPacks !== 0) {
      const logRef = doc(INVENTORY_LOGS);
      transaction.set(logRef, {
        type: "CORRECTION_PO",
        productId: oldData.productId,
        productName: oldData.productName,
        deltaPacks: deltaPacks,
        referenceId: poId,
        timestamp: serverTimestamp(),
        note: deltaPacks > 0 ? "Koreksi PO (Penambahan Ekstra Slop / Revisi Qty)" : "Koreksi PO (Pengurangan Qty)"
      });
    }
  });
}

export async function receivePurchaseAtomic(poId, actualCartons) {
  const SUMMARY_DOC = doc(db, "summary", "dashboard");
  const INVENTORY_DOC = doc(db, "inventory", "warehouse");
  const poRef = doc(db, "purchases", poId);

  return runTransaction(db, async (transaction) => {
    const poSnap = await transaction.get(poRef);
    if (!poSnap.exists()) throw new Error("PO tidak ditemukan");
    const po = poSnap.data();
    if (po.status !== "pengiriman") throw new Error("PO sudah diterima sebelumnya");

    const summarySnap = await transaction.get(SUMMARY_DOC);
    const invSnap = await transaction.get(INVENTORY_DOC);

    const productRef = doc(db, "products", po.productId);
    const productSnap = await transaction.get(productRef);

    // Calculate actual packs based on conversion
    const packsPerSlop = po.conversion?.packsPerSlop || 10;
    const slopsPerBall = po.conversion?.slopsPerBall || 20;
    const ballsPerKarton = po.conversion?.ballsPerKarton || 5;
    const extraSlop = po.conversion?.ekstraSlopPerKarton || 0;
    const slopsPerKarton = (slopsPerBall * ballsPerKarton) + extraSlop;
    const actualPacks = actualCartons * slopsPerKarton * packsPerSlop;

    const originalCartons = po.jumlahKarton || 0;
    const originalPacks = po.totalPack || 0;

    // Financial adjustment if quantity is different
    let deltaSisaHutang = 0;
    let deltaTotalFaktur = 0;
    let newHpp = po.hpp || 0;
    let newTotalFaktur = po.totalFaktur || 0;
    let newSisaHutang = po.sisaHutang || 0;
    let newTotalPembelian = po.totalPembelian || 0;

    if (actualCartons !== originalCartons) {
      newTotalPembelian = actualPacks * (po.hargaBeliPerPack || 0);
      newHpp = (po.hargaBeliPerPack || 0) + (actualPacks > 0 ? (po.biayaPengiriman || 0) / actualPacks : 0);
      newTotalFaktur = newTotalPembelian + (po.biayaPengiriman || 0);
      newSisaHutang = Math.max(0, newTotalFaktur - (po.uangMuka || 0));

      deltaSisaHutang = newSisaHutang - (po.sisaHutang || 0);
      deltaTotalFaktur = newTotalFaktur - (po.totalFaktur || 0);
    }

    // Update PO document
    transaction.update(poRef, {
      status: "diterima",
      jumlahKarton: actualCartons,
      totalPack: actualPacks,
      totalSlop: actualCartons * slopsPerKarton,
      totalBall: actualCartons * ballsPerKarton,
      totalPembelian: newTotalPembelian,
      hpp: newHpp,
      totalFaktur: newTotalFaktur,
      sisaHutang: newSisaHutang,
      originalJumlahKarton: originalCartons,
      originalTotalPack: originalPacks,
      receivedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Update Summary Dashboard (financials)
    if (summarySnap.exists() && (deltaSisaHutang !== 0 || deltaTotalFaktur !== 0)) {
      const sData = summarySnap.data();
      transaction.update(SUMMARY_DOC, {
        factoryDebt: Math.max(0, (sData.factoryDebt || 0) + deltaSisaHutang),
        totalAssets: Math.max(0, (sData.totalAssets || 0) + deltaTotalFaktur),
        updatedAt: serverTimestamp()
      });
    }

    // Add physical stock to inventory/warehouse
    if (invSnap.exists()) {
      const iData = invSnap.data();
      transaction.update(INVENTORY_DOC, {
        totalCartons: (iData.totalCartons || 0) + actualCartons,
        updatedAt: serverTimestamp()
      });
    }

    // Add physical stock to products
    if (productSnap.exists()) {
      const pData = productSnap.data();
      transaction.update(productRef, {
        totalPacks: (pData.totalPacks || 0) + actualPacks,
        currentSellingPrice: po.targetHargaJual,
        lastHPP: newHpp,
        updatedAt: serverTimestamp()
      });
    }

    // Log Inventaris
    const logRef = doc(INVENTORY_LOGS);
    transaction.set(logRef, {
      type: "PO_FACTORY",
      productId: po.productId,
      productName: po.productName,
      deltaPacks: actualPacks,
      referenceId: poId,
      timestamp: serverTimestamp(),
      note: `Penerimaan PO Pabrik: ${actualCartons} Karton (Diterima Admin Gudang)`
    });
  });
}

export async function deletePurchase(purchaseId, data) {
  const financeQuery = query(collection(db, "finance_ledger"), where("relasiId", "==", purchaseId));
  const financeSnap = await getDocs(financeQuery);

  const paymentsQuery = query(collection(db, "factory_payments"), where("purchaseId", "==", purchaseId));
  const paymentsSnap = await getDocs(paymentsQuery);

  const poRef = doc(db, "purchases", purchaseId);
  const SUMMARY_DOC = doc(db, "summary", "dashboard");
  const INVENTORY_DOC = doc(db, "inventory", "warehouse");
  
  return runTransaction(db, async (transaction) => {
    const poSnap = await transaction.get(poRef);
    if (!poSnap.exists()) return;
    
    const poData = poSnap.data();

    // Read references
    const summarySnap = await transaction.get(SUMMARY_DOC);
    const invSnap = await transaction.get(INVENTORY_DOC);
    
    let productRef = null;
    let productSnap = null;
    if (poData.productId) {
      productRef = doc(db, "products", poData.productId);
      productSnap = await transaction.get(productRef);
    }

    // Rollback Values
    const deltaKarton = -(poData.jumlahKarton || 0);
    const deltaHutang = -(poData.sisaHutang || 0);
    const deltaAset = -(poData.totalFaktur || 0);
    
    const packsPerSlop = poData.conversion?.packsPerSlop || 10;
    const slopsPerBall = poData.conversion?.slopsPerBall || 20;
    const ballsPerKarton = poData.conversion?.ballsPerKarton || 5;
    const extraSlop = poData.conversion?.ekstraSlopPerKarton || 0;
    const slopsPerKarton = (slopsPerBall * ballsPerKarton) + extraSlop;
    const deltaPacks = -((poData.jumlahKarton || 0) * slopsPerKarton * packsPerSlop);

    // 4. Log Inventaris (Rollback)
    if (deltaPacks !== 0) {
      const logRef = doc(INVENTORY_LOGS);
      transaction.set(logRef, {
        type: "DELETE_PO",
        productId: poData.productId,
        productName: poData.productName,
        deltaPacks: deltaPacks,
        referenceId: purchaseId,
        timestamp: serverTimestamp(),
        note: `Penghapusan PO Pabrik: ${poData.jumlahKarton} Karton`
      });
    }

    // Update Summary
    if (summarySnap.exists()) {
      const sData = summarySnap.data();
      // Refund all money paid for this PO back to Kas
      const totalRefund = paymentsSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
      
      transaction.update(SUMMARY_DOC, {
        factoryDebt: Math.max(0, (sData.factoryDebt || 0) + deltaHutang),
        totalAssets: Math.max(0, (sData.totalAssets || 0) + deltaAset),
        modalAktif: (sData.modalAktif || 0) + totalRefund,
        updatedAt: serverTimestamp()
      });
    }

    // Update Inventory
    if (poData.status !== "pengiriman") {
      if (invSnap.exists() && deltaKarton !== 0) {
        const iData = invSnap.data();
        transaction.update(INVENTORY_DOC, {
          totalCartons: Math.max(0, (iData.totalCartons || 0) + deltaKarton),
          updatedAt: serverTimestamp()
        });
      }

      // Update Product
      if (productSnap?.exists() && deltaPacks !== 0) {
        const pData = productSnap.data();
        transaction.update(productRef, {
          totalPacks: Math.max(0, (pData.totalPacks || 0) + deltaPacks),
          updatedAt: serverTimestamp()
        });
      }
    }

    // Clean up related financial records
    financeSnap.docs.forEach(d => transaction.delete(d.ref));
    paymentsSnap.docs.forEach(d => transaction.delete(d.ref));

    // Delete PO Document
    transaction.delete(poRef);
  });
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
  const returnsSnap = await getDocs(collection(db, "returns"));
  const setoranSnap = await getDocs(collection(db, "setoran_dana"));
  const oldDepositsSnap = await getDocs(collection(db, "deposits"));

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
      const slopsPerBall = data.conversion?.slopsPerBall || 20;
      const ballsPerKarton = data.conversion?.ballsPerKarton || 5;
      const extraSlop = data.conversion?.ekstraSlopPerKarton || 0;
      const slopsPerKarton = (slopsPerBall * ballsPerKarton) + extraSlop;
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

  // Maps for self-healing sales ledger balances
  let teamGoodsDroppedMap = {};
  let teamTotalDepositedMap = {};

  // 2. Hitung barang keluar (Kurangi dari Distribusi Sales)
  distSnap.forEach(d => {
     const data = d.data();
     if (data.productId && productStockMap[data.productId] !== undefined) {
         productStockMap[data.productId] -= (data.totalPacksDistributed || 0);
     }

     // Populate team goods dropped
     if (data.teamId) {
       if (!teamGoodsDroppedMap[data.teamId]) teamGoodsDroppedMap[data.teamId] = 0;
       teamGoodsDroppedMap[data.teamId] += (data.amount || 0);
     }
  });

  // 3. Hitung Laba Kotor (distribusi) & Kurangi dari Retur Sales
  let accumulatedProfit = 0;
  distSnap.forEach(d => {
    const data = d.data();
    if (data.source !== "captain") {
       const profit = (data.amount || 0) - ((data.totalPacksDistributed || 0) * (data.hppSnapshot || 0));
       accumulatedProfit += profit;
    }
  });

  returnsSnap.forEach(d => {
    const data = d.data();
    const profitReversed = (data.returnAmount || 0) - (Math.abs(data.totalPacksReturned || 0) * (data.hppSnapshot || 0));
    accumulatedProfit -= profitReversed;

    // BUG 7 FIX: Tambahkan kembali stok barang yang diretur sales
    if (data.productId && productStockMap[data.productId] !== undefined) {
      productStockMap[data.productId] += Math.abs(data.totalPacksReturned || 0);
    }

    // Deduct returns from team goods dropped
    if (data.teamId) {
      if (!teamGoodsDroppedMap[data.teamId]) teamGoodsDroppedMap[data.teamId] = 0;
      teamGoodsDroppedMap[data.teamId] -= (data.returnAmount || 0);
    }
  });

  // Kurangi dari Retur Pabrik
  const factoryReturnsSnap = await getDocs(collection(db, "factory_returns"));
  factoryReturnsSnap.forEach(d => {
    const data = d.data();
    // BUG 7 FIX: Kurangi stok barang yang diretur ke pabrik
    if (data.productId && productStockMap[data.productId] !== undefined) {
      productStockMap[data.productId] -= Math.abs(data.totalPacksReturned || 0);
    }
  });

  // Calculate team total deposited from new setoran_dana
  let totalSetoranMasuk = 0;
  setoranSnap.forEach(d => {
    const data = d.data();
    const nominalVal = data.nominal || 0;
    
    // Sum for global cash in (only Diverifikasi Admin status is considered completed)
    if (data.status === "Diverifikasi Admin") {
      totalSetoranMasuk += nominalVal;
    }

    // Sum for individual team's totalDeposited (both Diverifikasi Admin and Diverifikasi Captain update team balance)
    if (data.teamId && (data.status === "Diverifikasi Admin" || data.status === "Selesai (Sistem Lama)" || data.status === "Diverifikasi Captain")) {
      if (!teamTotalDepositedMap[data.teamId]) teamTotalDepositedMap[data.teamId] = 0;
      teamTotalDepositedMap[data.teamId] += nominalVal;
    }
  });

  // Calculate team total deposited from old deposits
  oldDepositsSnap.forEach(d => {
    const data = d.data();
    if (data.teamId) {
      const amountVal = data.amount || 0;
      if (!teamTotalDepositedMap[data.teamId]) teamTotalDepositedMap[data.teamId] = 0;
      teamTotalDepositedMap[data.teamId] += amountVal;
    }
  });

  // SELF-HEALING: Recalculate each sales team's goodsDropped and totalDeposited fields
  let totalReceivables = 0;
  for (const t of salesSnap.docs) {
    const tId = t.id;
    const tData = t.data();
    
    const calculatedGoodsDropped = Math.max(0, teamGoodsDroppedMap[tId] || 0);
    const calculatedTotalDeposited = Math.max(0, teamTotalDepositedMap[tId] || 0);
    
    // Only update if there is a mismatch
    if (tData.goodsDropped !== calculatedGoodsDropped || tData.totalDeposited !== calculatedTotalDeposited) {
      await updateDoc(doc(db, "sales_ledger", tId), {
        goodsDropped: calculatedGoodsDropped,
        totalDeposited: calculatedTotalDeposited,
        updatedAt: serverTimestamp()
      });
    }
    
    // Summary receivables calculation uses the correct values
    totalReceivables += (calculatedGoodsDropped - calculatedTotalDeposited);
  }

  // 3.6 Hitung semua kategori finance_ledger
  const ledgerSnap = await getDocs(collection(db, "finance_ledger"));
  let totalBagiHasil = 0;
  let totalBiayaOperasional = 0;
  let totalPengeluaranLain = 0;
  let totalModalMasuk = 0;
  let totalPemasukanLain = 0;
  ledgerSnap.forEach(d => {
    const data = d.data();
    const n = data.nominal || 0;
    switch (data.tipeBuku) {
      case 'bagi_hasil': totalBagiHasil += n; break;
      case 'biaya_operasional': totalBiayaOperasional += n; break;
      case 'pengeluaran_lain': totalPengeluaranLain += n; break;
      case 'modal_masuk': totalModalMasuk += n; break;
      case 'pemasukan_lain': totalPemasukanLain += n; break;
    }
  });

  // 3.8 Hitung total DP/Bayar ke pabrik (kas keluar)
  const paymentsSnap = await getDocs(collection(db, "factory_payments"));
  let totalBayarPabrik = 0;
  paymentsSnap.forEach(d => {
    totalBayarPabrik += (d.data().amount || 0);
  });

  // Hitung DP dari PO yang belum masuk factory_payments (DP awal saat buat PO)
  let totalDPfromPO = 0;
  purchaseSnap.forEach(d => {
    totalDPfromPO += (d.data().uangMuka || 0);
  });

  // 4. Simpan Keuangan ke Dokumen Ringkasan
  const sisaLaba = accumulatedProfit - totalBagiHasil - totalBiayaOperasional - totalPengeluaranLain;
  const kasIn = totalSetoranMasuk + totalModalMasuk + totalPemasukanLain;
  const kasOut = totalDPfromPO + totalBayarPabrik + totalBagiHasil + totalBiayaOperasional + totalPengeluaranLain;
  const recalcModalAktif = kasIn - kasOut - 12360000;

  const SUMMARY_DOC = doc(db, "summary", "dashboard");
  await setDoc(SUMMARY_DOC, {
    totalAssets: totalPOValue,
    factoryDebt: totalDebt,
    salesReceivables: totalReceivables,
    totalLabaKotor: accumulatedProfit,
    totalBagiHasil: totalBagiHasil,
    totalBiayaOperasional: totalBiayaOperasional,
    totalPengeluaranLain: totalPengeluaranLain,
    sisaLabaBelumDibagikan: sisaLaba,
    modalAktif: recalcModalAktif,
    updatedAt: serverTimestamp()
  }, { merge: true });

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
  const SUMMARY_DOC = doc(db, "summary", "dashboard");

  return runTransaction(db, async (transaction) => {
    const poSnap = await transaction.get(poRef);
    if (!poSnap.exists()) throw new Error("PO tidak ditemukan");
    const summarySnap = await transaction.get(SUMMARY_DOC);

    transaction.update(poRef, {
      sisaHutang: Math.max(0, (poSnap.data().sisaHutang || 0) - amount),
      updatedAt: serverTimestamp()
    });

    if (summarySnap.exists()) {
      const sData = summarySnap.data();
      transaction.update(SUMMARY_DOC, {
        factoryDebt: Math.max(0, (sData.factoryDebt || 0) - amount),
        // AUTO-JOURNAL: Bayar hutang pabrik mengurangi kas
        modalAktif: Math.max(0, (sData.modalAktif || 0) - amount),
        updatedAt: serverTimestamp()
      });
    }

    // Log pembayaran
    const payRef = doc(collection(db, "factory_payments"));
    transaction.set(payRef, {
      purchaseId,
      amount,
      createdAt: serverTimestamp()
    });

    // AUTO-JOURNAL: Catat di finance_ledger
    const logRef = doc(collection(db, "finance_ledger"));
    transaction.set(logRef, {
      tipeBuku: "auto_bayar_po",
      nominal: amount,
      keterangan: `[Auto] Pembayaran Hutang PO #${purchaseId.slice(-6).toUpperCase()}`,
      relasiId: purchaseId,
      isAutoJournal: true,
      createdAt: serverTimestamp()
    });
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

export async function getLastFactoryPayment(purchaseId) {
  try {
    const q = query(
      collection(db, "factory_payments"),
      where("purchaseId", "==", purchaseId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;
    const data = snap.docs.map(d => d.data());
    data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    return data[0].amount || 0;
  } catch (err) {
    console.error("Error fetching last payment:", err);
    return 0;
  }
}


// ──────────────────────────────────────────────
// 5. RIWAYAT SETORAN (DEPOSITS)
// ──────────────────────────────────────────────

export async function addDepositTransaction(teamId, amount, teamName) {
  const teamRef = doc(db, "sales_ledger", teamId);
  const SUMMARY_DOC = doc(db, "summary", "dashboard");

  return runTransaction(db, async (transaction) => {
    const teamSnap = await transaction.get(teamRef);
    if (!teamSnap.exists()) throw new Error("Tim tidak ditemukan");
    const summarySnap = await transaction.get(SUMMARY_DOC);

    transaction.update(teamRef, {
      totalDeposited: (teamSnap.data().totalDeposited || 0) + amount,
      updatedAt: serverTimestamp()
    });

    if (summarySnap.exists()) {
      const sData = summarySnap.data();
      transaction.update(SUMMARY_DOC, {
        salesReceivables: Math.max(0, (sData.salesReceivables || 0) - amount),
        modalAktif: (sData.modalAktif || 0) + amount,
        updatedAt: serverTimestamp()
      });
    }

    const setoranRef = doc(collection(db, "setoran_dana"));
    transaction.set(setoranRef, {
      teamId,
      namaSales: teamName || "Unknown",
      nominal: amount,
      waktu: serverTimestamp(),
      diinputOleh: "Admin",
      status: "Diverifikasi Admin",
      catatan: "Input Langsung oleh Admin"
    });

    // AUTO-JOURNAL: Catat di finance_ledger
    const logRef = doc(collection(db, "finance_ledger"));
    transaction.set(logRef, {
      tipeBuku: "auto_setoran_sales",
      nominal: amount,
      keterangan: `[Auto] Terima Setoran dari ${teamName || "Sales"}`,
      relasiId: setoranRef.id,
      isAutoJournal: true,
      createdAt: serverTimestamp()
    });
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
    newSetoran = snap.docs.map(d => ({ id: d.id, _collection: "setoran_dana", ...d.data() }));
    updateCallback();
  });

  const unsubOld = onSnapshot(qOld, (snap) => {
    oldSetoran = snap.docs.map(d => ({ id: d.id, _collection: "deposits", ...d.data() }));
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

export async function uploadProfilePicture(salesId, file) {
  const fileRef = sRef(storage, `profiles/${salesId}.jpg`);
  await uploadBytes(fileRef, file);
  const downloadURL = await getDownloadURL(fileRef);
  return downloadURL;
}

export async function addSalesTeam(name, pin, role = "sales", phone = "") {
  return addDoc(salesCol, {
    name,
    pin: pin || "123456",
    role,
    phone,
    photoURL: "https://ui-avatars.com/api/?name=" + encodeURIComponent(name) + "&background=random",
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
  const SUMMARY_DOC = doc(db, "summary", "dashboard");
  
  // Ambil semua distribusi yang pernah diberikan ke sales ini
  const qDist = query(collection(db, "distributions"), where("teamId", "==", teamId));
  const snapDist = await getDocs(qDist);

  // Ambil semua drop (sales_transactions) untuk menghitung barang yang SUDAH TERJUAL
  const qDrop = query(collection(db, "sales_transactions"), where("teamId", "==", teamId));
  const snapDrop = await getDocs(qDrop);

  // Hitung jumlah barang yang sudah drop per produk
  const droppedPerProduct = {};
  snapDrop.forEach(d => {
    const dt = d.data();
    if (dt.productId) {
      droppedPerProduct[dt.productId] = (droppedPerProduct[dt.productId] || 0) + (dt.jumlahDrop || 0);
    }
  });

  return runTransaction(db, async (transaction) => {
    const teamSnap = await transaction.get(teamRef);
    if (!teamSnap.exists()) return;
    const tData = teamSnap.data();

    const summarySnap = await transaction.get(SUMMARY_DOC);
    let sData = summarySnap.exists() ? summarySnap.data() : { salesReceivables: 0 };
    
    // Hitung stok yang belum terjual per produk dan distribusinya
    const unsoldToRollback = {}; 
    
    // Sort distributions from NEWEST to OLDEST (LIFO)
    const distributions = snapDist.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
    distributions.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

    // First pass: hitung total assign per produk
    const assignedPerProduct = {};
    for (const dist of distributions) {
      if (dist.productId) {
        assignedPerProduct[dist.productId] = (assignedPerProduct[dist.productId] || 0) + (dist.totalPacksDistributed || 0);
      }
    }

    // Tentukan jumlah barang yang BELUM terjual (Unsold)
    for (const pId of Object.keys(assignedPerProduct)) {
      const assigned = assignedPerProduct[pId];
      const dropped = droppedPerProduct[pId] || 0;
      unsoldToRollback[pId] = Math.max(0, assigned - dropped);
    }

    const captainsToUpdate = {};
    const productsToUpdate = {};
    const distUpdates = [];
    let totalCaptainRollbackAmount = 0;

    // Second pass: rollback LIFO (hanya sejumlah unsold)
    for (const dist of distributions) {
      const pId = dist.productId;
      if (!pId || !unsoldToRollback[pId]) continue;
      
      const unsold = unsoldToRollback[pId];
      const distQty = dist.totalPacksDistributed || 0;
      
      if (distQty <= 0) continue;

      const qtyToRollback = Math.min(unsold, distQty);
      const amountToRollback = qtyToRollback * (dist.pricePerPack || 0);

      // Kurangi target unsold
      unsoldToRollback[pId] -= qtyToRollback;

      // Kemana barang dikembalikan?
      if (dist.source === "captain" && dist.distributedByCaptainId) {
        captainsToUpdate[dist.distributedByCaptainId] = (captainsToUpdate[dist.distributedByCaptainId] || 0) + amountToRollback;
        totalCaptainRollbackAmount += amountToRollback;
      } else {
        productsToUpdate[pId] = (productsToUpdate[pId] || 0) + qtyToRollback;
      }

      // Update riwayat distribusi (dikurangi sejumlah yang di-rollback)
      const newDistQty = distQty - qtyToRollback;
      if (newDistQty <= 0) {
        distUpdates.push({ ref: dist.ref, delete: true });
      } else {
        distUpdates.push({ 
          ref: dist.ref, 
          update: { 
            totalPacksDistributed: newDistQty, 
            amount: newDistQty * (dist.pricePerPack || 0) 
          } 
        });
      }
    }

    // Ambil referensi Firestore yang diperlukan
    const captainSnaps = {};
    for (const cId of Object.keys(captainsToUpdate)) {
      captainSnaps[cId] = await transaction.get(doc(db, "sales_ledger", cId));
    }
    const productSnaps = {};
    for (const pId of Object.keys(productsToUpdate)) {
      productSnaps[pId] = await transaction.get(doc(db, "products", pId));
    }

    // Update Hutang Captain
    for (const cId of Object.keys(captainsToUpdate)) {
      if (captainSnaps[cId] && captainSnaps[cId].exists()) {
        const currentDebt = captainSnaps[cId].data().goodsDropped || 0;
        transaction.update(doc(db, "sales_ledger", cId), {
          goodsDropped: currentDebt + captainsToUpdate[cId],
          updatedAt: serverTimestamp()
        });
      }
    }

    // Update Stok Produk Gudang (Admin)
    for (const pId of Object.keys(productsToUpdate)) {
      if (productSnaps[pId] && productSnaps[pId].exists()) {
        const currentStock = productSnaps[pId].data().totalPacks || 0;
        transaction.update(doc(db, "products", pId), {
          totalPacks: currentStock + productsToUpdate[pId],
          updatedAt: serverTimestamp()
        });
      }
    }

    // Update Global Piutang
    const balance = (tData.goodsDropped || 0) - (tData.totalDeposited || 0);
    // Piutang global berkurang sebesar balance sales yang dihapus, 
    // TAPI hutang captain yang bertambah ikut menyeimbangkan, sehingga:
    let newSalesReceivables = sData.salesReceivables || 0;
    if (balance > 0) {
      newSalesReceivables = Math.max(0, newSalesReceivables - balance);
    }
    // Jika barang kembali ke Captain, Hutang Captain bertambah, sehingga Piutang Global naik lagi
    newSalesReceivables += totalCaptainRollbackAmount;

    if (summarySnap.exists()) {
      transaction.update(SUMMARY_DOC, {
        salesReceivables: newSalesReceivables,
        updatedAt: serverTimestamp()
      });
    }

    // Terapkan update/hapus pada riwayat distribusi (yang unsold dihapus/dikurangi, yang sudah sold dibiarkan)
    for (const update of distUpdates) {
      if (update.delete) {
        transaction.delete(update.ref);
      } else {
        transaction.update(update.ref, update.update);
      }
    }

    // Hapus akun sales
    transaction.delete(teamRef);
  });
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
  const teamRef = doc(db, "sales_ledger", teamId);
  const productRef = doc(db, "products", productId);
  const SUMMARY_DOC = doc(db, "summary", "dashboard");

  return runTransaction(db, async (transaction) => {
    const teamSnap = await transaction.get(teamRef);
    const productSnap = await transaction.get(productRef);
    const summarySnap = await transaction.get(SUMMARY_DOC);

    if (teamSnap.exists()) {
      transaction.update(teamRef, {
        goodsDropped: (teamSnap.data().goodsDropped || 0) + amount,
        updatedAt: serverTimestamp()
      });
    }

    if (productSnap.exists()) {
      transaction.update(productRef, {
        totalPacks: Math.max(0, (productSnap.data().totalPacks || 0) - totalPacksDistributed),
        adminDistributedPacks: (productSnap.data().adminDistributedPacks || 0) + totalPacksDistributed,
        updatedAt: serverTimestamp()
      });
    }

    if (summarySnap.exists()) {
      const profit = amount - (totalPacksDistributed * (data.hppSnapshot || 0));
      transaction.update(SUMMARY_DOC, {
        salesReceivables: (summarySnap.data().salesReceivables || 0) + amount,
        totalLabaKotor: (summarySnap.data().totalLabaKotor || 0) + profit,
        sisaLabaBelumDibagikan: (summarySnap.data().sisaLabaBelumDibagikan || 0) + profit,
        updatedAt: serverTimestamp()
      });
    }

    // Backdate logic
    let finalTimestamp = serverTimestamp();
    if (data.customDate) {
      const parsedDate = new Date(data.customDate);
      const now = new Date();
      parsedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      finalTimestamp = Timestamp.fromDate(parsedDate);
    }

    const distRef = doc(collection(db, "distributions"));
    transaction.set(distRef, { ...data, createdAt: finalTimestamp });
  });
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

export async function getDroppingHistory() {
  try {
    const q = query(collection(db, "distributions"));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return data.sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0;
      const timeB = b.createdAt?.toMillis() || 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.error("Error fetching dropping history:", error);
    return [];
  }
}

export async function deleteDistribution(distId, data) {
  const distRef = doc(db, "distributions", distId);
  const SUMMARY_DOC = doc(db, "summary", "dashboard");
  
  return runTransaction(db, async (transaction) => {
    const distSnap = await transaction.get(distRef);
    if (!distSnap.exists()) return;
    const distData = distSnap.data();

    // Read Summary
    const summarySnap = await transaction.get(SUMMARY_DOC);
    
    // Read Team
    let teamRef = null;
    let teamSnap = null;
    if (distData.teamId) {
      teamRef = doc(db, "sales_ledger", distData.teamId);
      teamSnap = await transaction.get(teamRef);
    }
    
    // Read Product
    let productRef = null;
    let productSnap = null;
    if (distData.productId) {
      productRef = doc(db, "products", distData.productId);
      productSnap = await transaction.get(productRef);
    }

    const amount = distData.amount || 0;
    const totalPacksDistributed = distData.totalPacksDistributed || 0;

    // Restore Product Stock
    if (productSnap?.exists()) {
      const pData = productSnap.data();
      transaction.update(productRef, {
        totalPacks: (pData.totalPacks || 0) + totalPacksDistributed,
        updatedAt: serverTimestamp()
      });
    }

    // Reduce Team's goodsDropped
    if (teamSnap?.exists()) {
      const tData = teamSnap.data();
      transaction.update(teamRef, {
        goodsDropped: Math.max(0, (tData.goodsDropped || 0) - amount),
        updatedAt: serverTimestamp()
      });
    }

    // Reduce Summary's salesReceivables & profit
    if (summarySnap.exists()) {
      const sData = summarySnap.data();
      const profit = distData.source !== "captain" ? (distData.amount || 0) - ((distData.totalPacksDistributed || 0) * (distData.hppSnapshot || 0)) : 0;
      
      transaction.update(SUMMARY_DOC, {
        salesReceivables: Math.max(0, (sData.salesReceivables || 0) - amount),
        totalLabaKotor: (sData.totalLabaKotor || 0) - profit,
        sisaLabaBelumDibagikan: (sData.sisaLabaBelumDibagikan || 0) - profit,
        updatedAt: serverTimestamp()
      });
    }

    transaction.delete(distRef);
  });
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

export async function resetSalesData() {
  const collectionsToWipe = [
    "distributions", "returns", "setoran_dana", "deposits", "sales_transactions", "store_inventory"
  ];

  // 1. Delete all documents in these collections
  for (const colName of collectionsToWipe) {
    const snap = await getDocs(collection(db, colName));
    for (const docSnap of snap.docs) {
      await deleteDoc(doc(db, colName, docSnap.id));
    }
  }

  // 2. Clear auto_setoran_sales entries in finance_ledger
  const ledgerQuery = query(collection(db, "finance_ledger"), where("tipeBuku", "==", "auto_setoran_sales"));
  const ledgerSnap = await getDocs(ledgerQuery);
  for (const docSnap of ledgerSnap.docs) {
    await deleteDoc(doc(db, "finance_ledger", docSnap.id));
  }

  // 3. Reset sales_ledger team balances
  const teamsSnap = await getDocs(collection(db, "sales_ledger"));
  for (const docSnap of teamsSnap.docs) {
    await updateDoc(doc(db, "sales_ledger", docSnap.id), {
      goodsDropped: 0,
      totalDeposited: 0,
      updatedAt: serverTimestamp()
    });
  }

  // 4. Reset products adminDistributedPacks
  const productsSnap = await getDocs(collection(db, "products"));
  for (const docSnap of productsSnap.docs) {
    await updateDoc(doc(db, "products", docSnap.id), {
      adminDistributedPacks: 0,
      updatedAt: serverTimestamp()
    });
  }

  // 5. Run recalculateSummary to restore warehouse stock and clean P/L
  await recalculateSummary();
}

export async function addReturnTransaction(data) {
  const { teamId, productId, totalPacksReturned, returnAmount } = data;
  const teamRef = doc(db, "sales_ledger", teamId);
  const productRef = doc(db, "products", productId);
  const SUMMARY_DOC = doc(db, "summary", "dashboard");

  return runTransaction(db, async (transaction) => {
    const teamSnap = await transaction.get(teamRef);
    const productSnap = await transaction.get(productRef);
    const summarySnap = await transaction.get(SUMMARY_DOC);

    if (teamSnap.exists()) {
      transaction.update(teamRef, {
        goodsDropped: Math.max(0, (teamSnap.data().goodsDropped || 0) - Math.abs(returnAmount)),
        updatedAt: serverTimestamp()
      });
    }

    if (productSnap.exists()) {
      transaction.update(productRef, {
        totalPacks: (productSnap.data().totalPacks || 0) + Math.abs(totalPacksReturned),
        updatedAt: serverTimestamp()
      });
    }

    if (summarySnap.exists()) {
      const profitReversed = returnAmount - (Math.abs(totalPacksReturned) * (data.hppSnapshot || 0));
      transaction.update(SUMMARY_DOC, {
        salesReceivables: Math.max(0, (summarySnap.data().salesReceivables || 0) - Math.abs(returnAmount)),
        totalLabaKotor: (summarySnap.data().totalLabaKotor || 0) - profitReversed,
        sisaLabaBelumDibagikan: (summarySnap.data().sisaLabaBelumDibagikan || 0) - profitReversed,
        updatedAt: serverTimestamp()
      });
    }

    // Backdate logic
    let finalTimestamp = serverTimestamp();
    if (data.customDate) {
      const parsedDate = new Date(data.customDate);
      const now = new Date();
      parsedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      finalTimestamp = Timestamp.fromDate(parsedDate);
    }

    const retRef = doc(collection(db, "returns"));
    transaction.set(retRef, { ...data, createdAt: finalTimestamp });
  });
}

export async function addFactoryReturnTransaction(data) {
  const { productId, totalPacksReturned, returnAmount } = data;
  const productRef = doc(db, "products", productId);
  const SUMMARY_DOC = doc(db, "summary", "dashboard");

  return runTransaction(db, async (transaction) => {
    const productSnap = await transaction.get(productRef);
    const summarySnap = await transaction.get(SUMMARY_DOC);

    if (productSnap.exists()) {
      transaction.update(productRef, {
        totalPacks: Math.max(0, (productSnap.data().totalPacks || 0) - Math.abs(totalPacksReturned)),
        updatedAt: serverTimestamp()
      });
    }

    if (summarySnap.exists()) {
      transaction.update(SUMMARY_DOC, {
        factoryDebt: Math.max(0, (summarySnap.data().factoryDebt || 0) - Math.abs(returnAmount)),
        totalAssets: Math.max(0, (summarySnap.data().totalAssets || 0) - Math.abs(returnAmount)),
        updatedAt: serverTimestamp()
      });
    }

    const retRef = doc(collection(db, "factory_returns"));
    transaction.set(retRef, { ...data, createdAt: serverTimestamp() });
  });
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
  // CATATAN PENTING: 
  // Data 'Drop Toko' (sales_transactions) ini STRICTLY hanya digunakan untuk Market Tracking
  // dan penetrasi geografis barang beredar.
  // Realisasi Keuangan (Hutang Sales & Profit Laba Rugi) SUDAH TERCATAT sejak barang
  // didistribusikan ke Sales Agent (via collection 'distributions').
  // Transaksi ini TIDAK memengaruhi buku besar perusahaan.

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

export async function addDropTransactionBatch(items, storeInfo, agentInfo) {
  const batch = writeBatch(db);
  const time = serverTimestamp();
  
  // Format receiptId: RCP-YYYYMMDD-XXXX
  const today = new Date();
  const dateStr = today.getFullYear().toString() + 
                  (today.getMonth() + 1).toString().padStart(2, '0') + 
                  today.getDate().toString().padStart(2, '0');
  const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
  const receiptId = `RCP-${dateStr}-${randomStr}`;

  // 1. Check existence of store inventory documents in parallel first
  const checkPromises = items.map(async (item) => {
    const invId = `${storeInfo.storeId}_${item.productName}`;
    const invRef = doc(db, "store_inventory", invId);
    const invSnap = await getDoc(invRef);
    return { item, invRef, exists: invSnap.exists() };
  });

  const checkResults = await Promise.all(checkPromises);

  // 2. Build the batch operations
  for (const result of checkResults) {
    const { item, invRef, exists } = result;
    const qty = parseInt(item.jumlahDrop) || 0;
    const price = parseInt(item.hargaJual) || 0;

    // Create a new sales transaction document
    const txRef = doc(collection(db, "sales_transactions"));
    batch.set(txRef, {
      teamId: agentInfo.id,
      namaSales: agentInfo.name,
      storeId: storeInfo.storeId,
      namaToko: storeInfo.namaToko,
      productId: item.productId,
      productName: item.productName,
      jumlahDrop: qty,
      hargaJual: price,
      total: qty * price,
      catatan: item.catatan || "Via Aplikasi Sales",
      receiptId: receiptId,
      tipe: 'drop',
      waktu: time
    });

    if (exists) {
      batch.update(invRef, {
        currentStock: increment(qty),
        lastDropBy: agentInfo.name,
        lastDropAt: time
      });
    } else {
      batch.set(invRef, {
        storeId: storeInfo.storeId,
        namaToko: storeInfo.namaToko,
        productName: item.productName,
        productId: item.productId,
        currentStock: qty,
        lastDropBy: agentInfo.name,
        lastDropAt: time,
        createdAt: time
      });
    }
  }

  // 3. Commit the batch
  await batch.commit();
  return receiptId;
}

export async function editDropTransaction(txId, oldData, newData) {
  const txRef = doc(db, "sales_transactions", txId);
  const isProductChanged = oldData.productId !== newData.productId;

  return runTransaction(db, async (transaction) => {
    // PREPARE READS
    let oldSnap = null, newSnap = null, invSnap = null;
    let oldInvRef = null, newInvRef = null, invRef = null;

    // --- PHASE 1: READS ---
    if (isProductChanged) {
      if (oldData.storeId && oldData.productName) {
        oldInvRef = doc(db, "store_inventory", `${oldData.storeId}_${oldData.productName}`);
        oldSnap = await transaction.get(oldInvRef);
      }
      if (newData.storeId && newData.productName) {
        newInvRef = doc(db, "store_inventory", `${newData.storeId}_${newData.productName}`);
        newSnap = await transaction.get(newInvRef);
      }
    } else {
      const selisih = newData.jumlahDrop - oldData.jumlahDrop;
      if (newData.storeId && newData.productName && selisih !== 0) {
        invRef = doc(db, "store_inventory", `${newData.storeId}_${newData.productName}`);
        invSnap = await transaction.get(invRef);
      }
    }

    // --- PHASE 2: WRITES ---
    // 1. Update transaksi drop
    transaction.update(txRef, {
      productId: newData.productId,
      productName: newData.productName,
      jumlahDrop: newData.jumlahDrop,
      hargaJual: newData.hargaJual,
      total: newData.total,
      updatedAt: serverTimestamp()
    });

    // 2. Koreksi Sisa Rak (store_inventory)
    if (isProductChanged) {
      if (oldSnap && oldSnap.exists()) {
        const curOldStock = oldSnap.data().currentStock || 0;
        transaction.update(oldInvRef, {
          currentStock: Math.max(0, curOldStock - oldData.jumlahDrop)
        });
      }
      if (newInvRef) {
        if (newSnap && newSnap.exists()) {
          const curNewStock = newSnap.data().currentStock || 0;
          transaction.update(newInvRef, {
            currentStock: curNewStock + newData.jumlahDrop
          });
        } else {
          transaction.set(newInvRef, {
            storeId: newData.storeId,
            namaToko: newData.namaToko || "",
            productName: newData.productName,
            productId: newData.productId,
            currentStock: newData.jumlahDrop,
            lastDropBy: "Admin Edit",
            lastDropAt: serverTimestamp(),
            createdAt: serverTimestamp()
          });
        }
      }
    } else {
      const selisih = newData.jumlahDrop - oldData.jumlahDrop;
      if (invRef && selisih !== 0) {
        if (invSnap && invSnap.exists()) {
          const curStock = invSnap.data().currentStock || 0;
          transaction.update(invRef, {
            currentStock: Math.max(0, curStock + selisih)
          });
        } else {
          transaction.set(invRef, {
            storeId: newData.storeId,
            namaToko: newData.namaToko || "",
            productName: newData.productName,
            productId: newData.productId,
            currentStock: newData.jumlahDrop,
            lastDropBy: "Admin Edit",
            lastDropAt: serverTimestamp(),
            createdAt: serverTimestamp()
          });
        }
      }
    }
  });
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

export async function deleteStoreInventoryRecord(id) {
  return deleteDoc(doc(db, "store_inventory", id));
}

export async function cleanupOrphanStoreInventory(existingStoreIds) {
  const snap = await getDocs(collection(db, "store_inventory"));
  const toDelete = [];
  snap.forEach(d => {
    const data = d.data();
    if (!existingStoreIds.includes(data.storeId)) {
      toDelete.push(d.ref);
    }
  });
  
  for (const ref of toDelete) {
    await deleteDoc(ref);
  }
  return toDelete.length;
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

    // 3. Get Total Returned (from returns)
    const qReturn = query(collection(db, "returns"), where("teamId", "==", teamId));
    const snapReturn = await getDocs(qReturn);
    let totalReturned = 0;
    snapReturn.forEach((doc) => {
      totalReturned += Math.abs(doc.data().totalPacksReturned || 0);
    });

    return Math.max(0, totalAssigned - totalDropped - totalReturned);
  } catch (error) {
    console.error("Error calculating stock:", error);
    return 0;
  }
}

export async function getSalesStockBreakdown(teamId) {
  try {
    // 1. Get Total Assigned per product
    const qDist = query(collection(db, "distributions"), where("teamId", "==", teamId));
    const snapDist = await getDocs(qDist);
    
    const assigned = {};
    snapDist.forEach(doc => {
      const data = doc.data();
      if (!data.productId) return;
      if (!assigned[data.productId]) {
        assigned[data.productId] = {
          productId: data.productId,
          productName: data.productName,
          total: 0,
        };
      }
      assigned[data.productId].total += (data.totalPacksDistributed || 0);
    });

    // 2. Get Total Dropped per product
    const qDrop = query(collection(db, "sales_transactions"), where("teamId", "==", teamId));
    const snapDrop = await getDocs(qDrop);
    const dropped = {};
    snapDrop.forEach(doc => {
      const data = doc.data();
      if (!data.productId) return;
      dropped[data.productId] = (dropped[data.productId] || 0) + (data.jumlahDrop || 0);
    });

    // 2.5 Get Total Returned per product
    const qRet = query(collection(db, "returns"), where("teamId", "==", teamId));
    const snapRet = await getDocs(qRet);
    const returned = {};
    snapRet.forEach(doc => {
      const data = doc.data();
      if (!data.productId) return;
      returned[data.productId] = (returned[data.productId] || 0) + Math.abs(data.totalPacksReturned || 0);
    });

    // 3. Fetch product details
    const productsSnap = await getDocs(collection(db, "products"));
    const productsData = {};
    productsSnap.forEach(doc => {
      productsData[doc.id] = doc.data();
    });

    // 4. Calculate Sisa Stok
    const result = Object.values(assigned).map(item => {
      const currentStock = Math.max(0, item.total - (dropped[item.productId] || 0) - (returned[item.productId] || 0));
      return {
        ...item,
        totalAssigned: item.total,
        currentStock,
        imageUrl: productsData[item.productId]?.imageUrl || null,
        brand: productsData[item.productId]?.brand || "",
        pricePerPack: productsData[item.productId]?.currentSellingPrice || productsData[item.productId]?.targetHargaJual || 0
      };
    });

    // Sort: show items with stock first
    return result.sort((a, b) => b.currentStock - a.currentStock);
  } catch (error) {
    console.error("Error fetching stock breakdown:", error);
    return [];
  }
}

// Simpan transaksi setoran uang
export async function addSetoranDana(teamId, teamName, amount, metode = "Transfer Bank", catatan = "", customDate = null) {
  const initialStatus = (metode === "Tunai ke Captain" || metode === "Tunai ke Admin Gudang") ? "Menunggu Diterima Captain" : "Menunggu Verifikasi";
  
  let timestampVal = serverTimestamp();
  if (customDate) {
    const parsedDate = new Date(customDate);
    const now = new Date();
    parsedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    timestampVal = Timestamp.fromDate(parsedDate);
  }

  return addDoc(collection(db, "setoran_dana"), {
    teamId,
    teamName,
    nominal: amount,
    metode,
    catatan: catatan || (metode === "Tunai ke Captain" ? "Titip Tunai ke Captain" : "Setoran Transfer"),
    status: initialStatus,
    waktu: timestampVal,
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

export async function getSalesHistory(teamIdOrName) {
  try {
    let q = query(collection(db, "sales_transactions"), where("teamId", "==", teamIdOrName));
    let snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      q = query(collection(db, "sales_transactions"), where("namaSales", "==", teamIdOrName));
      snapshot = await getDocs(q);
    }
    
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
  const teamRef = doc(db, "sales_ledger", teamId);
  const SUMMARY_DOC = doc(db, "summary", "dashboard");
  const docRef = doc(db, "setoran_dana", id);

  return runTransaction(db, async (transaction) => {
    const teamSnap = await transaction.get(teamRef);
    const summarySnap = await transaction.get(SUMMARY_DOC);
    
    if (teamSnap.exists()) {
      transaction.update(teamRef, {
        totalDeposited: (teamSnap.data().totalDeposited || 0) + nominal,
        updatedAt: serverTimestamp()
      });
    }

    if (summarySnap.exists()) {
      const sData = summarySnap.data();
      transaction.update(SUMMARY_DOC, {
        salesReceivables: Math.max(0, (sData.salesReceivables || 0) - nominal),
        // AUTO-JOURNAL: Setoran sales masuk ke kas
        modalAktif: (sData.modalAktif || 0) + nominal,
        updatedAt: serverTimestamp()
      });
    }

    transaction.update(docRef, {
      status: "Diverifikasi Admin",
      updatedAt: serverTimestamp()
    });

    // AUTO-JOURNAL: Catat di finance_ledger
    const teamName = teamSnap.exists() ? teamSnap.data().name || teamId : teamId;
    const logRef = doc(collection(db, "finance_ledger"));
    transaction.set(logRef, {
      tipeBuku: "auto_setoran_sales",
      nominal: nominal,
      keterangan: `[Auto] Terima Setoran dari ${teamName}`,
      relasiId: id,
      isAutoJournal: true,
      createdAt: serverTimestamp()
    });
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
    
    // Kumpulkan ID toko yang MASIH ADA di database
    const activeStoreIds = new Set();
    snapStores.forEach(d => {
      const store = d.data();
      const sid = d.id;
      activeStoreIds.add(sid);
      if (!storeMap[sid]) {
        storeMap[sid] = {
          storeId: sid,
          namaToko: store.namaToko || "Toko",
          latitude: store.latitude || null,
          longitude: store.longitude || null,
          totalDropped: 0,
          products: {}
        };
      } else {
        // Tambahkan koordinat ke entry yang sudah ada dari transaksi
        storeMap[sid].latitude = store.latitude || null;
        storeMap[sid].longitude = store.longitude || null;
      }
    });

    // FILTER: Hapus toko dari storeMap yang sudah tidak ada di retail_stores
    // Ini memastikan toko yang sudah dihapus tidak muncul di riwayat
    for (const sid of Object.keys(storeMap)) {
      if (!activeStoreIds.has(sid)) {
        delete storeMap[sid];
      }
    }

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


export async function captainDistributeStock({ 
  captainId, captainName, targetTeamId, targetTeamName, 
  productId, productName, totalPacks, pricePerPack,
  qtyOriginal, unit 
}) {
  const totalAmount = totalPacks * pricePerPack;
  const targetTeamRef = doc(db, "sales_ledger", targetTeamId);
  const SUMMARY_DOC = doc(db, "summary", "dashboard");

  return runTransaction(db, async (transaction) => {
    const targetTeamSnap = await transaction.get(targetTeamRef);
    const captainSnap = await transaction.get(doc(db, "sales_ledger", captainId));

    // 1. Tambah Hutang/Piutang di Sales Agent yang menerima
    if (targetTeamSnap.exists()) {
      transaction.update(targetTeamRef, {
        goodsDropped: (targetTeamSnap.data().goodsDropped || 0) + totalAmount,
        updatedAt: serverTimestamp()
      });
    }

    // 2. Kurangi Hutang/Piutang dari Captain (Transfer Liabilitas)
    if (captainSnap.exists()) {
      transaction.update(doc(db, "sales_ledger", captainId), {
        goodsDropped: Math.max(0, (captainSnap.data().goodsDropped || 0) - totalAmount),
        updatedAt: serverTimestamp()
      });
    }

    // CATATAN KEUANGAN: 
    // Global SUMMARY_DOC.salesReceivables (Total Piutang) TIDAK BERUBAH.
    // Karena hutang hanya berpindah tangan dari Captain ke Sales Agent.


    const distRef = doc(collection(db, "distributions"));
    transaction.set(distRef, {
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

    const txRef = doc(collection(db, "sales_transactions"));
    transaction.set(txRef, {
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
  });
}

// Ambil setoran tunai yang butuh atensi Captain
export async function getTeamPendingSetoran() {
  const q = query(
    collection(db, "setoran_dana"),
    where("status", "in", ["Menunggu Diterima Captain", "Kas di Captain"])
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
  const SUMMARY_DOC = doc(db, "summary", "dashboard");
  const docRef = doc(db, "setoran_dana", id);

  return runTransaction(db, async (transaction) => {
    const teamSnap = await transaction.get(teamRef);
    const summarySnap = await transaction.get(SUMMARY_DOC);

    if (teamSnap.exists()) {
      transaction.update(teamRef, {
        totalDeposited: (teamSnap.data().totalDeposited || 0) + nominal,
        updatedAt: serverTimestamp()
      });
    }

    if (summarySnap.exists()) {
      transaction.update(SUMMARY_DOC, {
        salesReceivables: Math.max(0, (summarySnap.data().salesReceivables || 0) - nominal),
        updatedAt: serverTimestamp()
      });
    }

    transaction.update(docRef, {
      status: "Diverifikasi Captain",
      updatedAt: serverTimestamp()
    });
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
  const summaryRef = doc(db, "summary", "dashboard");

  // Determine createdAt timestamp
  let createdAtVal = serverTimestamp();
  if (data.tanggal) {
    const parts = data.tanggal.split('-');
    if (parts.length === 3) {
      const now = new Date();
      const customDate = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds()
      );
      createdAtVal = Timestamp.fromDate(customDate);
    }
  }

  if (data.tipeBuku === "bagi_hasil" || data.tipeBuku === "biaya_operasional" || data.tipeBuku === "pengeluaran_lain") {
    await runTransaction(db, async (transaction) => {
      const summarySnap = await transaction.get(summaryRef);
      if (summarySnap.exists()) {
        const sData = summarySnap.data();
        const isBagiHasil = data.tipeBuku === "bagi_hasil";
        const isOps = data.tipeBuku === "biaya_operasional";
        const isPengeluaranLain = data.tipeBuku === "pengeluaran_lain";
        
        const updates = {
          totalBagiHasil: (sData.totalBagiHasil || 0) + (isBagiHasil ? data.nominal : 0),
          totalBiayaOperasional: (sData.totalBiayaOperasional || 0) + (isOps ? data.nominal : 0),
          totalPengeluaranLain: (sData.totalPengeluaranLain || 0) + (isPengeluaranLain ? data.nominal : 0),
          updatedAt: serverTimestamp()
        };

        // Bagi hasil: kurangi sisa laba DAN kas (uang fisik keluar)
        if (isBagiHasil) {
          updates.sisaLabaBelumDibagikan = (sData.sisaLabaBelumDibagikan || 0) - data.nominal;
          updates.modalAktif = Math.max(0, (sData.modalAktif || 0) - data.nominal);
        }

        // Biaya operasional dan Pengeluaran Lain mengurangi kas DAN sisaLabaBelumDibagikan
        if (isOps || isPengeluaranLain) {
          updates.modalAktif = Math.max(0, (sData.modalAktif || 0) - data.nominal);
          updates.sisaLabaBelumDibagikan = (sData.sisaLabaBelumDibagikan || 0) - data.nominal;
        }

        transaction.update(summaryRef, updates);
      }
      const ref = doc(collection(db, "finance_ledger"));
      transaction.set(ref, { ...data, createdAt: createdAtVal });
    });
    await recalculateSummary();
    return;
  }

  // Modal masuk / Pemasukan lain: tambah kas
  if (data.tipeBuku === "modal_masuk" || data.tipeBuku === "pemasukan_lain") {
    await runTransaction(db, async (transaction) => {
      const summarySnap = await transaction.get(summaryRef);
      if (summarySnap.exists()) {
        const sData = summarySnap.data();
        transaction.update(summaryRef, {
          modalAktif: (sData.modalAktif || 0) + data.nominal,
          updatedAt: serverTimestamp()
        });
      }
      const ref = doc(collection(db, "finance_ledger"));
      transaction.set(ref, { ...data, createdAt: createdAtVal });
    });
    await recalculateSummary();
    return;
  }

  await addDoc(collection(db, "finance_ledger"), {
    ...data,
    createdAt: createdAtVal
  });
  await recalculateSummary();
}

export async function deleteFinanceEntry(id, data) {
  if (data?.tipeBuku === "bagi_hasil" || data?.tipeBuku === "biaya_operasional" || data?.tipeBuku === "pengeluaran_lain") {
    await runTransaction(db, async (transaction) => {
      const summaryRef = doc(db, "summary", "dashboard");
      const summarySnap = await transaction.get(summaryRef);
      if (summarySnap.exists()) {
        const sData = summarySnap.data();
        const isBagiHasil = data.tipeBuku === "bagi_hasil";
        const isOps = data.tipeBuku === "biaya_operasional";
        const isPengeluaranLain = data.tipeBuku === "pengeluaran_lain";

        const updates = { updatedAt: serverTimestamp() };
        if (isBagiHasil) updates.totalBagiHasil = (sData.totalBagiHasil || 0) - data.nominal;
        if (isOps) updates.totalBiayaOperasional = (sData.totalBiayaOperasional || 0) - data.nominal;
        if (isPengeluaranLain) updates.totalPengeluaranLain = (sData.totalPengeluaranLain || 0) - data.nominal;
        
        // Bagi hasil: kembalikan sisa laba DAN kas
        if (isBagiHasil) {
          updates.sisaLabaBelumDibagikan = (sData.sisaLabaBelumDibagikan || 0) + data.nominal;
          updates.modalAktif = (sData.modalAktif || 0) + data.nominal;
        }

        // Biaya operasional dan Pengeluaran Lain: kembalikan kas dan sisaLabaBelumDibagikan
        if (isOps || isPengeluaranLain) {
          updates.modalAktif = (sData.modalAktif || 0) + data.nominal;
          updates.sisaLabaBelumDibagikan = (sData.sisaLabaBelumDibagikan || 0) + data.nominal;
        }

        transaction.update(summaryRef, updates);
      }
      transaction.delete(doc(db, "finance_ledger", id));
    });
    await recalculateSummary();
    return;
  }

  if (data?.tipeBuku === "modal_masuk" || data?.tipeBuku === "pemasukan_lain") {
    await runTransaction(db, async (transaction) => {
      const summaryRef = doc(db, "summary", "dashboard");
      const summarySnap = await transaction.get(summaryRef);
      if (summarySnap.exists()) {
        const sData = summarySnap.data();
        transaction.update(summaryRef, {
          modalAktif: Math.max(0, (sData.modalAktif || 0) - data.nominal), // kurangi kas karena dihapus
          updatedAt: serverTimestamp()
        });
      }
      transaction.delete(doc(db, "finance_ledger", id));
    });
    await recalculateSummary();
    return;
  }

  await deleteDoc(doc(db, "finance_ledger", id));
  await recalculateSummary();
}

// Hitung ringkasan keuangan dari ledger
export function calcFinanceSummary(ledger) {
  let totalModal = 0, totalHutang = 0, totalBayarHutang = 0;
  let totalPiutang = 0, totalTerimaPiutang = 0, totalBagiHasil = 0;
  let totalBiayaOperasional = 0;
  let totalPemasukanLain = 0, totalPengeluaranLain = 0;

  ledger.forEach(e => {
    const n = e.nominal || 0;
    switch (e.tipeBuku) {
      case 'modal_masuk': totalModal += n; break;
      case 'hutang_masuk': totalHutang += n; break;
      case 'bayar_hutang': totalBayarHutang += n; break;
      case 'piutang_keluar': totalPiutang += n; break;
      case 'terima_piutang': totalTerimaPiutang += n; break;
      case 'bagi_hasil': totalBagiHasil += n; break;
      case 'biaya_operasional': totalBiayaOperasional += n; break;
      case 'pengeluaran_lain': totalPengeluaranLain += n; break;
      case 'pemasukan_lain': totalPemasukanLain += n; break;
    }
  });

  return {
    totalModal,
    sisaHutang: totalHutang - totalBayarHutang,
    sisaPiutang: totalPiutang - totalTerimaPiutang,
    totalBagiHasil,
    totalBiayaOperasional: totalBiayaOperasional + totalPengeluaranLain,
    totalPemasukanLain,
    totalPengeluaranLain,
  };
}

// ──────────────────────────────────────────────
// ONE-TIME FINANCIAL BASELINE SYNC
// ──────────────────────────────────────────────
export async function syncFinancialBaseline() {
  const SUMMARY_DOC = doc(db, "summary", "dashboard");

  return runTransaction(db, async (transaction) => {
    const summarySnap = await transaction.get(SUMMARY_DOC);
    if (!summarySnap.exists()) throw new Error("Summary doc not found");

    // Hard-set baseline dari audit manual
    transaction.update(SUMMARY_DOC, {
      modalAktif: 72000000,          // Rp 72.000.000
      financeSyncedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Log entry di buku besar
    const logRef = doc(collection(db, "finance_ledger"));
    transaction.set(logRef, {
      tipeBuku: "sync_baseline",
      nominal: 0,
      keterangan: "Sinkronisasi Saldo Awal (Historical PO & Sales) — Modal: Rp 72.000.000",
      isAutoJournal: true,
      isBaseline: true,
      baseline: {
        modalAktif: 72000000
      },
      createdAt: serverTimestamp()
    });
  });
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


export function subscribeAllSalesTransactions(callback) {
  const q = query(collection(db, "sales_transactions"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeAllStoreInventory(callback) {
  const q = query(collection(db, "store_inventory"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ──────────────────────────────────────────────
// MOBILE SALES: AGENT PERFORMANCE
// ──────────────────────────────────────────────
export async function getAgentPerformanceData(teamId, role) {
  try {
    const snapTeam = await getDoc(doc(db, "sales_ledger", teamId));
    const teamData = snapTeam.exists() ? snapTeam.data() : {};
    const claimedRewards = teamData.claimedRewards || 0;

    const qDist = query(collection(db, "distributions"), where("teamId", "==", teamId));
    const snapDist = await getDocs(qDist);
    const distributions = snapDist.docs.map(d => d.data());

    const qTx = query(collection(db, "sales_transactions"), where("teamId", "==", teamId));
    const snapTx = await getDocs(qTx);
    const transactions = snapTx.docs.map(d => d.data());

    const qStores = query(collection(db, "retail_stores"), where("teamId", "==", teamId));
    const snapStores = await getDocs(qStores);
    const registeredStoreIds = new Set(snapStores.docs.map(d => d.id));

    let bawaanNetto = 0;
    let totalTerjual = 0;
    let tokoBinaan = 0;

    const retailDrops = transactions.filter(tx => tx.tipe === 'drop');
    totalTerjual = retailDrops.reduce((s, tx) => s + (tx.jumlahDrop || 0), 0);
    const dropStoreIds = new Set(retailDrops.map(tx => tx.storeId).filter(Boolean));
    tokoBinaan = new Set([...dropStoreIds, ...registeredStoreIds]).size;

    if (role === 'captain') {
      const fromAdmin = distributions.filter(d => d.source !== 'captain');
      const grossReceived = fromAdmin.reduce((s, d) => s + (d.totalPacksDistributed || 0), 0);
      const transferOut = transactions.filter(tx => tx.tipe === 'captain_distribute');
      const totalDioper = transferOut.reduce((s, tx) => s + (tx.jumlahDrop || 0), 0);
      bawaanNetto = Math.max(0, grossReceived - totalDioper);
    } else {
      const fromCaptain = distributions.filter(d => d.source === 'captain');
      bawaanNetto = fromCaptain.reduce((s, d) => s + (d.totalPacksDistributed || 0), 0);
    }

    const sisa = Math.max(0, bawaanNetto - totalTerjual);
    const pct = bawaanNetto > 0 ? (totalTerjual / bawaanNetto) * 100 : 0;

    const totalEarnedPoints = Math.floor(totalTerjual / 10);
    const activePoints = totalEarnedPoints % 200;
    const unclaimedRewards = Math.max(0, Math.floor(totalEarnedPoints / 200) - claimedRewards);

    return { bawaanNetto, totalTerjual, sisa, pct, tokoBinaan, activePoints, unclaimedRewards };
  } catch (err) {
    console.error("Error getAgentPerformanceData:", err);
    return null;
  }
}

// Subscribe ke histori distribusi captain
export function subscribeCaptainDistributions(captainId, callback) {
  if (!captainId) return () => {};
  const q = query(
    collection(db, "distributions"), 
    where("distributedByCaptainId", "==", captainId)
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Filter source === captain just in case, and sort manually descending
    const filtered = list.filter(d => d.source === "captain");
    filtered.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    callback(filtered);
  }, (error) => {
    console.error("Error subscribing to captain distributions:", error);
    callback([]);
  });
}

// Get unified chronological sales ledger book data
export async function getSalesLedgerBookData(teamId) {
  try {
    const qDist = query(collection(db, "distributions"), where("teamId", "==", teamId));
    const qSetor = query(collection(db, "setoran_dana"), where("teamId", "==", teamId));
    const qDep = query(collection(db, "deposits"), where("teamId", "==", teamId));
    const qRet = query(collection(db, "returns"), where("teamId", "==", teamId));

    const [snapDist, snapSetor, snapDep, snapRet] = await Promise.all([
      getDocs(qDist),
      getDocs(qSetor),
      getDocs(qDep),
      getDocs(qRet)
    ]);

    const ledgerItems = [];

    // 1. Distributions (dropping)
    snapDist.forEach(doc => {
      const data = doc.data();
      ledgerItems.push({
        id: doc.id,
        tanggal: data.createdAt || null,
        keterangan: `${data.productName} ${data.qtyOriginal || 0} ${data.unit || 'Pk'}`,
        qty: `${data.qtyOriginal || 0} ${data.unit || 'Pk'}`,
        harga: data.pricePerPack || 0,
        tipe: 'dropping',
        nilai: data.amount || 0,
      });
    });

    // 2. Setoran Dana
    snapSetor.forEach(doc => {
      const data = doc.data();
      if (data.status !== "Menunggu Diterima Captain") {
        ledgerItems.push({
          id: doc.id,
          tanggal: data.waktu || data.createdAt || null,
          keterangan: `Bayar (${data.metode || 'Transfer'})` + (data.catatan ? ` - ${data.catatan}` : ''),
          qty: '',
          harga: '',
          tipe: 'setoran',
          nilai: -Math.abs(data.nominal || 0),
        });
      } else {
        ledgerItems.push({
          id: doc.id,
          tanggal: data.waktu || data.createdAt || null,
          keterangan: `Bayar (${data.metode || 'Transfer'}) [Belum Diterima]`,
          qty: '',
          harga: '',
          tipe: 'setoran_pending',
          nilai: -Math.abs(data.nominal || 0),
        });
      }
    });

    // 3. Deposits (Sistem Lama)
    snapDep.forEach(doc => {
      const data = doc.data();
      ledgerItems.push({
        id: doc.id,
        tanggal: data.createdAt || null,
        keterangan: `Bayar (Sistem Lama)`,
        qty: '',
        harga: '',
        tipe: 'setoran',
        nilai: -Math.abs(data.amount || 0),
      });
    });

    // 4. Returns (Retur)
    snapRet.forEach(doc => {
      const data = doc.data();
      ledgerItems.push({
        id: doc.id,
        tanggal: data.createdAt || null,
        keterangan: `Retur (${data.reason || 'Sisa Tarikan'})`,
        qty: `${data.qtyOriginal || 0} ${data.unit || 'Pk'}`,
        harga: data.hppSnapshot || data.pricePerPack || 0,
        tipe: 'retur',
        nilai: -Math.abs(data.returnAmount || 0),
      });
    });

    // Sort by tanggal ascending
    ledgerItems.sort((a, b) => {
      const timeA = a.tanggal?.toMillis() || 0;
      const timeB = b.tanggal?.toMillis() || 0;
      return timeA - timeB;
    });

    // Compute running balance
    let runningBalance = 0;
    const ledgerWithBalance = ledgerItems.map(item => {
      if (item.tipe !== 'setoran_pending') {
        runningBalance += item.nilai;
      }
      return {
        ...item,
        saldo: runningBalance
      };
    });

    return ledgerWithBalance;
  } catch (error) {
    console.error("Error in getSalesLedgerBookData:", error);
    return [];
  }
}

// Subscribe ke setoran pending untuk Admin Gudang
export function subscribePendingSetoran(callback) {
  const q = query(
    collection(db, "setoran_dana"),
    where("status", "in", ["Menunggu Diterima Captain", "Kas di Captain"])
  );
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => {
      const timeA = a.waktu?.toMillis() || 0;
      const timeB = b.waktu?.toMillis() || 0;
      return timeB - timeA;
    });
    callback(data);
  });
}

// Update distribution date (dropping)
export async function updateDistributionDate(distId, newDateStr) {
  const docRef = doc(db, "distributions", distId);
  const parsedDate = new Date(newDateStr);
  const now = new Date();
  parsedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  const newTimestamp = Timestamp.fromDate(parsedDate);

  await updateDoc(docRef, {
    createdAt: newTimestamp,
    updatedAt: serverTimestamp()
  });
}

// Update deposit/setoran date
export async function updateSetoranDate(setoranId, newDateStr, isOldSystem = false) {
  const parsedDate = new Date(newDateStr);
  const now = new Date();
  parsedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  const newTimestamp = Timestamp.fromDate(parsedDate);

  if (isOldSystem) {
    const docRef = doc(db, "deposits", setoranId);
    await updateDoc(docRef, {
      createdAt: newTimestamp,
      updatedAt: serverTimestamp()
    });
  } else {
    const docRef = doc(db, "setoran_dana", setoranId);
    await updateDoc(docRef, {
      waktu: newTimestamp,
      updatedAt: serverTimestamp()
    });

    // Update finance_ledger entries
    const q = query(collection(db, "finance_ledger"), where("relasiId", "==", setoranId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach(d => {
        batch.update(doc(db, "finance_ledger", d.id), {
          createdAt: newTimestamp,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    }
  }
}

// Delete deposit/setoran transaction
export async function deleteSetoranTransaction(setoranId, data) {
  const { teamId, nominal, status, _collection } = data;
  const isOld = _collection === "deposits";

  // 1. Query finance_ledger entries outside of transaction
  let financeSnap = null;
  if (!isOld) {
    const financeQuery = query(collection(db, "finance_ledger"), where("relasiId", "==", setoranId));
    financeSnap = await getDocs(financeQuery);
  }

  const docRef = doc(db, isOld ? "deposits" : "setoran_dana", setoranId);
  const teamRef = doc(db, "sales_ledger", teamId);
  const SUMMARY_DOC = doc(db, "summary", "dashboard");

  return runTransaction(db, async (transaction) => {
    // 2. Read deposit snapshot to verify it exists
    const depSnap = await transaction.get(docRef);
    if (!depSnap.exists()) return;
    const depData = depSnap.data();
    const finalNominal = depData.nominal || depData.amount || nominal || 0;
    const finalStatus = depData.status || status;

    // 3. Read Summary and Team
    const summarySnap = await transaction.get(SUMMARY_DOC);
    const teamSnap = await transaction.get(teamRef);

    // 4. Revert balances depending on status
    if (isOld || finalStatus === "Diverifikasi Admin" || finalStatus === "Selesai (Sistem Lama)") {
      // Revert team deposited amount
      if (teamSnap.exists()) {
        transaction.update(teamRef, {
          totalDeposited: Math.max(0, (teamSnap.data().totalDeposited || 0) - finalNominal),
          updatedAt: serverTimestamp()
        });
      }
      // Revert dashboard summary
      if (summarySnap.exists()) {
        const sData = summarySnap.data();
        transaction.update(SUMMARY_DOC, {
          salesReceivables: (sData.salesReceivables || 0) + finalNominal,
          modalAktif: Math.max(0, (sData.modalAktif || 0) - finalNominal),
          updatedAt: serverTimestamp()
        });
      }
    } else if (finalStatus === "Diverifikasi Captain") {
      // Diverifikasi Captain only affects teamDeposited and salesReceivables
      if (teamSnap.exists()) {
        transaction.update(teamRef, {
          totalDeposited: Math.max(0, (teamSnap.data().totalDeposited || 0) - finalNominal),
          updatedAt: serverTimestamp()
        });
      }
      if (summarySnap.exists()) {
        const sData = summarySnap.data();
        transaction.update(SUMMARY_DOC, {
          salesReceivables: (sData.salesReceivables || 0) + finalNominal,
          updatedAt: serverTimestamp()
        });
      }
    }

    // 5. Delete finance_ledger entries inside the transaction
    if (financeSnap && !financeSnap.empty) {
      financeSnap.forEach(d => {
        transaction.delete(doc(db, "finance_ledger", d.id));
      });
    }

    // 6. Delete deposit document itself
    transaction.delete(docRef);
  });
}

// Drop goods from multiple PO batches atomically
export async function addGoodsDropTransactionBatch(data) {
  const { teamId, teamName, productId, productName, totalPacksDistributed, amount, items, source } = data;
  const teamRef = doc(db, "sales_ledger", teamId);
  const productRef = doc(db, "products", productId);
  const SUMMARY_DOC = doc(db, "summary", "dashboard");

  return runTransaction(db, async (transaction) => {
    const teamSnap = await transaction.get(teamRef);
    const productSnap = await transaction.get(productRef);
    const summarySnap = await transaction.get(SUMMARY_DOC);

    if (teamSnap.exists()) {
      transaction.update(teamRef, {
        goodsDropped: (teamSnap.data().goodsDropped || 0) + amount,
        updatedAt: serverTimestamp()
      });
    }

    if (productSnap.exists()) {
      transaction.update(productRef, {
        totalPacks: Math.max(0, (productSnap.data().totalPacks || 0) - totalPacksDistributed),
        adminDistributedPacks: (productSnap.data().adminDistributedPacks || 0) + totalPacksDistributed,
        updatedAt: serverTimestamp()
      });
    }

    // Profit calculation: sum of portion profits
    let totalProfit = 0;
    items.forEach(item => {
      const itemProfit = item.amount - (item.totalPacksDistributed * (item.hppSnapshot || 0));
      totalProfit += itemProfit;
    });

    if (summarySnap.exists()) {
      transaction.update(SUMMARY_DOC, {
        salesReceivables: (summarySnap.data().salesReceivables || 0) + amount,
        totalLabaKotor: (summarySnap.data().totalLabaKotor || 0) + totalProfit,
        sisaLabaBelumDibagikan: (summarySnap.data().sisaLabaBelumDibagikan || 0) + totalProfit,
        updatedAt: serverTimestamp()
      });
    }

    // Save each portion distribution document
    items.forEach(item => {
      let finalTimestamp = serverTimestamp();
      if (item.customDate) {
        const parsedDate = new Date(item.customDate);
        const now = new Date();
        parsedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        finalTimestamp = Timestamp.fromDate(parsedDate);
      }

      const distRef = doc(collection(db, "distributions"));
      transaction.set(distRef, {
        teamId,
        teamName,
        productId,
        productName,
        source: source || "",
        poId: item.poId,
        totalPacksDistributed: item.totalPacksDistributed,
        jumlahKarton: item.jumlahKarton,
        amount: item.amount,
        unit: item.unit,
        qtyOriginal: item.qtyOriginal,
        pricePerPack: item.pricePerPack,
        hppSnapshot: item.hppSnapshot,
        createdAt: finalTimestamp
      });
    });
  });
}



