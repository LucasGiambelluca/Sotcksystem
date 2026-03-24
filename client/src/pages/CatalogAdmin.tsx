import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, X, ShoppingBag, Filter, ArrowUpDown, Image, EyeOff, Eye, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import type { CatalogItem, Station, RecipeComponent } from '../types';
import { stationService } from '../services/stationService';
import { recipeComponentService } from '../services/recipeComponentService';
import { catalogItemService } from '../services/productService';
import ExportButtons from '../components/ExportButtons';
import Pagination from '../components/common/Pagination';

export default function CatalogAdmin() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);

  // Recipe components state
  const [components, setComponents] = useState<RecipeComponent[]>([]);
  const [newCompName, setNewCompName] = useState('');
  const [newCompStationId, setNewCompStationId] = useState('');
  const [isMassUpdateModalOpen, setIsMassUpdateModalOpen] = useState(false);
  const [massAmount, setMassAmount] = useState<number>(0);
  const [massType, setMassType] = useState<'percentage' | 'fixed'>('percentage');
  const [massCategory, setMassCategory] = useState<string>('');
  const [massLoading, setMassLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: '',
    image_url_1: '' as string | null,
    image_url_2: '' as string | null,
    station_id: '' as string,
    is_active: true,
    is_special: false,
    special_price: undefined as number | undefined,
    offer_label: '' as string,
  });

  const img1Ref = useRef<HTMLInputElement>(null);
  const img2Ref = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  useEffect(() => { loadItems(); loadStations(); }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

  const loadItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*, station:stations(id, name, color)')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) {
      toast.error('Error al cargar el catálogo');
      console.error(error);
    } else {
      setItems(data as CatalogItem[]);
    }
    setLoading(false);
  };

  const loadStations = async () => {
    try {
      const sts = await stationService.getAll();
      setStations(sts);
    } catch (err) {
      console.error('Error loading stations', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      description: formData.description || null,
      price: Number(formData.price),
      stock: Number(formData.stock),
      category: formData.category || 'General',
      image_url_1: formData.image_url_1 || null,
      image_url_2: formData.image_url_2 || null,
      station_id: formData.station_id || null,
      is_active: formData.is_active,
    };

    if (editingItem) {
      const { error } = await supabase.from('catalog_items').update({ 
        ...payload, 
        is_special: formData.is_special,
        special_price: formData.is_special ? (Number(formData.special_price) || null) : null,
        offer_label: formData.is_special ? (formData.offer_label || null) : null,
        updated_at: new Date().toISOString() 
      }).eq('id', editingItem.id);
      if (error) { toast.error('Error al actualizar'); console.error(error); return; }
      toast.success('Ítem actualizado');
    } else {
      // Get max sort_order to put it at the end
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order || 0)) : 0;
      const { error } = await supabase.from('catalog_items').insert({
        ...payload,
        is_special: formData.is_special,
        special_price: formData.is_special ? (Number(formData.special_price) || null) : null,
        offer_label: formData.is_special ? (formData.offer_label || null) : null,
        sort_order: maxOrder + 1
      });
      if (error) { toast.error('Error al crear el ítem'); console.error(error); return; }
      toast.success('Ítem creado');
    }
    closeModal();
    loadItems();
  };

  const handleDelete = (id: string, name: string) => {
    toast(`¿Eliminar "${name}" del catálogo?`, {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          const { error } = await supabase.from('catalog_items').delete().eq('id', id);
          if (error) { toast.error('Error al eliminar'); return; }
          toast.success('Ítem eliminado');
          loadItems();
        }
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const toggleActive = async (item: CatalogItem) => {
    const { error } = await supabase.from('catalog_items').update({ is_active: !item.is_active, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (error) { toast.error('Error al cambiar estado'); return; }
    toast.success(item.is_active ? 'Ítem desactivado del catálogo' : 'Ítem activado en el catálogo');
    loadItems();
  };

  const openModal = (item?: CatalogItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        price: item.price,
        stock: item.stock,
        category: item.category || '',
        image_url_1: item.image_url_1 || '',
        image_url_2: item.image_url_2 || '',
        station_id: item.station_id || '',
        is_active: item.is_active,
        is_special: item.is_special || false,
        special_price: item.special_price || undefined,
        offer_label: item.offer_label || '',
      });
      // Load recipe components for this item
      recipeComponentService.getByItem(item.id).then(comps => setComponents(comps)).catch(console.error);
    } else {
      setEditingItem(null);
      setFormData({ name: '', description: '', price: 0, stock: 0, category: '', image_url_1: '', image_url_2: '', station_id: '', is_active: true, is_special: false, special_price: undefined, offer_label: '' });
      setComponents([]);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({ 
      name: '', 
      description: '', 
      price: 0, 
      stock: 0, 
      category: '', 
      image_url_1: '', 
      image_url_2: '', 
      station_id: '', 
      is_active: true,
      is_special: false,
      special_price: undefined,
      offer_label: ''
    });
    setComponents([]);
    setNewCompName('');
    setNewCompStationId('');
  };

  const handleMassiveUpdate = async () => {
    if (massAmount === 0) { toast.error('Ingresá un valor distinto de cero'); return; }
    setMassLoading(true);
    try {
      const { error } = await supabase.rpc('update_catalog_prices_v2', { 
        p_percentage: massType === 'percentage' ? massAmount : 0,
        p_fixed_amount: massType === 'fixed' ? massAmount : 0,
        p_category: massCategory || null
      });
      if (error) throw error;
      
      const isIncrease = massAmount > 0;
      const label = massType === 'percentage' 
        ? (isIncrease ? `+${massAmount}%` : `${massAmount}%`)
        : (isIncrease ? `+$${massAmount.toLocaleString()}` : `-$${Math.abs(massAmount).toLocaleString()}`);
      
      const actionLabel = isIncrease ? 'Aumentados' : 'Rebajados';
      const catLabel = massCategory ? ` en ${massCategory}` : ' en todo el catálogo';
      toast.success(`${actionLabel} con éxito (${label})${catLabel}`);
      
      setIsMassUpdateModalOpen(false);
      setMassAmount(0);
      setMassCategory('');
      loadItems();
    } catch (err: any) {
      console.error(err);
      toast.error('Error en la actualización masiva: ' + err.message);
    } finally {
      setMassLoading(false);
    }
  };

  const handleAddComponent = async () => {
    if (!editingItem || !newCompName.trim() || !newCompStationId) { toast.error('Completá nombre y estación'); return; }
    try {
      const comp = await recipeComponentService.create({
        catalog_item_id: editingItem.id,
        name: newCompName.trim(),
        station_id: newCompStationId,
        sort_order: components.length,
      });
      setComponents(prev => [...prev, comp]);
      setNewCompName('');
      setNewCompStationId('');
      toast.success('Componente agregado');
    } catch (err) {
      console.error(err);
      toast.error('Error al agregar componente');
    }
  };

  const handleRemoveComponent = async (comp: RecipeComponent) => {
    try {
      await recipeComponentService.remove(comp.id);
      setComponents(prev => prev.filter(c => c.id !== comp.id));
      toast.success('Componente eliminado');
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar componente');
    }
  };

  const handleMove = async (item: CatalogItem, direction: 'up' | 'down') => {
    const currentIndex = items.findIndex(i => i.id === item.id);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    // Create a new version of the full list with the item moved
    const newItems = [...items];
    const [movedItem] = newItems.splice(currentIndex, 1);
    newItems.splice(newIndex, 0, movedItem);

    // Re-assign sort_order to EVERYONE sequentially (10, 20, 30...)
    // This ensures that even if they all had 0, they now have distinct values.
    const updates = newItems.map((it, idx) => ({
      id: it.id,
      sort_order: (idx + 1) * 10
    }));

    try {
      // Optimistic update
      setItems(newItems.map((it, idx) => ({ ...it, sort_order: (idx + 1) * 10 })));
      
      await catalogItemService.updateAllOrders(updates);
      toast.success('Orden actualizado');
    } catch (err) {
      console.error('Error swapping order', err);
      toast.error('Error al cambiar el orden');
      // Revert on error
      loadItems();
    }
  };

  async function uploadImage(file: File, slot: 1 | 2, tempId: string) {
    setUploadingImg(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `catalog_${tempId}_${slot}.${ext}`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      setFormData(prev => ({ ...prev, [`image_url_${slot}`]: data.publicUrl }));
      toast.success(`Imagen ${slot} subida`);
    } catch (err) {
      toast.error('Error al subir la imagen');
    } finally {
      setUploadingImg(false);
    }
  }

  const filtered = items.filter(item =>
    (categoryFilter === '' || item.category === categoryFilter) &&
    (searchTerm === '' || item.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean))) as string[];

  if (loading) return <div className="p-8 flex justify-center text-primary-600">Cargando catálogo de ventas...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="text-emerald-600" size={28} />
            Catálogo de Ventas
          </h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">
            Productos elaborados que el cliente puede pedir (pizza, pollo a la parrilla, etc.)
          </p>
          <p className="text-xs text-amber-600 mt-1 font-medium bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg inline-block">
            ⚡ Separado del Inventario de Insumos · El bot de WhatsApp usa este catálogo
          </p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full md:w-auto">
          <ExportButtons
            data={filtered}
            filename="catalogo-ventas"
            columns={[
              { header: 'Nombre', key: 'name' },
              { header: 'Categoría', key: 'category' },
              { header: 'Precio', key: 'price' },
              { header: 'Stock', key: 'stock' },
              { header: 'Activo', key: 'is_active' },
              { header: 'Descripción', key: 'description' }
            ]}
          />
          <a
            href="/elpollocomilon/catalog"
            target="_blank"
            rel="noreferrer"
            className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl flex items-center justify-center space-x-2 hover:bg-emerald-700 shadow transition w-full sm:w-auto"
          >
            <ShoppingBag size={18} />
            <span className="font-medium">Ver Catálogo Público</span>
          </a>
          <button
            onClick={() => openModal()}
            className="bg-primary-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center space-x-2 hover:bg-primary-700 shadow-lg shadow-primary-900/20 transition-all w-full sm:w-auto"
          >
            <Plus size={20} />
            <span className="font-medium">Nuevo Ítem</span>
          </button>
          <button
            onClick={() => setIsMassUpdateModalOpen(true)}
            className="bg-amber-100 text-amber-700 px-5 py-2.5 rounded-xl flex items-center justify-center space-x-2 hover:bg-amber-200 border border-amber-200 transition-all w-full sm:w-auto"
            title="Actualización masiva de precios"
          >
            <ArrowUpDown size={20} />
            <span className="font-medium">Actualizar Precios %</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar ítem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white shadow-sm"
            />
          </div>
          <div className="relative min-w-[200px] w-full md:w-auto">
            <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-12 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white shadow-sm appearance-none"
            >
              <option value="">Todas las Categorías</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <ArrowUpDown size={16} className="text-gray-400" />
            </div>
          </div>
        </div>

        {/* Mobile View: Cards Grouped by Category */}
        <div className="md:hidden divide-y divide-gray-100">
          {(() => {
            const categoriesInOrder: string[] = [];
            const grouped: Record<string, CatalogItem[]> = {};
            paginated.forEach(item => {
              const cat = item.category || 'General';
              if (!grouped[cat]) {
                grouped[cat] = [];
                categoriesInOrder.push(cat);
              }
              grouped[cat].push(item);
            });

            return categoriesInOrder.map(cat => (
              <div key={cat} className="bg-white">
                <div className="bg-gray-50 px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-y border-gray-100">
                  {cat}
                </div>
                <div className="divide-y divide-gray-50">
                  {grouped[cat].map((item) => (
                    <div key={item.id} className="p-2 flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {item.image_url_1
                          ? <img src={item.image_url_1} alt={item.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={20} className="text-gray-400" /></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <h3 className="font-bold text-gray-900 text-sm truncate pr-1">{item.name}</h3>
                          <div className="flex gap-1 shrink-0">
                            <div className="flex bg-gray-50 rounded-md border border-gray-100">
                              <button 
                                onClick={() => handleMove(item, 'up')}
                                disabled={items.indexOf(item) === 0}
                                className="p-1 text-gray-400 hover:text-primary-600 disabled:opacity-30"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button 
                                onClick={() => handleMove(item, 'down')}
                                disabled={items.indexOf(item) === items.length - 1}
                                className="p-1 text-gray-400 hover:text-primary-600 disabled:opacity-30 border-l border-gray-100"
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                            <button onClick={() => openModal(item)} className="p-1.5 bg-gray-50 text-gray-600 rounded-md border border-gray-100">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => handleDelete(item.id, item.name)} className="p-1.5 bg-red-50 text-red-600 rounded-md">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 text-xs">
                            ${(item.is_special && item.special_price ? item.special_price : item.price).toLocaleString('es-AR')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold ${item.stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              Stock: {item.stock}
                            </span>
                            <button 
                              onClick={() => toggleActive(item)} 
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${item.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                            >
                              {item.is_active ? 'Activo' : 'Inactivo'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}

          {filtered.length === 0 && (
            <div className="p-12 text-center text-gray-400">
              <p>No se encontraron resultados.</p>
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-gray-50 text-gray-500 font-medium text-sm uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Ítem</th>
                <th className="px-6 py-4">Estación</th>
                <th className="px-6 py-4">Precio</th>
                <th className="px-6 py-4">Stock Disponible</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                const categoriesInOrder: string[] = [];
                const grouped: Record<string, CatalogItem[]> = {};
                paginated.forEach(item => {
                  const cat = item.category || 'General';
                  if (!grouped[cat]) {
                    grouped[cat] = [];
                    categoriesInOrder.push(cat);
                  }
                  grouped[cat].push(item);
                });

                return categoriesInOrder.map(cat => (
                  <>
                    <tr key={`header-${cat}`} className="bg-gray-50 select-none">
                      <td colSpan={6} className="px-6 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-y border-gray-100">
                        {cat}
                      </td>
                    </tr>
                    {grouped[cat].map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group border-b border-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                              {item.image_url_1
                                ? <img src={item.image_url_1} alt={item.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={20} className="text-gray-400" /></div>
                              }
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 flex items-center gap-2">
                                {item.name}
                                {item.is_special && (
                                  <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight border border-amber-200">
                                    Especial
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 max-w-xs truncate">
                                {item.offer_label && <span className="text-emerald-600 font-bold mr-1">[{item.offer_label}]</span>}
                                {item.description || '-'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {item.station ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold border" style={{ backgroundColor: `${item.station.color}15`, color: item.station.color, borderColor: `${item.station.color}30` }}>
                              {item.station.name}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Sin asignar</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">
                          {item.is_special && item.special_price ? (
                            <div className="flex flex-col">
                              <span className="text-emerald-600">${item.special_price.toLocaleString('es-AR')}</span>
                              <span className="text-xs text-gray-400 line-through">${item.price.toLocaleString('es-AR')}</span>
                            </div>
                          ) : (
                            <span>${item.price.toLocaleString('es-AR')}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-medium text-sm ${
                            item.stock > 5 ? 'text-green-700' : item.stock > 0 ? 'text-yellow-700' : 'text-red-700'
                          }`}>
                            {item.stock} un.
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleActive(item)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                              item.is_active
                                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                                : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                            }`}
                          >
                            {item.is_active ? <><Eye size={12} /> Activo</> : <><EyeOff size={12} /> Inactivo</>}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center space-x-1.5 transition-opacity">
                            {/* Sorting controls */}
                            <div className="flex flex-col -space-y-1 mr-2 border-r pr-2 border-gray-100">
                              <button
                                onClick={() => handleMove(item, 'up')}
                                disabled={items.indexOf(item) === 0}
                                className="p-1 text-gray-400 hover:text-primary-600 disabled:opacity-30 transition-colors"
                                title="Subir"
                              >
                                <ChevronUp size={16} />
                              </button>
                              <button
                                onClick={() => handleMove(item, 'down')}
                                disabled={items.indexOf(item) === items.length - 1}
                                className="p-1 text-gray-400 hover:text-primary-600 disabled:opacity-30 transition-colors"
                                title="Bajar"
                              >
                                <ChevronDown size={16} />
                              </button>
                            </div>

                            <button
                              onClick={() => openModal(item)}
                              className="bg-gray-50 text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100"
                              title="Editar"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.name)}
                              className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ));
              })()}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="bg-gray-100 p-4 rounded-full">
                        <ShoppingBag size={32} className="text-gray-400" />
                      </div>
                      <p>No hay ítems en el catálogo.</p>
                      <p className="text-sm">Agregá productos elaborados que el cliente puede pedir.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={filtered.length}
      />

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-dark-bg/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem ? 'Editar Ítem' : 'Nuevo Ítem de Catálogo'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del ítem *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej: Pizza Napolitana, Pollo a la Parrilla"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej: Pizzas, Carnes, Entradas, Bebidas"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">🔥 Estación de Cocina</label>
                <select
                  value={formData.station_id}
                  onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">Sin asignar (todas las estaciones)</option>
                  {stations.map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Estación por defecto si este ítem no tiene componentes definidos abajo</p>
              </div>

              {/* Recipe Components */}
              {editingItem && (
                <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/50">
                  <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
                    <Layers size={14} /> Componentes de Producción
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    Si este plato lo preparan varias estaciones, agregá los componentes acá. Ej: "Asado" → Parrilla, "Fritas" → Cocina.
                  </p>

                  {/* Existing components */}
                  {components.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {components.map(comp => (
                        <div key={comp.id} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-100">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: comp.station?.color || '#888' }} />
                          <span className="text-sm font-medium text-gray-800 flex-1">{comp.name}</span>
                          <span className="text-xs text-gray-400">{comp.station?.name || 'Sin estación'}</span>
                          <button type="button" onClick={() => handleRemoveComponent(comp)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new component */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nombre del componente"
                      value={newCompName}
                      onChange={e => setNewCompName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddComponent())}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <select
                      value={newCompStationId}
                      onChange={e => setNewCompStationId(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Estación...</option>
                      {stations.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddComponent}
                      disabled={!newCompName.trim() || !newCompStationId}
                      className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm font-bold hover:bg-primary-600 disabled:bg-gray-300 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {components.length === 0 && (
                    <p className="text-xs text-gray-400 mt-2 italic">Sin componentes. Se usará la estación principal de arriba.</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  rows={2}
                  placeholder="Ej: Con salsa de tomate, mozzarella y albahaca"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Image size={14} /> Fotos del ítem (máx. 2)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {([1, 2] as const).map(slot => {
                    const urlKey = `image_url_${slot}` as 'image_url_1' | 'image_url_2';
                    const currentUrl = formData[urlKey];
                    return (
                      <div key={slot} className="relative">
                        <div
                          className="w-full h-28 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center cursor-pointer hover:border-primary-400 transition-colors"
                          onClick={() => (slot === 1 ? img1Ref : img2Ref).current?.click()}
                        >
                          {currentUrl ? (
                            <img src={currentUrl} alt={`Foto ${slot}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center text-gray-400 gap-1">
                              <Image size={22} />
                              <span className="text-xs">Foto {slot}</span>
                            </div>
                          )}
                        </div>
                        {currentUrl && (
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, [urlKey]: '' }))}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                          >
                            <X size={10} />
                          </button>
                        )}
                        <input
                          ref={slot === 1 ? img1Ref : img2Ref}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) uploadImage(f, slot, editingItem?.id || `new_${Date.now()}`);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                {uploadingImg && <p className="text-xs text-primary-600 mt-1 animate-pulse">Subiendo imagen...</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Precio de Venta *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stock Disponible</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">Visible en el catálogo</p>
                  <p className="text-xs text-gray-500">El cliente podrá verlo y pedirlo</p>
                </div>
                <div
                  className="relative inline-flex items-center cursor-pointer"
                  onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                >
                  <input type="checkbox" className="sr-only peer" checked={formData.is_active} onChange={() => {}} />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                </div>
              </div>

              {/* Special Offer Section */}
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                      ⭐ Especial del Día / Oferta
                    </p>
                    <p className="text-xs text-amber-700">Resaltar en el catálogo y aplicar descuento</p>
                  </div>
                  <div
                    className="relative inline-flex items-center cursor-pointer"
                    onClick={() => setFormData(prev => ({ ...prev, is_special: !prev.is_special }))}
                  >
                    <input type="checkbox" className="sr-only peer" checked={formData.is_special} onChange={() => {}} />
                    <div className="w-11 h-6 bg-amber-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-amber-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                  </div>
                </div>

                {formData.is_special && (
                  <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div>
                      <label className="block text-xs font-semibold text-amber-800 mb-1">Precio Oferta ($)</label>
                      <input
                        type="number"
                        value={formData.special_price || ''}
                        onChange={(e) => setFormData({ ...formData, special_price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white"
                        placeholder="Ej: 5900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-amber-800 mb-1">Etiqueta (Leyenda)</label>
                      <input
                        type="text"
                        value={formData.offer_label}
                        onChange={(e) => setFormData({ ...formData, offer_label: e.target.value })}
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white"
                        placeholder="Ej: 10% OFF"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 shadow-lg shadow-primary-900/20 transition-all"
                >
                  Guardar Ítem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Massive Update Modal */}
      {isMassUpdateModalOpen && (
        <div className="fixed inset-0 bg-dark-bg/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="p-6 border-b border-gray-100 bg-amber-50 text-amber-900 font-bold flex justify-between items-center">
              <span className="flex items-center gap-2">
                <ArrowUpDown size={18} /> Actualización Masiva de Precios
              </span>
              <button onClick={() => setIsMassUpdateModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-gray-600">
                Aumentá o disminuí los precios por porcentaje o monto fijo.
              </p>

              {/* Type Selection */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMassType('percentage')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${massType === 'percentage' ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >
                  Porcentaje (%)
                </button>
                <button
                  type="button"
                  onClick={() => setMassType('fixed')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${massType === 'fixed' ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >
                  Monto Fijo ($)
                </button>
              </div>

              {/* Value Input */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={massAmount === 0 ? '' : massAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || val === '-') {
                        // Allow typing the minus sign or clearing
                        setMassAmount(val as any);
                      } else {
                        const num = parseFloat(val);
                        if (!isNaN(num)) setMassAmount(num);
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-lg font-bold text-center"
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                    {massType === 'percentage' ? '%' : '$'}
                  </span>
                </div>
              </div>

              {/* Quick buttons */}
              {massType === 'percentage' ? (
                <div className="flex gap-2 text-xs flex-wrap">
                  {[-30, -10, 10, 25, 50].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMassAmount(v)}
                      className={`px-2.5 py-1.5 rounded border font-medium ${v < 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                    >
                      {v > 0 ? `+${v}%` : `${v}%`}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2 text-xs flex-wrap">
                  {[-1000, -500, 500, 1000, 2000].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMassAmount(v)}
                      className={`px-2.5 py-1.5 rounded border font-medium ${v < 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                    >
                      {v > 0 ? `+$${v.toLocaleString()}` : `-$${Math.abs(v).toLocaleString()}`}
                    </button>
                  ))}
                </div>
              )}

              {/* Category selector */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Filtrar por Categoría</label>
                <select
                  value={massCategory}
                  onChange={(e) => setMassCategory(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="">Todo el Catálogo</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800 italic">
                💡 Un valor negativo rebajará los precios, uno positivo los aumentará.
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsMassUpdateModalOpen(false)}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleMassiveUpdate}
                  disabled={massAmount === 0 || massLoading}
                  className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 disabled:bg-gray-300 shadow-lg shadow-amber-900/20 transition-all flex items-center gap-2 min-w-[140px] justify-center"
                >
                  {massLoading ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
