import React, { useState } from 'react';
import { Plus, Pencil, X, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { catalogCategoryService } from '../../services/productService';
import type { CatalogCategory } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  categories: CatalogCategory[];
  onUpdate: () => void;
}

export default function CategoryManagementModal({ isOpen, onClose, categories, onUpdate }: Props) {
  const [editingCat, setEditingCat] = useState<CatalogCategory | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setLoading(true);
    try {
      if (editingCat) {
        await catalogCategoryService.update(editingCat.id, { name: newCatName.trim() });
        toast.success('Categoría actualizada');
      } else {
        await catalogCategoryService.create({ 
          name: newCatName.trim(),
          sort_order: categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 10 : 0,
          is_active: true
        });
        toast.success('Categoría creada');
      }
      setNewCatName('');
      setEditingCat(null);
      onUpdate();
    } catch (err) {
      toast.error('Error al guardar categoría');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cat: CatalogCategory) => {
    setEditingCat(cat);
    setNewCatName(cat.name);
  };

  const handleMove = async (cat: CatalogCategory, direction: 'up' | 'down') => {
    const currentIndex = categories.findIndex(c => c.id === cat.id);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;

    const reordered = [...categories];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(newIndex, 0, moved);

    try {
      // Update all orders sequentially
      const updates = reordered.map((c, idx) => 
        catalogCategoryService.update(c.id, { sort_order: (idx + 1) * 10 })
      );
      await Promise.all(updates);
      toast.success('Orden de categorías actualizado');
      onUpdate();
    } catch (err) {
      toast.error('Error al reordenar categorías');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Gestionar Categorías
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nueva categoría..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-primary-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {editingCat ? <Pencil size={20} /> : <Plus size={20} />}
            </button>
            {editingCat && (
              <button
                type="button"
                onClick={() => { setEditingCat(null); setNewCatName(''); }}
                className="bg-gray-100 text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </form>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
            {categories.map((cat, idx) => (
              <div key={cat.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                <div className="flex flex-col -space-y-1">
                  <button 
                    onClick={() => handleMove(cat, 'up')}
                    disabled={idx === 0}
                    className="p-1 text-gray-300 hover:text-primary-600 disabled:opacity-20"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button 
                    onClick={() => handleMove(cat, 'down')}
                    disabled={idx === categories.length - 1}
                    className="p-1 text-gray-300 hover:text-primary-600 disabled:opacity-20"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <span className="flex-1 font-medium text-gray-700">{cat.name}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(cat)} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-white rounded-lg transition-colors">
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-center text-gray-400 italic py-4">No hay categorías definidas</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
