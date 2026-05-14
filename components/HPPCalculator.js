"use client";

import { useState, useMemo } from "react";
import { 
  HiOutlineCalculator, 
  HiOutlineDownload, 
  HiOutlinePlus, 
  HiOutlineTrash,
  HiOutlineInformationCircle
} from "react-icons/hi";
import { formatRupiah } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PMK_97_2024 = {
  "SKM Golongan I": { minHJE: 2375, cukai: 1231 },
  "SKM Golongan II": { minHJE: 1485, cukai: 746 },
  "SPM Golongan I": { minHJE: 2495, cukai: 1336 },
  "SPM Golongan II": { minHJE: 1565, cukai: 794 },
  "SKT/SPT Golongan I (Tier 1)": { minHJE: 2171, cukai: 483 },
  "SKT/SPT Golongan I (Tier 2)": { minHJE: 1555, cukai: 378 },
  "SKT/SPT Golongan II": { minHJE: 995, cukai: 223 },
  "SKT/SPT Golongan III": { minHJE: 860, cukai: 122 },
  "SKTF/SPTF": { minHJE: 2375, cukai: 1231 },
  "KLM Golongan I": { minHJE: 950, cukai: 483 },
  "KLM Golongan II": { minHJE: 200, cukai: 25 },
};

const DEFAULT_COMPONENTS = [
  { id: 1, name: "Etiket / Bungkus", cost: 0 },
  { id: 2, name: "Foil / Kertas Emas", cost: 0 },
  { id: 3, name: "Inner / Box", cost: 0 },
  { id: 4, name: "Opp Slop", cost: 0 },
  { id: 5, name: "Opp Pack", cost: 0 },
  { id: 6, name: "Ongkos Jahit (Per Batang)", cost: 0, isPerStick: true },
  { id: 7, name: "TSG / Bahan Baku (Kgm)", cost: 0 },
];

