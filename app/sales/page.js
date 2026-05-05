export default function SalesDashboard() {
  return (
    <div className="p-5 animate-fadeIn">
      <header className="mb-8 mt-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">Halo, Sales! 👋</h1>
        <p className="text-sm text-slate-400">Siap mendistribusikan barang hari ini?</p>
      </header>
      
      <div className="space-y-4">
        {/* Widget Stok */}
        <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-6 shadow-xl shadow-emerald-500/5">
          <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Stok Bawaan Anda</h2>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-black text-white leading-none">0</span>
            <span className="text-base font-semibold text-slate-500 pb-1">Pack</span>
          </div>
        </div>

        {/* Placeholder Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-dark-800 border border-slate-800 p-4 rounded-2xl">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center mb-3 text-blue-400">
              📍
            </div>
            <p className="text-xs font-bold text-white">Cari Toko</p>
          </div>
          <div className="bg-dark-800 border border-slate-800 p-4 rounded-2xl">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center mb-3 text-amber-400">
              📦
            </div>
            <p className="text-xs font-bold text-white">Drop Barang</p>
          </div>
        </div>
      </div>
    </div>
  );
}
