import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, X, Package, Filter, ArrowUpDown, Image, ExternalLink, ShoppingBag, ArrowRightLeft, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';
import { productService } from '../services/productService';
import { stockMovementService } from '../services/stockMovementService';
import { supabase } from '../supabaseClient';
import type { Product } from '../types';
import ExportButtons from '../components/ExportButtons';
import Pagination from '../components/common/Pagination';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Modals state for stock actions
  const [activeActionProduct, setActiveActionProduct] = useState<Product | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [actionQuantity, setActionQuantity] = useState(0);
  const [actionDescription, setActionDescription] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    production_stock: 0,
    min_stock: 0,
    category: '',
    image_url_1: '' as string | null,
    image_url_2: '' as string | null,
    auto_refill: false,
    auto_refill_qty: 0,
  });
  const [uploadingImg, setUploadingImg] = useState(false);
  const img1Ref = useRef<HTMLInputElement>(null);
  const img2Ref = useRef<HTMLInputElement>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await productService.getAll();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        stock: Number(formData.stock),
        production_stock: Number(formData.production_stock),
        min_stock: Number(formData.min_stock),
        category: formData.category,
        image_url_1: formData.image_url_1 || null,
        image_url_2: formData.image_url_2 || null,
        auto_refill: formData.auto_refill,
        auto_refill_qty: formData.auto_refill ? Number(formData.auto_refill_qty) : 0,
      };

      if (editingProduct) {
        await productService.update(editingProduct.id, productData);
        toast.success('Producto actualizado correctamente');
      } else {
        if (products.length >= 100) {
          toast.error('Límite de 100 productos alcanzado. Eliminá alguno para agregar uno nuevo.');
          return;
        }
        await productService.create(productData);
        toast.success('Producto creado correctamente');
      }
      closeModal();
      loadProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      if (error?.code === 'PGRST204') {
        toast.error('Error: columna faltante.');
      } else {
        toast.error('Error al guardar el producto');
      }
    }
  };

  const handleDelete = (id: string) => {
    toast('¿Estás seguro de eliminar este producto?', {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await productService.delete(id);
            toast.success('Producto eliminado');
            loadProducts();
          } catch (error) {
            console.error('Error deleting product:', error);
            toast.error('Error al eliminar el producto');
          }
        }
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => {},
      },
    });
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
        stock: product.stock,
        production_stock: product.production_stock || 0,
        min_stock: product.min_stock || 0,
        category: product.category || '',
        image_url_1: product.image_url_1 || '',
        image_url_2: product.image_url_2 || '',
        auto_refill: (product as any).auto_refill || false,
        auto_refill_qty: (product as any).auto_refill_qty || 0,
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', description: '', price: 0, stock: 0, production_stock: 0, min_stock: 0, category: '', image_url_1: '', image_url_2: '', auto_refill: false, auto_refill_qty: 0 });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData({ name: '', description: '', price: 0, stock: 0, production_stock: 0, min_stock: 0, category: '', image_url_1: '', image_url_2: '', auto_refill: false, auto_refill_qty: 0 });
  };

  // --- ACTIONS MODALS ---
  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeActionProduct || actionQuantity <= 0) return;
    try {
      await stockMovementService.registerPurchase(activeActionProduct.id, actionQuantity, actionDescription || 'Ingreso manual de stock', activeActionProduct.stock);
      toast.success(`Ingresadas ${actionQuantity} unidades al depósito`);
      closeActionModals();
      loadProducts();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al registrar ingreso');
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeActionProduct || actionQuantity <= 0) return;
    try {
      await stockMovementService.transferToProduction(activeActionProduct.id, actionQuantity, actionDescription || 'Transferencia a producción', activeActionProduct.stock, activeActionProduct.production_stock);
      toast.success(`${actionQuantity} unidades movidas a producción`);
      closeActionModals();
      loadProducts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al transferir stock');
    }
  };

  const closeActionModals = () => {
    setIsTransferModalOpen(false);
    setIsPurchaseModalOpen(false);
    setActiveActionProduct(null);
    setActionQuantity(0);
    setActionDescription('');
  };

  async function uploadImage(file: File, slot: 1 | 2, tempId: string) {
    setUploadingImg(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${tempId}_${slot}.${ext}`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      setFormData(prev => ({ ...prev, [`image_url_${slot}`]: data.publicUrl }));
      toast.success(`Imagen ${slot} subida correctamente`);
    } catch (err) {
      console.error(err);
      toast.error('Error al subir la imagen. ¿Existe el bucket product-images en Supabase Storage?');
    } finally {
      setUploadingImg(false);
    }
  }

  const filteredProducts = products.filter(product => 
    (categoryFilter === '' || product.category === categoryFilter)
  );

  // Pagination logic
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Reset pagination when filters change
  useEffect(() => {
     setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter(p => p !== id));
    } else {
      setSelectedProducts([...selectedProducts, id]);
    }
  };

  if (loading) return <div className="p-8 flex justify-center text-primary-600">Cargando inventario...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Gestiona tus productos y stock</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full md:w-auto">
          <ExportButtons 
            data={selectedProducts.length > 0 
              ? products.filter(p => selectedProducts.includes(p.id)) 
              : filteredProducts}
            filename="inventario"
            columns={[
              { header: 'Nombre', key: 'name' },
              { header: 'Categoría', key: 'category' },
              { header: 'Precio', key: 'price' },
              { header: 'Stock', key: 'stock' },
              { header: 'Descripción', key: 'description' }
            ]}
          />
          <a
            href="/catalog"
            target="_blank"
            rel="noreferrer"
            className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl flex items-center justify-center space-x-2 hover:bg-emerald-700 shadow transition w-full sm:w-auto"
          >
            <ShoppingBag size={18} />
            <span className="font-medium">Ver Catálogo</span>
            <ExternalLink size={14} />
          </a>
          <button
            onClick={() => openModal()}
            className="bg-primary-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center space-x-2 hover:bg-primary-700 shadow-lg shadow-primary-900/20 transition-all w-full sm:w-auto"
          >
            <Plus size={20} />
            <span className="font-medium">Nuevo Producto</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar producto..."
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
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <ArrowUpDown size={16} className="text-gray-400" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-gray-50 text-gray-500 font-medium text-sm uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 w-4">
                  <input 
                    type="checkbox" 
                    checked={filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                </th>
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4">Categoría</th>
                <th className="px-6 py-4">Precio</th>
                <th className="px-6 py-4">Depósito</th>
                <th className="px-6 py-4">Producción</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {product.image_url_1
                          ? <img src={product.image_url_1} alt={product.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Package size={20} className="text-gray-400" /></div>
                        }
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500 max-w-xs truncate">{product.description || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium border border-gray-200">
                      {product.category || 'Sin categoría'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">${product.price.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col space-y-2 max-w-[120px]">
                      <div className="flex justify-between items-center">
                        <span className={`text-sm font-medium ${
                          product.stock > product.min_stock ? 'text-green-700' : product.stock > 0 ? 'text-yellow-700' : 'text-red-700'
                        }`}>
                          {product.stock} un.
                        </span>
                        {product.stock <= product.min_stock && (
                           <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded-md font-bold" title={`Stock mínimo: ${product.min_stock}`}>
                             ¡BAJO!
                           </span>
                        )}
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            product.stock > product.min_stock ? 'bg-green-500' : product.stock > 0 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min((product.stock / (product.min_stock * 2 || 20)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <span className="font-bold text-gray-800 bg-blue-50 text-blue-800 px-3 py-1 rounded-lg">
                        {product.production_stock} un.
                     </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setActiveActionProduct(product); setIsPurchaseModalOpen(true); }}
                        className="bg-emerald-50 text-emerald-600 p-2 rounded-lg hover:bg-emerald-100 transition-colors"
                        title="Ingreso de Depósito (Compra/Recepción)"
                      >
                        <ArrowDownToLine size={18} />
                      </button>
                      <button 
                        onClick={() => { setActiveActionProduct(product); setIsTransferModalOpen(true); }}
                        className="bg-indigo-50 text-indigo-600 p-2 rounded-lg hover:bg-indigo-100 transition-colors"
                        title="Transferir a Producción (Cocina)"
                      >
                        <ArrowRightLeft size={18} />
                      </button>
                      <button 
                        onClick={() => openModal(product)}
                        className="bg-gray-50 text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors ml-2 border border-gray-100"
                        title="Editar Detalle Completo"
                      >
                        <Pencil size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id)}
                        className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="bg-gray-100 p-4 rounded-full">
                        <Package size={32} className="text-gray-400" />
                      </div>
                      <p>No se encontraron productos.</p>
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
         totalItems={totalItems}
      />

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-dark-bg/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Ej: Sillas, Mesas, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                  rows={2}
                />
              </div>

              {/* Image Upload: 2 slots */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Image size={14} /> Fotos del producto (máx. 2)
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
                            if (f) uploadImage(f, slot, editingProduct?.id || `new_${Date.now()}`);
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Precio *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stock Minimo (Alarma) *</label>
                  <input
                    type="number"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    placeholder="Mostrar alerta si es menor que..."
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 bg-gray-100 px-2 py-1 rounded w-max text-xs">Stock Depósito</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 bg-blue-100 text-blue-800 px-2 py-1 rounded w-max text-xs">Stock Producción</label>
                  <input
                    type="number"
                    value={formData.production_stock}
                    onChange={(e) => setFormData({ ...formData, production_stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50/30 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Auto-Refill Toggle */}
              <div className="border border-gray-200 rounded-xl p-4 bg-amber-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">🔄 Renovar stock automáticamente</p>
                    <p className="text-xs text-gray-500 mt-0.5">Se repone todos los días a las 06:00 AM</p>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, auto_refill: !prev.auto_refill }))}>
                    <input type="checkbox" className="sr-only peer" checked={formData.auto_refill} onChange={() => {}} />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </div>
                </div>
                {formData.auto_refill && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reponer hasta (unidades)</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.auto_refill_qty}
                      onChange={(e) => setFormData({ ...formData, auto_refill_qty: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Ej: 20"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
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
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Purchase Item Modal --- */}
      {isPurchaseModalOpen && activeActionProduct && (
        <div className="fixed inset-0 bg-dark-bg/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-bold text-gray-800 flex items-center"><ArrowDownToLine className="text-emerald-500 mr-2"/> Ingreso a Depósito</h3>
                 <button onClick={closeActionModals} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
              </div>
              <p className="text-sm text-gray-500 mb-6">Recepcionar stock del proveedor para el producto <b>{activeActionProduct.name}</b></p>
              
              <form onSubmit={handlePurchaseSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad Recibida</label>
                  <input
                    type="number"
                    min="1"
                    value={actionQuantity}
                    onChange={(e) => setActionQuantity(Math.floor(Number(e.target.value)))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                    required
                  />
                  <p className="text-xs text-emerald-600 mt-2 font-medium">Nuevo stock depósito será: {activeActionProduct.stock + actionQuantity}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nota (Opcional)</label>
                  <input
                    type="text"
                    value={actionDescription}
                    onChange={(e) => setActionDescription(e.target.value)}
                    placeholder="Ej. Remito #1234, Proveedor ABC"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button type="submit" className="w-full bg-emerald-600 text-white rounded-xl py-3 font-medium hover:bg-emerald-700 transition">Confirmar Ingreso</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- Transfer to Production Modal --- */}
      {isTransferModalOpen && activeActionProduct && (
        <div className="fixed inset-0 bg-dark-bg/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-bold text-gray-800 flex items-center"><ArrowRightLeft className="text-indigo-500 mr-2"/> Transferir a Producción</h3>
                 <button onClick={closeActionModals} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
              </div>
              <p className="text-sm text-gray-500 mb-6">Mover stock del depósito actual a la línea de elaboración. Producto: <b>{activeActionProduct.name}</b></p>

              <form onSubmit={handleTransferSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a Mover (Disp: {activeActionProduct.stock})</label>
                  <input
                    type="number"
                    min="1"
                    max={activeActionProduct.stock}
                    value={actionQuantity}
                    onChange={(e) => setActionQuantity(Math.floor(Number(e.target.value)))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                    required
                  />
                  {actionQuantity > activeActionProduct.stock && (
                     <p className="text-xs text-red-500 mt-1">Supera el stock disponible en depósito.</p>
                  )}
                  {actionQuantity > 0 && actionQuantity <= activeActionProduct.stock && (
                      <p className="text-xs text-indigo-600 mt-2 font-medium">Nuevo stock producción será: {activeActionProduct.production_stock + actionQuantity}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nota (Opcional)</label>
                  <input
                    type="text"
                    value={actionDescription}
                    onChange={(e) => setActionDescription(e.target.value)}
                    placeholder="Ej. Uso en cocina / Lote A"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={actionQuantity > activeActionProduct.stock || actionQuantity <= 0}
                  className="w-full bg-indigo-600 text-white rounded-xl py-3 font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirmar Transferencia
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