export default function HPPCalculator() {
  const [selectedType, setSelectedType] = useState("SKM Golongan II");
  const [isiPerPack, setIsiPerPack] = useState(12);
  const [useCustomExcise, setUseCustomExcise] = useState(false);
  const [isiPita, setIsiPita] = useState(12);
  const [hjePerBatang, setHjePerBatang] = useState(PMK_97_2024["SKM Golongan II"].minHJE);
  const [components, setComponents] = useState(DEFAULT_COMPONENTS);
  const [targetProfit, setTargetProfit] = useState(1000);

  // Sync HJE when type changes
  const handleTypeChange = (type) => {
    setSelectedType(type);
    setHjePerBatang(PMK_97_2024[type].minHJE);
  };

  const addComponent = () => {
    const newId = Math.max(0, ...components.map(c => c.id)) + 1;
    setComponents([...components, { id: newId, name: "Lain-lain", cost: 0 }]);
  };

  const removeComponent = (id) => {
    setComponents(components.filter(c => c.id !== id));
  };

  const updateComponent = (id, field, value) => {
    setComponents(components.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const calculations = useMemo(() => {
    const data = PMK_97_2024[selectedType];
    const cukaiPerBatang = data.cukai;
    
    // Tax is calculated based on ISIPITA (official stamp)
    const effectiveIsiPita = useCustomExcise ? (parseInt(isiPita) || 0) : (parseInt(isiPerPack) || 0);
    const totalCukai = cukaiPerBatang * effectiveIsiPita;
    const sppr = Math.ceil(0.1 * totalCukai);
    const ppnHt = Math.ceil(0.099 * (hjePerBatang * effectiveIsiPita));
    const totalSetoranNegara = totalCukai + sppr + ppnHt;

    // Production costs are calculated based on ISIPERPACK (actual physical content)
    const totalHPP = components.reduce((acc, c) => {
      const costRaw = c.isPerStick ? (parseFloat(c.cost) || 0) * (parseInt(isiPerPack) || 0) : (parseFloat(c.cost) || 0);
      return acc + costRaw;
    }, 0);

    const idealPrice = totalHPP + totalSetoranNegara + (parseFloat(targetProfit) || 0);

    return {
      cukaiPerBatang,
      effectiveIsiPita,
      totalCukai,
      sppr,
      ppnHt,
      totalSetoranNegara,
      totalHPP,
      idealPrice
    };
  }, [selectedType, isiPerPack, useCustomExcise, isiPita, hjePerBatang, components, targetProfit]);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const title = `Simulasi HPP Pabrik - ${selectedType} ${useCustomExcise ? '(Non-Resmi)' : ''}`;
      
      doc.setFontSize(18);
      doc.text("DISTRILINK - FACTORY PRICING SIMULATOR", 14, 20);
      doc.setFontSize(10);
      doc.text(title, 14, 30);
      doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 14, 37);

      // Section A
      const paramBody = [
        ['Jenis & Golongan', selectedType],
        ['Isi Riil per Pack', `${isiPerPack} Batang`],
      ];

      if (useCustomExcise) {
        paramBody.push(['Isi Pita Cukai (Pajak)', `${isiPita} Batang`]);
      }

      paramBody.push(
        ['HJE per Batang', formatRupiah(hjePerBatang)],
        ['Tarif Cukai / Batang', formatRupiah(calculations.cukaiPerBatang)]
      );

      autoTable(doc, {
        startY: 45,
        head: [['Parameter Simulasi', 'Nilai']],
        body: paramBody,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] }
      });

      // Section B
      const compBody = components.map(c => [
        c.name, 
        c.isPerStick ? `${formatRupiah(c.cost)}/btg` : formatRupiah(c.cost),
        formatRupiah(c.isPerStick ? c.cost * isiPerPack : c.cost)
      ]);
      
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Komponen Biaya Produksi', 'Satuan', 'Total / Pack']],
        body: compBody,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] }
      });

      // Results
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Ringkasan Kalkulasi', 'Total (Rp)']],
        body: [
          ['Total HPP Produksi', formatRupiah(calculations.totalHPP)],
          [`Cukai (${useCustomExcise ? 'Pita ' + isiPita : 'Pack ' + isiPerPack})`, formatRupiah(calculations.totalCukai)],
          ['Pajak Rokok (SPPR)', formatRupiah(calculations.sppr)],
          ['PPN Hasil Tembakau', formatRupiah(calculations.ppnHt)],
          ['Total Setoran ke Negara', formatRupiah(calculations.totalSetoranNegara)],
          ['Target Laba Pabrik', formatRupiah(targetProfit)],
          [
            { content: 'HARGA JUAL IDEAL KE DISTRIBUTOR', styles: { fontStyle: 'bold', fillColor: [52, 211, 153], textColor: [0, 0, 0] } }, 
            { content: formatRupiah(calculations.idealPrice), styles: { fontStyle: 'bold', fillColor: [52, 211, 153], textColor: [0, 0, 0] } }
          ],
        ],
        theme: 'striped',
      });

      doc.save(`simulasi-hpp-${selectedType.toLowerCase().replace(/[\s\/]+/g, '-')}.pdf`);
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("Gagal mengekspor PDF: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <HiOutlineCalculator size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Simulasi HPP Pabrik</h2>
            <p className="text-xs text-slate-400">Berdasarkan PMK No. 97 Tahun 2024</p>
          </div>
        </div>
        <button 
          type="button"
          onClick={handleExportPDF}
          className="btn-emerald flex items-center gap-2"
        >
          <HiOutlineDownload size={18} />
          <span>Export PDF</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section A: Regulasi */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-emerald-400">A.</span> Parameter Regulasi Cukai
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Jenis & Golongan HT</label>
                <select 
                  value={selectedType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="input-field w-full text-sm"
                >
                  {Object.keys(PMK_97_2024).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Isi Riil per Pack (Batang)</label>
                <input 
                  type="number"
                  value={isiPerPack}
                  onChange={(e) => setIsiPerPack(parseInt(e.target.value) || 0)}
                  className="input-field w-full text-sm font-bold text-blue-400"
                />
              </div>

              <div className="md:col-span-2 pt-2 pb-1">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={useCustomExcise}
                      onChange={(e) => setUseCustomExcise(e.target.checked)}
                    />
                    <div className={`w-10 h-5 rounded-full transition-colors ${useCustomExcise ? 'bg-amber-500' : 'bg-slate-700'}`}></div>
                    <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${useCustomExcise ? 'translate-x-5' : ''}`}></div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-200 transition-colors">
                    Gunakan Pengaturan Pita Kustom (Non-Resmi)
                  </span>
                </label>
              </div>

              {useCustomExcise && (
                <div className="animate-slideDown">
                  <label className="block text-[10px] uppercase font-bold text-amber-500 mb-1.5 underline decoration-amber-500/30 underline-offset-4">Isi Pita Cukai (Official)</label>
                  <input 
                    type="number"
                    value={isiPita}
                    onChange={(e) => setIsiPita(parseInt(e.target.value) || 0)}
                    className="input-field w-full text-sm border-amber-500/50 text-amber-400 bg-amber-500/5"
                  />
                  <p className="text-[9px] text-amber-500/70 mt-1 italic">Pajak dihitung berdasarkan isi pita ini.</p>
                </div>
              )}

              <div className={useCustomExcise ? "" : "md:col-start-1"}>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">HJE per Batang (Rp)</label>
                <input 
                  type="number"
                  value={hjePerBatang}
                  onChange={(e) => setHjePerBatang(parseInt(e.target.value) || 0)}
                  className="input-field w-full text-sm text-emerald-400 font-bold"
                />
                <p className="text-[9px] text-slate-500 mt-1 italic">Min HJE: {formatRupiah(PMK_97_2024[selectedType].minHJE)}</p>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Tarif Cukai / Batang</label>
                <div className="input-field w-full text-sm bg-dark-800 text-slate-400 font-mono">
                  {formatRupiah(calculations.cukaiPerBatang)}
                </div>
              </div>
            </div>
          </div>

          {/* Section B: HPP Components */}
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">B.</span> Komponen Biaya Produksi (HPP)
              </h3>
              <button 
                type="button"
                onClick={addComponent} 
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold"
              >
                <HiOutlinePlus size={14} /> Tambah Item
              </button>
            </div>
            
            <div className="space-y-3">
              {components.map((comp) => (
                <div key={comp.id} className="flex flex-wrap md:flex-nowrap items-center gap-3 bg-dark-800/40 p-3 rounded-xl border border-slate-700/50">
                  <input 
                    type="text" 
                    value={comp.name}
                    onChange={(e) => updateComponent(comp.id, 'name', e.target.value)}
                    className="flex-1 bg-dark-700/30 border-b border-transparent hover:border-slate-600 focus:border-blue-500 text-xs text-slate-200 px-2 py-1.5 rounded-lg transition-all outline-none min-w-[150px]"
                    placeholder="Nama Komponen"
                  />
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-[10px] text-slate-500 font-bold">Rp</span>
                    <input 
                      type="number"
                      value={comp.cost}
                      onChange={(e) => updateComponent(comp.id, 'cost', e.target.value)}
                      className="w-24 bg-dark-700/50 border border-slate-600 rounded-lg px-2 py-1 text-xs text-right outline-none focus:border-blue-500"
                    />
                    <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                      <input 
                        type="checkbox"
                        checked={comp.isPerStick}
                        onChange={(e) => updateComponent(comp.id, 'isPerStick', e.target.checked)}
                        className="w-3 h-3 rounded"
                      />
                      <span className="text-[9px] text-slate-500 uppercase font-bold">/Btg</span>
                    </label>
                  </div>
                  <button onClick={() => removeComponent(comp.id)} className="text-slate-600 hover:text-rose-500 transition-colors">
                    <HiOutlineTrash size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700/50">
              <label className="block text-[10px] uppercase font-bold text-emerald-400 mb-1.5">Target Laba Pabrik (per Pack)</label>
              <div className="relative max-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">Rp</span>
                <input 
                  type="number"
                  value={targetProfit}
                  onChange={(e) => setTargetProfit(e.target.value)}
                  className="input-field w-full pl-9 text-sm font-bold text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Summary Card */}
        <div className="space-y-6">
          <div className="glass-card bg-gradient-to-br from-dark-800 to-dark-900 border-emerald-500/20 shadow-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
            
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
              <HiOutlineInformationCircle className="text-emerald-400" />
              Simulasi Ringkasan
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-700/30 pb-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase">HPP Produksi / Pack</span>
                <span className="text-sm font-mono text-white">{formatRupiah(calculations.totalHPP)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-700/30 pb-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Cukai + Pajak Rokok</span>
                <span className="text-sm font-mono text-white">
                  {formatRupiah(calculations.totalCukai + calculations.sppr)}
                  {useCustomExcise && <span className="text-[9px] text-amber-500 ml-2">(Pita {isiPita})</span>}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-700/30 pb-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase">PPN HT (9.9%)</span>
                <span className="text-sm font-mono text-white">{formatRupiah(calculations.ppnHt)}</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                <span className="text-[10px] text-emerald-400 font-black uppercase">Setoran Negara</span>
                <span className="text-sm font-black text-emerald-400">{formatRupiah(calculations.totalSetoranNegara)}</span>
              </div>

              <div className="pt-6 mt-4">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest text-center mb-2">Harga Jual Ideal ke Distributor</p>
                <div className={`rounded-2xl p-5 text-center shadow-lg ${useCustomExcise ? 'bg-amber-500 text-dark-900 shadow-amber-500/20' : 'bg-emerald-500 text-dark-900 shadow-emerald-500/20'}`}>
                  <p className="text-3xl font-black tracking-tighter">
                    {formatRupiah(calculations.idealPrice)}
                  </p>
                  <p className="text-[10px] font-bold uppercase mt-1 opacity-70">Per Pack ({isiPerPack} Batang {useCustomExcise ? `vs Pita ${isiPita}` : ''})</p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">
                * Estimasi ini tidak bersifat mengikat secara hukum
              </p>
            </div>
          </div>
          
          <div className="glass-card p-4 border-blue-500/20 bg-blue-500/5">
             <p className="text-[10px] text-blue-400 leading-relaxed italic">
               Tips: HJE (Harga Jual Eceran) per Batang adalah patokan pita cukai. Nilai ini harus selalu sama atau lebih besar dari batas minimum regulasi untuk menghindari sanksi administratif.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
