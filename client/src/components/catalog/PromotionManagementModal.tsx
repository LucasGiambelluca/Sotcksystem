import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Image, Save, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../supabaseClient';
import { catalogPromotionService } from '../../services/productService';
import type { CatalogPromotion, CatalogItem } from '../../types';

interface PromotionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalogItems: CatalogItem[];
}

export default function PromotionManagementModal({ isOpen, onClose, catalogItems }: PromotionManagementModalProps) {
  const [promotions, setPromotions] = useState<CatalogPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) loadPromotions();
  }, [isOpen]);

  async function loadPromotions() {
    setLoading(true);
    try {
      const data = await catalogPromotionService.getAll(false); // Ver todas
      setPromotions(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar promociones');
    } finally {
      setLoading(false);
    }
  }

  const handleAdd = () => {
    if (promotions.length >= 3) {
      toast.error('Podés tener hasta 3 promociones activas');
      return;
    }
    const newPromo: Partial<CatalogPromotion> = {
      title: 'Nueva Promo',
      description: 'Descripción de la oferta',
      button_text: 'Pedir ahora',
      is_active: true,
      sort_order: (promotions.length + 1) * 10
    };
    setPromotions([...promotions, newPromo as any]);
  };

  const handleChange = (index: number, field: keyof CatalogPromotion, value: any) => {
    const next = [...promotions];
    next[index] = { ...next[index], [field]: value };
    setPromotions(next);
  };

  const handleUploadClick = (index: number) => {
    setUploading(index);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading === null) return;

    try {
      const ext = file.name.split('.').pop();
      const path = `promo_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      handleChange(uploading, 'image_url', data.publicUrl);
      toast.success('Imagen subida');
    } catch (err) {
      console.error(err);
      toast.error('Error al subir imagen');
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const promo of promotions) {
        // Strip out joined data and id from the body
        const { id, catalog_item, created_at, ...payload } = promo as any;
        
        if (id) {
          await catalogPromotionService.update(id, payload);
        } else {
          await catalogPromotionService.create(payload);
        }
      }
      toast.success('Promociones guardadas');
      loadPromotions();
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (index: number) => {
    const promo = promotions[index];
    if (promo.id) {
      try {
        await catalogPromotionService.delete(promo.id);
      } catch (err) {
        toast.error('Error al eliminar');
        return;
      }
    }
    const next = [...promotions];
    next.splice(index, 1);
    setPromotions(next);
    toast.success('Promoción eliminada');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Smartphone className="text-emerald-600" size={24} />
              Gestor de Banners Publicitarios
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Configurá hasta 3 ofertas destacadas para la parte superior del catálogo.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X size={24} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/50">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-emerald-600">Cargando...</div>
          ) : promotions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
              <Image size={64} className="opacity-20" />
              <p className="font-medium">No hay promociones activas</p>
              <button 
                onClick={handleAdd}
                className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition"
              >
                Crear Mi Primera Promo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map((promo, idx) => (
                <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col group">
                  <div 
                    className="relative aspect-[16/9] bg-gray-100 flex items-center justify-center cursor-pointer group-hover:bg-gray-200 transition-colors"
                    onClick={() => handleUploadClick(idx)}
                  >
                    {promo.image_url ? (
                      <img src={promo.image_url} alt="Promo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Image size={32} />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Subir Imagen</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Image size={32} className="text-white" />
                    </div>
                  </div>

                  <div className="p-4 space-y-4 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-emerald-600 tracking-tighter uppercase mb-1">Promo #{idx + 1}</span>
                      <button 
                        onClick={() => handleDelete(idx)}
                        className="text-gray-400 hover:text-red-500 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <input 
                      type="text" 
                      placeholder="Título de la Oferta"
                      value={promo.title}
                      onChange={e => handleChange(idx, 'title', e.target.value)}
                      className="w-full text-sm font-bold bg-transparent border-b border-gray-200 py-1 focus:border-emerald-500 focus:outline-none"
                    />

                    <textarea 
                      placeholder="Descripción corta..."
                      rows={2}
                      value={promo.description || ''}
                      onChange={e => handleChange(idx, 'description', e.target.value)}
                      className="w-full text-xs text-gray-500 bg-transparent border border-gray-100 rounded-lg p-2 focus:border-emerald-500 focus:outline-none resize-none"
                    />

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Producto Relacionado</label>
                      <select 
                        value={promo.target_id || ''}
                        onChange={e => handleChange(idx, 'target_id', e.target.value)}
                        className="w-full text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                      >
                        <option value="">Ninguno (Ver catálogo)</option>
                        {catalogItems.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                       <input 
                        type="text" 
                        placeholder="Texto del Botón"
                        value={promo.button_text}
                        onChange={e => handleChange(idx, 'button_text', e.target.value)}
                        className="flex-1 text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox"
                          checked={promo.is_active}
                          onChange={e => handleChange(idx, 'is_active', e.target.checked)}
                          className="w-4 h-4 accent-emerald-600"
                        />
                        <span className="text-[10px] font-bold text-gray-500">Activa</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {promotions.length < 3 && (
                <button 
                  onClick={handleAdd}
                  className="aspect-[16/9] md:aspect-auto border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-emerald-300 hover:text-emerald-500 transition group"
                >
                  <Plus size={32} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold">Agregar Banner</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center rounded-b-2xl">
          <p className="text-[10px] text-gray-400 max-w-sm">
            💡 <span className="font-bold">ProTip:</span> Usá imágenes de 1200x675px (16:9) para que se vean perfectas tanto en PC como en el cel.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2.5 text-gray-500 font-bold hover:text-gray-700 transition">Cancelar</button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*" 
      />
    </div>
  );
}
