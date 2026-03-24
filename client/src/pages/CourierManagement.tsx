import { useEffect, useState } from 'react';
import { 
  Plus, Pencil, Search, X, 
  Phone, Shield, User, Trash,
  Truck, Clock, Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { employeeService } from '../services/employeeService';
import type { Employee } from '../types';
import { supabase } from '../supabaseClient';

export default function CourierManagement() {
  const [couriers, setCouriers] = useState<Employee[]>([]);
  const [metadata, setMetadata] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Employee | null>(null);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    role: 'cadete', 
    phone: '', 
    pin_code: '', 
    is_active: true 
  });

  useEffect(() => {
    loadData();
    
    // Subscribe to metadata changes for real-time online status
    const channel = supabase
      .channel('cadete-status-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadete_metadata' }, () => {
        loadMetadata();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCouriers(), loadMetadata()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadCouriers = async () => {
    const data = await employeeService.getAll();
    // Filter by role (cadete or delivery)
    setCouriers(data.filter(emp => emp.role === 'cadete' || emp.role === 'delivery'));
  };

  const loadMetadata = async () => {
    const { data } = await supabase.from('cadete_metadata').select('*');
    setMetadata(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.pin_code && formData.pin_code.length !== 4) {
      toast.error('El PIN debe tener exactamente 4 dígitos');
      return;
    }

    try {
      if (editingCourier) {
        await employeeService.update(editingCourier.id, formData);
        toast.success('Repartidor actualizado correctamente');
      } else {
        await employeeService.create(formData);
        toast.success('Repartidor creado correctamente');
      }
      closeModal();
      loadCouriers();
    } catch (error) {
      console.error('Error saving courier:', error);
      toast.error('Error al guardar el repartidor');
    }
  };

  const handleToggleStatus = async (courier: Employee) => {
    try {
      await employeeService.update(courier.id, { is_active: !courier.is_active });
      toast.success(courier.is_active ? 'Repartidor desactivado' : 'Repartidor activado');
      loadCouriers();
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
  };

  const openModal = (courier?: Employee) => {
    if (courier) {
      setEditingCourier(courier);
      setFormData({ 
        name: courier.name, 
        role: courier.role,
        phone: courier.phone || '', 
        pin_code: courier.pin_code || '',
        is_active: courier.is_active
      });
    } else {
      setEditingCourier(null);
      setFormData({ name: '', role: 'cadete', phone: '', pin_code: '', is_active: true });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCourier(null);
  };

  const filteredCouriers = couriers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  const getStatus = (courierId: string) => {
    const meta = metadata.find(m => m.employee_id === courierId);
    if (!meta) return { online: false, lastSeen: null };
    
    // Consider online if is_online is true AND updated recently (last 10 mins)
    const lastUpdate = new Date(meta.updated_at).getTime();
    const isRecent = Date.now() - lastUpdate < 10 * 60 * 1000;
    
    return { 
      online: meta.is_online && isRecent,
      lastSeen: meta.updated_at 
    };
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium animate-pulse">Cargando flota de cadetes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="bg-white/40 backdrop-blur-md border border-white/20 p-8 rounded-3xl shadow-xl shadow-gray-200/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-primary-100 text-primary-600 rounded-2xl">
              <Truck size={28} />
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Gestión de Cadetes</h1>
          </div>
          <p className="text-gray-500 font-medium">Control total de tu flota logística y repartidores.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all w-full sm:w-80 shadow-sm"
            />
          </div>
          <button
            onClick={() => openModal()}
            className="bg-primary-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary-700 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary-500/30"
          >
            <Plus size={22} />
            Nuevo Cadete
          </button>
        </div>
      </div>

      {/* Grid of Courier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCouriers.length > 0 ? (
          filteredCouriers.map((courier) => {
            const { online, lastSeen } = getStatus(courier.id);
            return (
              <div 
                key={courier.id}
                className="group relative bg-white border border-gray-100 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* Status Badge */}
                <div className={`absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  {online ? 'En Línea' : 'Desconectado'}
                </div>

                <div className="flex items-start gap-4 mb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black ${
                    online ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {courier.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors">{courier.name}</h3>
                    <p className="text-gray-400 text-sm font-medium flex items-center gap-1">
                      <Smartphone size={14} />
                      {courier.phone || 'Sin teléfono'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mb-1">PIN Acceso</p>
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-primary-500" />
                      <span className="font-mono font-bold text-gray-700 tracking-widest">{courier.pin_code || '----'}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mb-1">Última Actividad</p>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-gray-400" />
                      <span className="text-xs font-semibold text-gray-600">
                        {lastSeen ? new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <button
                    onClick={() => handleToggleStatus(courier)}
                    className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                      courier.is_active 
                        ? 'text-green-600 hover:bg-green-50' 
                        : 'text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {courier.is_active ? 'Empleado ACTIVO' : 'Empleado INACTIVO'}
                  </button>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => openModal(courier)}
                      className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                      title="Editar"
                    >
                      <Pencil size={18} />
                    </button>
                    <button 
                      className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                      title="Eliminar"
                    >
                      <Trash size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 bg-white/50 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-gray-100 text-gray-400 rounded-full">
              <User size={40} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-700">No se encontraron cadetes</h3>
              <p className="text-gray-500 max-w-sm">Intentá ajustar tu búsqueda o agregá un nuevo repartidor a tu flota.</p>
            </div>
            <button
              onClick={() => openModal()}
              className="text-primary-600 font-bold hover:underline"
            >
              Crear mi primer cadete
            </button>
          </div>
        )}
      </div>

      {/* Modal for adding/editing */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in slide-in-from-top-4 duration-500 border border-white/20">
            <div className="relative p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 via-primary-600 to-primary-400"></div>
              <div>
                <h2 className="text-2xl font-black text-gray-900">{editingCourier ? '🛠️ Editar Repartidor' : '🚀 Nuevo Repartidor'}</h2>
                <p className="text-gray-500 text-sm font-medium">Completa los datos de acceso y contacto.</p>
              </div>
              <button 
                onClick={closeModal} 
                className="p-3 text-gray-400 hover:text-gray-900 hover:bg-white rounded-2xl transition-all shadow-sm"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Nombre Completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-medium"
                      placeholder="Nombre del repartidor..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">PIN Digital (4 dígitos)</label>
                    <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                      <input
                        type="password"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        value={formData.pin_code}
                        onChange={e => setFormData({ ...formData, pin_code: e.target.value })}
                        className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-mono tracking-[0.5em] text-lg font-bold"
                        placeholder="0000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Teléfono WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                      <input
                        type="text"
                        required
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-medium"
                        placeholder="549291..."
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Rol Logístico</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-bold text-gray-700 bg-white"
                  >
                    <option value="cadete">Repartidor Propio (Cadete)</option>
                    <option value="delivery">Servicio Externo (Delivery)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] py-4 bg-primary-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {editingCourier ? 'Guardar Cambios' : 'Confirmar Alta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
