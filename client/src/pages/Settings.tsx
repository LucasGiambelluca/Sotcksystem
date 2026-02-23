import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Clock, Map, MessageSquare, Power } from 'lucide-react';
import type { WhatsAppConfig } from '../types';

interface DeliverySlot {
  id: string;
  date: string;
  time_start: string;
  time_end: string;
  max_orders: number;
  orders_count: number;
  is_available: boolean;
}

interface ShippingZone {
  id: number;
  name: string;
  cost: number;
  is_active: boolean;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'logistics' | 'whatsapp'>('logistics');
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [waConfig, setWaConfig] = useState<WhatsAppConfig | null>(null);
  
  // Logistics Config
  const [defaultOrigin, setDefaultOrigin] = useState('');
  const [country, setCountry] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    
    const savedOrigin = localStorage.getItem('stock_app_default_origin');
    if (savedOrigin) setDefaultOrigin(savedOrigin);

    const savedCountry = localStorage.getItem('stock_app_country');
    if (savedCountry) setCountry(savedCountry);

    const savedProvince = localStorage.getItem('stock_app_province');
    if (savedProvince) setProvince(savedProvince);

    const savedCity = localStorage.getItem('stock_app_city');
    if (savedCity) setCity(savedCity);
  }, []);

  async function loadSettings() {
    try {
      // Load Slots
      const slotsRes = await supabase.from('delivery_slots').select('*').order('date', { ascending: true }).order('time_start', { ascending: true });
      if (slotsRes.data) setSlots(slotsRes.data);
      else if (slotsRes.error) console.error('Error loading slots:', slotsRes.error);

      // Load Zones
      const zonesRes = await supabase.from('shipping_zones').select('*').order('id');
      if (zonesRes.data) setZones(zonesRes.data);
      else if (zonesRes.error) console.error('Error loading zones:', zonesRes.error);

      // Load WhatsApp Config
      const waRes = await supabase.from('whatsapp_config').select('*').single();
      
      if (waRes.data) {
          setWaConfig(waRes.data);
      } else if (waRes.error) {
          console.error('Error loading WA config:', waRes.error);
          // If not found, try to create it
          if (waRes.error.code === 'PGRST116') {
             const { data, error } = await supabase.from('whatsapp_config').insert({}).select().single();
             if (data) setWaConfig(data);
             if (error) console.error('Error creating default WA config:', error);
          }
      }

    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Error al cargar configuraciones');
    } finally {
      setLoading(false);
    }
  }

  // --- Logic for Slots ---
  // --- Logic for Slots ---
  const generateSlots = async () => {
    try {
        const loadingToast = toast.loading('Generando franjas...');
        const res = await fetch('http://localhost:3001/api/slots/generate', { method: 'POST' });
        
        toast.dismiss(loadingToast);
        
        if (res.ok) {
            toast.success('Franjas generadas para los próximos 7 días');
            loadSettings();
        } else {
            toast.error('Error al generar franjas. Asegurate que el servidor del bot esté corriendo.');
        }
    } catch (error) {
        console.error('Error generating slots:', error);
        toast.error('Error de conexión con el servidor');
    }
  };

  const updateSlot = async (id: string, updates: Partial<DeliverySlot>) => {
    const { error } = await supabase.from('delivery_slots').update(updates).eq('id', id);
    if (error) return toast.error('Error al actualizar');
    setSlots(slots.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSlot = async (id: string) => {
    const { error } = await supabase.from('delivery_slots').delete().eq('id', id);
    if (error) return toast.error('Error al eliminar');
    setSlots(slots.filter(s => s.id !== id));
  };

  // --- Logic for Zones ---
  const addZone = async () => {
    const { data, error } = await supabase.from('shipping_zones').insert({ name: 'Nueva Zona', cost: 0 }).select().single();
    if (error) return toast.error('Error al crear zona');
    setZones([...zones, data]);
  };

  const updateZone = async (id: number, updates: Partial<ShippingZone>) => {
    const { error } = await supabase.from('shipping_zones').update(updates).eq('id', id);
    if (error) return toast.error('Error al actualizar');
    setZones(zones.map(z => z.id === id ? { ...z, ...updates } : z));
  };

  const deleteZone = async (id: number) => {
    const { error } = await supabase.from('shipping_zones').delete().eq('id', id);
    if (error) return toast.error('Error al eliminar');
    setZones(zones.filter(z => z.id !== id));
  };

  // --- Logic for WhatsApp ---
  async function saveWaConfig() {
    if (!waConfig) return;

    try {
      const { error } = await supabase
        .from('whatsapp_config')
        .update({
          is_active: waConfig.is_active,
          welcome_message: waConfig.welcome_message,
          template_confirmed: waConfig.template_confirmed,
          template_preparation: waConfig.template_preparation,
          template_transit: waConfig.template_transit,
          template_delivered: waConfig.template_delivered,
          template_cancelled: waConfig.template_cancelled,
          checkout_message: waConfig.checkout_message,
          sileo_api_key: waConfig.sileo_api_key
        })
        .eq('id', waConfig.id);

      if (error) throw error;
      toast.success('Configuración de WhatsApp guardada');
    } catch (error) {
      console.error('Error saving WA config:', error);
      toast.error('Error al guardar configuración');
    }
  }const saveDefaultRegion = () => {
    localStorage.setItem('stock_app_default_origin', defaultOrigin);
    localStorage.setItem('stock_app_country', country);
    localStorage.setItem('stock_app_province', province);
    localStorage.setItem('stock_app_city', city);
    
    // Legacy support: construct default region string for map compatibility if needed, 
    // or we update RouteMap to use these new fields.
    // For now, let's also save the composite region to keep RouteMap working as is, 
    // but better to update RouteMap.
    const compositeRegion = [city, province, country].filter(Boolean).join(', ');
    localStorage.setItem('stock_app_default_region', compositeRegion);

    toast.success('Configuración logística guardada');
  };


  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'logistics' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('logistics')}
        >
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4" />
            Logística
          </div>
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'whatsapp' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('whatsapp')}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            WhatsApp Bot
          </div>
        </button>
      </div>

      {activeTab === 'logistics' && (
        <div className="space-y-8">
            {/* General Settings */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                    <Map className="text-gray-700" />
                    <h2 className="text-lg font-semibold">Configuración General</h2>
                </div>
                <div className="flex gap-4 items-end">
                    <div className="flex-1 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Dirección de Origen / Depósito (Por Defecto)
                            </label>
                            <input 
                                type="text" 
                                value={defaultOrigin}
                                onChange={(e) => setDefaultOrigin(e.target.value)}
                                placeholder="Ej: Av. San Martín 100"
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Se usará automáticamente al crear nuevas rutas.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                                <input 
                                    type="text" 
                                    value={country}
                                    onChange={(e) => setCountry(e.target.value)}
                                    placeholder="Argentina"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Provincia / Estado</label>
                                <input 
                                    type="text" 
                                    value={province}
                                    onChange={(e) => setProvince(e.target.value)}
                                    placeholder="Buenos Aires"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                                <input 
                                    type="text" 
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    placeholder="Bahía Blanca"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                             Se usará para mejorar la precisión del mapa ({[city, province, country].filter(Boolean).join(', ')}).
                        </p>
                    </div>
                    <button 
                        onClick={saveDefaultRegion}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 h-[42px]"
                    >
                        <Save size={18} />
                        Guardar
                    </button>
                </div>
            </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Delivery Slots */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <Clock className="text-blue-600" />
                        <h2 className="text-lg font-semibold">Franjas Horarias</h2>
                    </div>
                    <button 
                        onClick={generateSlots} 
                        className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100 transition-colors"
                    >
                        <Plus size={16} />
                        <span className="hidden sm:inline">Generar</span>
                    </button>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {slots.map(slot => (
                        <div key={slot.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded border justify-between">
                            <div className="flex flex-col">
                                <span className="font-medium text-sm">
                                    {new Date(slot.date + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {slot.time_start.slice(0, 5)} - {slot.time_end.slice(0, 5)}
                                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="text-xs text-gray-600 text-right">
                                    <div>Cupos: {slot.orders_count} / {slot.max_orders}</div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => updateSlot(slot.id, { is_available: !slot.is_available })}
                                        className={`p-1.5 rounded transition-colors ${slot.is_available ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}
                                        title={slot.is_available ? "Disponible para pedidos" : "No disponible"}
                                    >
                                        <Power size={18} />
                                    </button>
                                    <button onClick={() => deleteSlot(slot.id)} className="text-red-500 p-1.5 hover:bg-red-50 rounded">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {slots.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-sm text-gray-500 mb-2">No hay franjas generadas.</p>
                            <button 
                                onClick={generateSlots}
                                className="text-blue-600 text-sm hover:underline"
                            >
                                Generar franjas ahora
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Shipping Zones */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <Map className="text-purple-600" />
                        <h2 className="text-lg font-semibold">Zonas de Envío</h2>
                    </div>
                    <button onClick={addZone} className="p-1 hover:bg-gray-100 rounded-full text-purple-600">
                        <Plus size={20} />
                    </button>
                </div>
                <div className="space-y-3">
                    {zones.map(zone => (
                        <div key={zone.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded border">
                            <div className="flex-1 space-y-1">
                                <input 
                                    type="text" 
                                    value={zone.name} 
                                    onChange={(e) => updateZone(zone.id, { name: e.target.value })}
                                    className="w-full px-2 py-1 bg-white border rounded text-sm"
                                    placeholder="Nombre zona"
                                />
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">$</span>
                                    <input 
                                        type="number" 
                                        value={zone.cost} 
                                        onChange={(e) => updateZone(zone.id, { cost: Number(e.target.value) })}
                                        className="w-24 px-2 py-1 bg-white border rounded text-sm"
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={() => updateZone(zone.id, { is_active: !zone.is_active })}
                                className={`p-1.5 rounded ${zone.is_active ? 'text-green-600' : 'text-gray-400'}`}
                                title={zone.is_active ? "Activo" : "Inactivo"}
                            >
                                <Power size={18} />
                            </button>
                            <button onClick={() => deleteZone(zone.id)} className="text-red-500 p-1.5 hover:bg-red-50 rounded">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                    {zones.length === 0 && <p className="text-sm text-gray-500 text-center">No hay zonas configuradas.</p>}
                </div>
            </div>
        </div>
      </div>
      )}

      {activeTab === 'whatsapp' && waConfig && (
        <div className="max-w-4xl space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                 <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="text-green-600" />
                        <h2 className="text-lg font-semibold">Mensaje de Bienvenida</h2>
                    </div>
                </div>
                
                <div className="mb-4">
                    <label className="flex items-center gap-2 cursor-pointer mb-4">
                        <input 
                            type="checkbox" 
                            checked={waConfig.is_active}
                            onChange={(e) => setWaConfig({...waConfig, is_active: e.target.checked})}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-gray-700">Activar mensaje de bienvenida</span>
                    </label>

                    <label className="block text-sm font-medium text-gray-700 mb-1">Contenido del Mensaje</label>
                    <textarea 
                        value={waConfig.welcome_message}
                        onChange={(e) => setWaConfig({...waConfig, welcome_message: e.target.value})}
                        rows={4}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 mb-4 font-mono text-sm"
                        disabled={!waConfig.is_active}
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cierre del Bot (Checkout Message)</label>
                    <textarea 
                        value={waConfig.checkout_message || ''}
                        onChange={(e) => setWaConfig({...waConfig, checkout_message: e.target.value})}
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 font-mono text-sm"
                        placeholder="Ej: El pedido ya fue enviado a cocina."
                    />
                    <p className="text-xs text-gray-500 mt-1">Este mensaje se envía automáticamente al cliente después de que el bot crea su pedido en el sistema.</p>
                </div>
            </div>

            {/* Notification Templates */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center gap-2 mb-6">
                    <MessageSquare className="text-blue-600" />
                    <h2 className="text-lg font-semibold">Plantillas de Notificaciones de Pedidos</h2>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg mb-6 text-sm text-blue-800">
                    <p className="font-semibold mb-2">Variables Disponibles:</p>
                    <div className="flex flex-wrap gap-2">
                        <code className="bg-white px-2 py-1 rounded border">{`{clientName}`}</code>
                        <code className="bg-white px-2 py-1 rounded border">{`{orderId}`}</code>
                        <code className="bg-white px-2 py-1 rounded border">{`{total}`}</code>
                        <code className="bg-white px-2 py-1 rounded border">{`{deliveryDate}`}</code>
                        <code className="bg-white px-2 py-1 rounded border">{`{deliveryAddress}`}</code>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Confirmed */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">✅ Pedido Confirmado</label>
                        <textarea 
                            value={waConfig.template_confirmed || ''}
                            onChange={(e) => setWaConfig({...waConfig, template_confirmed: e.target.value})}
                            rows={4}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder="Mensaje para pedido confirmado..."
                        />
                    </div>

                    {/* In Preparation */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">👨‍🍳 En Preparación</label>
                        <textarea 
                            value={waConfig.template_preparation || ''}
                            onChange={(e) => setWaConfig({...waConfig, template_preparation: e.target.value})}
                            rows={4}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder="Mensaje para pedido en preparación..."
                        />
                    </div>

                     {/* In Transit */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">🚚 En Camino</label>
                        <textarea 
                            value={waConfig.template_transit || ''}
                            onChange={(e) => setWaConfig({...waConfig, template_transit: e.target.value})}
                            rows={4}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder="Mensaje para pedido en camino..."
                        />
                    </div>

                    {/* Delivered */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">✅ Entregado</label>
                        <textarea 
                            value={waConfig.template_delivered || ''}
                            onChange={(e) => setWaConfig({...waConfig, template_delivered: e.target.value})}
                            rows={4}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder="Mensaje para pedido entregado..."
                        />
                    </div>

                     {/* Cancelled */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">❌ Cancelado</label>
                        <textarea 
                            value={waConfig.template_cancelled || ''}
                            onChange={(e) => setWaConfig({...waConfig, template_cancelled: e.target.value})}
                            rows={4}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder="Mensaje para pedido cancelado..."
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button 
                        onClick={saveWaConfig}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                        <Save size={18} />
                        Guardar Todas las Plantillas
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
