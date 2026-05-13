import { useEffect, useState } from "react";
import { HiOutlineShieldCheck, HiOutlineRefresh, HiDatabase, HiOutlineExclamation, HiOutlineX, HiOutlineUserAdd, HiOutlineTrash, HiOutlinePencilAlt, HiOutlineEye, HiOutlineEyeOff } from "react-icons/hi";
import { factoryResetDatabase, subscribeAdminUsers, addAdminUser, updateAdminUser, deleteAdminUser } from "@/lib/firestore";
import { useAdminAuth } from "@/lib/AdminAuthContext";
import toast from "react-hot-toast";

export default function Settings({ onRecalculate, isRecalculating }) {
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  
  const { adminUser } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ email: "", password: "", nama: "", role: "admin" });
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (adminUser?.role === "owner") {
      const unsub = subscribeAdminUsers(setUsers);
      return () => unsub();
    }
  }, [adminUser]);

  async function handleFactoryReset() {
    if (confirmText !== "HAPUS") return;
    setIsResetting(true);
    try {
      await factoryResetDatabase();
      toast.success("DATABASE BERHASIL DIKOSONGKAN TOTAL!");
      setShowResetModal(false);
      setConfirmText("");
      if (onRecalculate) await onRecalculate();
    } catch (err) {
      toast.error("Gagal mereset: " + err.message);
    } finally {
      setIsResetting(false);
    }
  }

  const openAddUser = () => {
    setEditingUser(null);
    setUserForm({ email: "", password: "", nama: "", role: "admin" });
    setShowUserModal(true);
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setUserForm({ email: user.email, password: user.password, nama: user.nama, role: user.role });
    setShowUserModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsSavingUser(true);
    try {
      if (editingUser) {
        await updateAdminUser(editingUser.id, userForm);
        toast.success("User berhasil diperbarui!");
      } else {
        await addAdminUser(userForm);
        toast.success("User baru berhasil ditambahkan!");
      }
      setShowUserModal(false);
    } catch (error) {
      toast.error("Gagal menyimpan user.");
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (confirm("Hapus user ini?")) {
      try {
        await deleteAdminUser(userId);
        toast.success("User berhasil dihapus.");
      } catch (error) {
        toast.error("Gagal menghapus user.");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* CARD 0: USER MANAGEMENT (Owner Only) */}
      {adminUser?.role === "owner" && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <HiOutlineUserAdd size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Manajemen User Admin</h2>
                <p className="text-xs text-slate-400">Kelola hak akses Owner, Admin, dan Investor</p>
              </div>
            </div>
            <button 
              onClick={openAddUser}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
            >
              + Tambah User
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/5">
                  <th className="py-3 px-2 font-semibold">Nama</th>
                  <th className="py-3 px-2 font-semibold">Email</th>
                  <th className="py-3 px-2 font-semibold">Role</th>
                  <th className="py-3 px-2 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-400/5">
                {users.map((user) => (
                  <tr key={user.id} className="text-xs hover:bg-white/5 transition-colors group">
                    <td className="py-3 px-2 text-white font-medium">{user.nama}</td>
                    <td className="py-3 px-2 text-slate-400">{user.email}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        user.role === 'owner' ? 'bg-amber-500/10 text-amber-500' : 
                        user.role === 'admin' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex justify-end gap-1 transition-opacity">
                        <button onClick={() => openEditUser(user)} className="p-1.5 rounded hover:bg-blue-500/10 text-blue-400"><HiOutlinePencilAlt size={16} /></button>
                        {user.role !== 'owner' && (
                          <button onClick={() => handleDeleteUser(user.id)} className="p-1.5 rounded hover:bg-rose-500/10 text-rose-400"><HiOutlineTrash size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARD 1: REKONSILIASI */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <HiOutlineShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Sistem & Keamanan</h2>
            <p className="text-xs text-slate-400">Sinkronisasi ulang saldo dan database</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-dark-800/50 border border-slate-400/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">Sinkronisasi Ulang Saldo</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gunakan fitur ini jika angka pada dashboard tidak sesuai dengan total transaksi. 
              Sistem akan menghitung ulang seluruh saldo Piutang, Hutang, dan Aset secara manual.
            </p>
          </div>
          <button 
            onClick={onRecalculate}
            disabled={isRecalculating || isResetting}
            className="w-full sm:w-auto flex-shrink-0 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <HiOutlineRefresh className={isRecalculating ? "animate-spin" : ""} size={18} />
            {isRecalculating ? "Memproses..." : "Sinkron Sekarang"}
          </button>
        </div>
      </div>

      {/* CARD 2: DANGER ZONE */}
      <div className="glass-card p-6 border border-rose-500/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
            <HiDatabase size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-rose-400">Zona Berbahaya (Danger Zone)</h2>
            <p className="text-xs text-rose-400/70">Tindakan ini tidak dapat dibatalkan</p>
          </div>
        </div>
        
        <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">Factory Reset (Kosongkan Database)</h3>
            <p className="text-xs text-rose-400/80 leading-relaxed">
              Hapus SELURUH data produk, PO pabrik, stok, tim sales, dan riwayat transaksi. 
            </p>
          </div>
          <button 
            onClick={() => setShowResetModal(true)}
            disabled={isResetting || isRecalculating}
            className="w-full sm:w-auto flex-shrink-0 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50"
          >
            Hapus Semua Data
          </button>
        </div>
      </div>

      {/* MODAL USER (Add/Edit) */}
      {showUserModal && (
        <div className="modal-overlay z-[9999]" onClick={() => setShowUserModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{editingUser ? "Edit User" : "Tambah User Baru"}</h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-500 hover:text-white"><HiOutlineX size={20}/></button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nama Lengkap</label>
                <input type="text" required value={userForm.nama} onChange={(e) => setUserForm({...userForm, nama: e.target.value})} className="input-field w-full" placeholder="Contoh: Budi Santoso" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Email Address</label>
                <input type="email" required value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} className="input-field w-full" placeholder="email@distrilink.com" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required={!editingUser} 
                    value={userForm.password} 
                    onChange={(e) => setUserForm({...userForm, password: e.target.value})} 
                    className="input-field w-full pr-10" 
                    placeholder="••••••••" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Role Akses</label>
                <select value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value})} className="input-field w-full">
                  <option value="admin">Admin Operasional</option>
                  <option value="investor">Investor (Read-only Finance)</option>
                  {editingUser?.role === 'owner' && <option value="owner">Owner</option>}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 py-3 text-slate-400 font-bold">Batal</button>
                <button type="submit" disabled={isSavingUser} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50">
                  {isSavingUser ? "Menyimpan..." : "Simpan User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI RESET */}
      {showResetModal && (
        <div className="modal-overlay z-[9999]" onClick={() => setShowResetModal(false)}>
          <div className="modal-content max-w-md border border-rose-500/30" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-500">
                  <HiOutlineExclamation size={24} />
                </div>
                <h3 className="text-lg font-bold text-white">Konfirmasi Reset</h3>
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-slate-500 hover:text-white"><HiOutlineX size={20}/></button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Anda akan menghapus <span className="text-rose-400 font-bold underline">seluruh data aplikasi</span>. Tindakan ini permanen dan tidak dapat dipulihkan.
              </p>
              
              <div className="bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                <p className="text-[11px] text-rose-400 font-medium uppercase mb-2">Ketik kata kunci di bawah untuk melanjutkan:</p>
                <p className="text-xl font-black text-white tracking-widest text-center mb-3 select-none">HAPUS</p>
                <input 
                  type="text" 
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Ketik di sini..."
                  className="input-field w-full text-center border-rose-500/30 focus:border-rose-500"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={handleFactoryReset}
                  disabled={confirmText !== "HAPUS" || isResetting}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isResetting ? "Menghapus Database..." : "Ya, Hapus Semua Data"}
                </button>
                <button 
                  onClick={() => setShowResetModal(false)}
                  className="w-full py-3 text-sm text-slate-400 hover:text-white font-medium"
                >
                  Batalkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

