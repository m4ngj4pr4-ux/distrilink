"use client";

import { useState, useEffect } from "react";
import { HiOutlineX, HiOutlineCloudUpload, HiOutlineSave } from "react-icons/hi";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { updateProduct } from "@/lib/firestore";
import toast from "react-hot-toast";

export default function EditProductModal({ product, isOpen, onClose }) {
  const [form, setForm] = useState({
    name: "",
    packsPerSlop: "",
    slopsPerBall: "",
    ballsPerKarton: "",
    imageUrl: ""
  });
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || "",
        packsPerSlop: product.packsPerSlop || "",
        slopsPerBall: product.slopsPerBall || "",
        ballsPerKarton: product.ballsPerKarton || "",
        imageUrl: product.imageUrl || ""
      });
      setImageFile(null);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  async function handleUpdate() {
    if (!form.name.trim()) return toast.error("Nama produk wajib diisi");
    
    setSaving(true);
    let finalImageUrl = form.imageUrl;

    // Upload jika ada file baru
    if (imageFile) {
      toast.loading("Mengunggah foto baru...", { id: "editUploadToast" });
      try {
        const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        finalImageUrl = await getDownloadURL(snapshot.ref);
        toast.dismiss("editUploadToast");
      } catch (err) {
        toast.dismiss("editUploadToast");
        setSaving(false);
        return toast.error("Gagal mengunggah foto: " + err.message);
      }
    }

    try {
      await updateProduct(product.id, {
        name: form.name.trim(),
        packsPerSlop: parseInt(form.packsPerSlop),
        slopsPerBall: parseInt(form.slopsPerBall),
        ballsPerKarton: parseInt(form.ballsPerKarton),
        imageUrl: finalImageUrl
      });
      toast.success("Produk berhasil diperbarui!");
      onClose();
    } catch (err) {
      toast.error("Gagal memperbarui: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay z-[150]" onClick={onClose}>
      <div className="modal-content max-w-md animate-zoomIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
            Edit Produk
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <HiOutlineX size={22} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Nama Produk</label>
            <input 
              type="text" 
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})}
              className="input-field" 
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Pack/Slop</label>
              <input type="number" value={form.packsPerSlop} onChange={e => setForm({...form, packsPerSlop: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Slop/Ball</label>
              <input type="number" value={form.slopsPerBall} onChange={e => setForm({...form, slopsPerBall: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Ball/Karton</label>
              <input type="number" value={form.ballsPerKarton} onChange={e => setForm({...form, ballsPerKarton: e.target.value})} className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Update Foto Produk (Optional)</label>
            <div className="relative group">
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => setImageFile(e.target.files[0])} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="p-4 rounded-xl border-2 border-dashed border-slate-700 bg-dark-800 flex flex-col items-center justify-center gap-2 group-hover:border-emerald-500/50 transition-colors">
                <HiOutlineCloudUpload size={24} className="text-slate-500 group-hover:text-emerald-400" />
                <span className="text-xs text-slate-500 group-hover:text-slate-300">
                  {imageFile ? imageFile.name : "Klik untuk ganti foto"}
                </span>
              </div>
            </div>
            {form.imageUrl && !imageFile && (
              <p className="text-[10px] text-emerald-400/70 mt-2 text-center italic">Produk sudah memiliki foto</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="btn-ghost flex-1">Batal</button>
            <button 
              onClick={handleUpdate} 
              disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <HiOutlineSave size={18} />
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
