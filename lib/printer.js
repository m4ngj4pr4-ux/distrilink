/**
 * DistriLink Bluetooth Thermal Printer Utility
 * Uses Web Bluetooth API and ESC/POS commands
 */

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

export const PRINTER_COMMANDS = {
  RESET: [ESC, 0x40],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT_ON: [ESC, 0x21, 0x10],
  DOUBLE_WIDTH_ON: [ESC, 0x21, 0x20],
  TEXT_NORMAL: [ESC, 0x21, 0x00],
  LINE_FEED: [LF],
};

class PrinterService {
  constructor() {
    this.device = null;
    this.characteristic = null;
    this.encoder = new TextEncoder();
  }

  async connect() {
    try {
      // Standard Printer Service UUIDs
      const serviceUuid = '000018f0-0000-1000-8000-00805f9b34fb';
      
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [serviceUuid] }],
        optionalServices: [serviceUuid]
      });

      const server = await this.device.gatt.connect();
      const service = await server.getPrimaryService(serviceUuid);
      const characteristics = await service.getCharacteristics();
      
      // Find the first characteristic that supports 'write'
      this.characteristic = characteristics.find(c => 
        c.properties.write || c.properties.writeWithoutResponse
      );

      if (!this.characteristic) {
        throw new Error("Karakteristik penulisan tidak ditemukan pada printer.");
      }

      return this.device.name;
    } catch (error) {
      console.error("Bluetooth Connection Error:", error);
      throw error;
    }
  }

  async printRaw(data) {
    if (!this.characteristic) throw new Error("Printer belum terhubung.");
    
    // Split data into chunks to avoid MTU limits (usually 20 bytes)
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await this.characteristic.writeValue(chunk);
    }
  }

  formatReceipt(transaction) {
    const { namaToko, waktu, namaSales, productName, jumlahDrop, hargaJual, total } = transaction;
    const dateStr = waktu?.toDate ? waktu.toDate().toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
    
    const buffer = [];
    const add = (arr) => buffer.push(...arr);
    const addStr = (str) => buffer.push(...this.encoder.encode(str));

    // Initialize
    add(PRINTER_COMMANDS.RESET);
    
    // Header
    add(PRINTER_COMMANDS.ALIGN_CENTER);
    add(PRINTER_COMMANDS.BOLD_ON);
    add(PRINTER_COMMANDS.DOUBLE_HEIGHT_ON);
    addStr("DISTRILINK\n");
    add(PRINTER_COMMANDS.TEXT_NORMAL);
    add(PRINTER_COMMANDS.BOLD_OFF);
    addStr("================================\n"); 
    
    // Info
    add(PRINTER_COMMANDS.ALIGN_LEFT);
    addStr(`Toko : ${namaToko.substring(0, 24)}\n`);
    addStr(`Tgl  : ${dateStr}\n`);
    addStr(`Sls  : ${namaSales.substring(0, 24)}\n`);
    add(PRINTER_COMMANDS.ALIGN_CENTER);
    addStr("--------------------------------\n");

    // Items
    add(PRINTER_COMMANDS.ALIGN_LEFT);
    
    // Item Detail (Two-Line Format)
    const priceFormatted = (hargaJual || 0).toLocaleString('id-ID');
    const subtotalFormatted = (total || (jumlahDrop * (hargaJual || 0))).toLocaleString('id-ID');
    
    // Line 1: Nama Produk
    addStr(`${productName}\n`);
    
    // Line 2: Qty x Harga [RIGHT] Subtotal
    const leftPart = `${jumlahDrop} x ${priceFormatted}`;
    const rightPart = subtotalFormatted;
    const spacesNeeded = 32 - leftPart.length - rightPart.length;
    const spaces = " ".repeat(Math.max(1, spacesNeeded));
    addStr(`${leftPart}${spaces}${rightPart}\n`);

    add(PRINTER_COMMANDS.ALIGN_CENTER);
    addStr("--------------------------------\n");

    // Total
    add(PRINTER_COMMANDS.ALIGN_LEFT);
    add(PRINTER_COMMANDS.BOLD_ON);
    const totalLabel = "TOTAL TAGIHAN";
    const totalVal = (total || (jumlahDrop * (hargaJual || 0))).toLocaleString('id-ID');
    const totalSpaces = 32 - totalLabel.length - totalVal.length;
    addStr(`${totalLabel}${" ".repeat(Math.max(1, totalSpaces))}${totalVal}\n`);
    add(PRINTER_COMMANDS.BOLD_OFF);
    
    add(PRINTER_COMMANDS.ALIGN_CENTER);
    addStr("================================\n");
    addStr("Terima kasih Bosku!\n");
    addStr("Semoga dagangannya makin laris\n");
    addStr("manis & berkah selalu.\n");
    
    // Feed and Cut
    addStr("\n\n\n\n");
    
    return new Uint8Array(buffer);
  }

  async printReceipt(transaction) {
    const data = this.formatReceipt(transaction);
    await this.printRaw(data);
  }

  formatMultiItemReceipt(receiptData) {
    const { namaToko, waktu, namaSales, receiptId, items, grandTotal } = receiptData;
    const dateStr = waktu?.toDate ? waktu.toDate().toLocaleString('id-ID') : new Date(waktu).toLocaleString('id-ID');
    
    const buffer = [];
    const add = (arr) => buffer.push(...arr);
    const addStr = (str) => buffer.push(...this.encoder.encode(str));

    // Initialize
    add(PRINTER_COMMANDS.RESET);
    
    // Header
    add(PRINTER_COMMANDS.ALIGN_CENTER);
    add(PRINTER_COMMANDS.BOLD_ON);
    add(PRINTER_COMMANDS.DOUBLE_HEIGHT_ON);
    addStr("DISTRILINK\n");
    add(PRINTER_COMMANDS.TEXT_NORMAL);
    add(PRINTER_COMMANDS.BOLD_OFF);
    addStr("================================\n"); 
    
    // Info
    add(PRINTER_COMMANDS.ALIGN_LEFT);
    addStr(`Nota : ${receiptId}\n`);
    addStr(`Toko : ${namaToko.substring(0, 24)}\n`);
    addStr(`Tgl  : ${dateStr}\n`);
    addStr(`Sls  : ${namaSales.substring(0, 24)}\n`);
    add(PRINTER_COMMANDS.ALIGN_CENTER);
    addStr("--------------------------------\n");

    // Items
    add(PRINTER_COMMANDS.ALIGN_LEFT);
    
    let totalQty = 0;
    items.forEach(item => {
      const priceFormatted = (item.hargaJual || 0).toLocaleString('id-ID');
      const subtotalFormatted = (item.total || (item.jumlahDrop * (item.hargaJual || 0))).toLocaleString('id-ID');
      totalQty += item.jumlahDrop;
      
      // Line 1: Nama Produk
      addStr(`${item.productName}\n`);
      
      // Line 2: Qty x Harga [RIGHT] Subtotal
      const leftPart = `${item.jumlahDrop} Pk x ${priceFormatted}`;
      const rightPart = subtotalFormatted;
      const spacesNeeded = 32 - leftPart.length - rightPart.length;
      const spaces = " ".repeat(Math.max(1, spacesNeeded));
      addStr(`${leftPart}${spaces}${rightPart}\n`);
    });

    add(PRINTER_COMMANDS.ALIGN_CENTER);
    addStr("--------------------------------\n");

    // Total
    add(PRINTER_COMMANDS.ALIGN_LEFT);
    add(PRINTER_COMMANDS.BOLD_ON);
    
    const qtyLabel = `TOTAL BARANG`;
    const qtyVal = `${totalQty} Pk`;
    const qtySpaces = 32 - qtyLabel.length - qtyVal.length;
    addStr(`${qtyLabel}${" ".repeat(Math.max(1, qtySpaces))}${qtyVal}\n`);

    const totalLabel = "GRAND TOTAL";
    const totalVal = `Rp ${grandTotal.toLocaleString('id-ID')}`;
    const totalSpaces = 32 - totalLabel.length - totalVal.length;
    addStr(`${totalLabel}${" ".repeat(Math.max(1, totalSpaces))}${totalVal}\n`);
    add(PRINTER_COMMANDS.BOLD_OFF);
    
    add(PRINTER_COMMANDS.ALIGN_CENTER);
    addStr("================================\n");
    addStr("Terima kasih Bosku!\n");
    addStr("Semoga dagangannya makin laris\n");
    addStr("manis & berkah selalu.\n");
    
    // Feed and Cut
    addStr("\n\n\n\n");
    
    return new Uint8Array(buffer);
  }

  async printMultiItemReceipt(receiptData) {
    const data = this.formatMultiItemReceipt(receiptData);
    await this.printRaw(data);
  }
}

export const printer = new PrinterService();
