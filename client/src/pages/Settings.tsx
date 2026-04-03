import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Clock, Map, MessageSquare, Power, Store, Globe, Shield, ShieldOff, MapPin, Search, Loader2, Printer } from 'lucide-react';
import ShippingMap from '../components/ShippingMap';
import type { ShippingZone } from '../types';



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

// Interface imported from ShippingMap




export default function Settings() {
  const [activeTab, setActiveTab] = useState<'logistics' | 'whatsapp' | 'catalog' | 'printer'>('logistics');
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [waConfig, setWaConfig] = useState<WhatsAppConfig | null>(null);
  
  const [printerConfig, setPrinterConfig] = useState<{
    id: string;
    auto_print_enabled: boolean;
    margin_top: number;
    margin_bottom: number;
    store_name: string;
    footer_message: string;
    print_logo: boolean;
    logo_url: string | null;
  } | null>(null);

  
  const [loading, setLoading] = useState(true);
  const [geocodingLoading, setGeocodingLoading] = useState(false);


  useEffect(() => {
    loadSettings();
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

      // Load WhatsApp Config - use maybeSingle to avoid error if multiple rows
      const waRes = await supabase
        .from('whatsapp_config')
        .select('*')
        .order('id', { ascending: false }) // Always read the latest row
        .limit(1)
        .maybeSingle();
      
      if (waRes.data) {
          setWaConfig(waRes.data);
      } else if (!waRes.data && !waRes.error) {
          // Table is empty — create ONE default row
          const { data: newRow, error: insertErr } = await supabase
            .from('whatsapp_config')
            .insert({ welcome_message: '' })
            .select()
            .single();
          if (newRow) setWaConfig(newRow);
          if (insertErr) console.error('Error creating default WA config:', insertErr);
      } else if (waRes.error) {
          console.error('Error loading WA config:', waRes.error);
      }

      // Load Printer Config
      const { data: pConfig, error: pError } = await supabase
        .from('printer_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (pConfig) {
        setPrinterConfig(pConfig);
      } else if (!pConfig && !pError) {
        // Create default if missing
        const { data: newP } = await supabase
          .from('printer_config')
          .insert({ store_name: '@ElPolloComilon' })
          .select()
          .single();
        if (newP) setPrinterConfig(newP);
      }

    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Error al cargar configuraciones');
    } finally {
      setLoading(false);
    }
  }

  async function handleGeocodeOrigin() {
    if (!waConfig?.store_address) return toast.error('Ingrese una dirección primero');
    
    setGeocodingLoading(true);
    try {
        const cleanStoreCity = waConfig.store_city?.split(',')[0].trim() || 'Bahía Blanca';
        const cleanStoreProv = waConfig.store_province?.split(',')[0].trim() || 'Buenos Aires';
        const cleanStoreCountry = waConfig.store_country?.split(',')[0].trim() || 'Argentina';

        const fullAddress = `${waConfig.store_address}, ${cleanStoreCity}, ${cleanStoreProv}, ${cleanStoreCountry}`;
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001/api/geocode' : '/api/geocode';
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: fullAddress })
        });


        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Error al geocodificar');
        }

        const { lat, lng } = await response.json();
        
        if (waConfig) {
            setWaConfig({ ...waConfig, store_lat: lat, store_lng: lng });
            toast.success('Coordenadas actualizadas con éxito');
        }
    } catch (error: any) {
        console.error('Geocode error:', error);
        toast.error(`Error: ${error.message}`);
    } finally {
        setGeocodingLoading(false);
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
    const { data, error } = await supabase.from('shipping_zones').insert({ 
      name: 'Nueva Zona', 
      cost: 0, 
      zone_type: 'radius', 
      max_radius_km: 1,
      allow_delivery: true 
    }).select().single();
    if (error) return toast.error('Error al crear zona');
    setZones([...zones, data]);
  };


  const updateZone = async (id: string, updates: Partial<ShippingZone>) => {
    const { error } = await supabase.from('shipping_zones').update(updates).eq('id', id);
    if (error) return toast.error('Error al actualizar');
    setZones(zones.map(z => z.id === id ? { ...z, ...updates } : z));
  };

  const deleteZone = async (id: string) => {
    const { error } = await supabase.from('shipping_zones').delete().eq('id', id);
    if (error) return toast.error('Error al eliminar');
    setZones(zones.filter(z => z.id !== id));
  };

  const handleAddZone = async (zone: Partial<ShippingZone>) => {
    const { data, error } = await supabase.from('shipping_zones').insert({
        ...zone,
        is_active: true
    }).select().single();
    
    if (error) return toast.error('Error al crear zona');
    setZones([...zones, data]);
    toast.success('Zona añadida al mapa');
  };


  // --- Logic for WhatsApp ---
  async function saveWaConfig() {
    if (!waConfig) return;
    try {
      // 1. Update master config
      const { error: err1 } = await supabase
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
          sileo_api_key: waConfig.sileo_api_key,
          business_hours: waConfig.business_hours,
          catalog_business_name: waConfig.catalog_business_name,
          catalog_accent_color: waConfig.catalog_accent_color,
          catalog_logo_url: waConfig.catalog_logo_url,
          catalog_banner_url: waConfig.catalog_banner_url,
          whatsapp_phone: waConfig.whatsapp_phone,
          shipping_policy: waConfig.shipping_policy,
          store_lat: waConfig.store_lat,
          store_lng: waConfig.store_lng,
          store_address: waConfig.store_address,
          store_city: waConfig.store_city,
          store_province: waConfig.store_province,
          store_country: waConfig.store_country
        })
        .eq('id', waConfig.id);

      if (err1) throw err1;

      // 2. Synchronize with Public Branding (for the Catalog)
      const publicPayload = {
        whatsapp_phone: waConfig.whatsapp_phone,
        catalog_business_name: waConfig.catalog_business_name,
        catalog_logo_url: waConfig.catalog_logo_url,
        catalog_banner_url: waConfig.catalog_banner_url,
        catalog_accent_color: waConfig.catalog_accent_color,
      };

      const { data: currentPublic } = await supabase.from('public_branding').select('id').maybeSingle();
      if (currentPublic) {
        await supabase.from('public_branding').update(publicPayload).eq('id', currentPublic.id);
      } else {
        await supabase.from('public_branding').insert(publicPayload);
      }

      toast.success('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error al guardar configuración');
    }
  }

  async function savePrinterConfig() {
    if (!printerConfig) return;
    try {
      const { error } = await supabase
        .from('printer_config')
        .update({
          auto_print_enabled: printerConfig.auto_print_enabled,
          margin_top: printerConfig.margin_top,
          margin_bottom: printerConfig.margin_bottom,
          store_name: printerConfig.store_name,
          footer_message: printerConfig.footer_message,
          print_logo: printerConfig.print_logo,
          logo_url: printerConfig.logo_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', printerConfig.id);
      
      if (error) throw error;
      toast.success('Configuración de impresora guardada');
    } catch (error) {
      console.error('Error saving printer config:', error);
    }
  }

  async function handleTestPrint() {
    if (!printerConfig) return;
    const toastId = toast.loading('Generando ticket de prueba...');
    try {
      const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
      const strToBytes = (s: string) => Array.from(new TextEncoder().encode(s));
      
      let cmds: number[] = [ESC, 0x40, ESC, 0x74, 0x10];
      
      // Margins Top
      for (let i = 0; i < (printerConfig.margin_top || 0); i++) cmds.push(LF);

      cmds.push(
        ESC, 0x61, 0x01, GS, 0x21, 0x11,
        ...strToBytes(`${printerConfig.store_name}\n`),
        GS, 0x21, 0x00, ...strToBytes('------------------------------------------\n'),
        GS, 0x21, 0x01, ...strToBytes('TICKET DE PRUEBA\n'),
        GS, 0x21, 0x00,
        ...strToBytes(`${new Date().toLocaleString('es-AR')}\n`),
        ...strToBytes('------------------------------------------\n'),
        ESC, 0x61, 0x01,
        ...strToBytes('Si estás viendo esto,\ntu impresora está configurada correctamente.\n\n'),
        ...strToBytes(`${printerConfig.footer_message}\n`)
      );

      // Margins Bottom
      for (let i = 0; i < (printerConfig.margin_bottom || 3); i++) cmds.push(LF);
      cmds.push(GS, 0x56, 0x00);

      const raw = btoa(String.fromCharCode(...new Uint8Array(cmds)));
      const { error } = await supabase
        .from('print_queue')
        .insert({ 
            order_id: null,
            raw_content: raw, 
            status: 'pending',
            logo_url: printerConfig.logo_url
        });

      if (error) throw error;
      toast.success('Prueba enviada', { id: toastId });
    } catch (err) {
      console.error('Test print error:', err);
      toast.error('Error al enviar prueba', { id: toastId });
    }
  }

  const saveLogisticsConfig = async () => {
    await saveWaConfig();
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
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'catalog' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Store size={18} />
          Catálogo
        </button>
        <button
          onClick={() => setActiveTab('printer')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'printer' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Printer size={18} />
          Impresora
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
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={waConfig?.store_address || ''}
                                    onChange={(e) => setWaConfig(prev => prev ? {...prev, store_address: e.target.value} : null)}
                                    placeholder="Ej: Av. San Martín 100"
                                    className="flex-1 px-3 py-2 border rounded-lg"
                                />
                                <button 
                                    onClick={handleGeocodeOrigin}
                                    disabled={geocodingLoading}
                                    className="bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100 transition flex items-center gap-2 disabled:opacity-50"
                                    title="Obtener coordenadas GPS automáticamente"
                                >
                                    {geocodingLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                                    <span className="hidden sm:inline">Auto-GPS</span>
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Se usará automáticamente al crear nuevas rutas.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                                <input 
                                    type="text" 
                                    value={waConfig?.store_country || ''}
                                    onChange={(e) => setWaConfig(prev => prev ? {...prev, store_country: e.target.value} : null)}
                                    placeholder="Argentina"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                                <input 
                                    type="text" 
                                    value={waConfig?.store_province || ''}
                                    onChange={(e) => setWaConfig(prev => prev ? {...prev, store_province: e.target.value} : null)}
                                    placeholder="Buenos Aires"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                                <input 
                                    type="text" 
                                    value={waConfig?.store_city || ''}
                                    onChange={(e) => setWaConfig(prev => prev ? {...prev, store_city: e.target.value} : null)}
                                    placeholder="Bahía Blanca"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                             Se usará para mejorar la precisión del mapa ({[waConfig?.store_city, waConfig?.store_province, waConfig?.store_country].filter(Boolean).join(', ')}).
                        </p>
                    </div>
                    <button 
                        onClick={saveLogisticsConfig}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 h-[42px]"
                    >
                        <Save size={18} />
                        Guardar
                    </button>
                </div>

                {/* --- LIV Configuration --- */}
                <div className="pt-6 mt-6 border-t border-gray-100 flex items-end gap-4">
                    <div className="flex-1 space-y-4">
                        <h3 className="font-semibold text-gray-800">Estrategia Logística (LIV)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Política de Shipping</label>
                                <select 
                                    value={waConfig?.shipping_policy || 'flex'}
                                    onChange={(e) => waConfig && setWaConfig({...waConfig, shipping_policy: e.target.value as any})}
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                >
                                    <option value="flex">Flex (Libre albedrío)</option>
                                    <option value="smart">Smart (Hibrido GPS + Validación)</option>
                                    <option value="secure">Secure (Solo GPS)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Latitud (Local)</label>
                                <input 
                                    type="number" step="0.000001"
                                    value={waConfig?.store_lat || ''}
                                    onChange={(e) => waConfig && setWaConfig({...waConfig, store_lat: parseFloat(e.target.value)})}
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    placeholder="-38.7183"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Longitud</label>
                                <input 
                                    type="number" step="0.000001"
                                    value={waConfig?.store_lng || ''}
                                    onChange={(e) => waConfig && setWaConfig({...waConfig, store_lng: parseFloat(e.target.value)})}
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    placeholder="-62.2663"
                                />
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={saveWaConfig}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 h-[42px]"
                        title="Guarda la configuración LIV principal"
                    >
                        <Save size={18} />
                        Guardar LIV
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

            {/* Interactive Shipping Map */}
            <div className="md:col-span-2">
                <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <Globe className="text-blue-600" size={20} />
                            <h2 className="text-lg font-bold">Zonas de Entrega y Barrios</h2>
                        </div>
                    </div>
                    <div className="p-4">
                        {waConfig?.store_lat && waConfig?.store_lng ? (
                            <div className="h-[600px]">
                                <ShippingMap 
                                    storeLoc={{ lat: waConfig.store_lat, lng: waConfig.store_lng }}
                                    zones={zones}
                                    onUpdateZone={updateZone}
                                    onAddZone={handleAddZone}
                                    onDeleteZone={deleteZone}
                                />
                            </div>
                        ) : (
                            <div className="p-12 text-center bg-gray-50 rounded-xl border-2 border-dashed">
                                <MapPin className="mx-auto text-gray-300 mb-4" size={48} />
                                <h3 className="text-lg font-medium text-gray-800 mb-2">Configure su Ubicación</h3>
                                <p className="text-gray-500 max-w-sm mx-auto">
                                    Para activar el mapa interactivo de envíos, primero ingrese las coordenadas GPS de su local arriba.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Legacy/Quick Zones List (Optional, can be hidden if map is enough) */}
            <div className="bg-white p-6 rounded-lg shadow-sm border opacity-80">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <Map className="text-purple-600" />
                        <h2 className="text-lg font-semibold">Listado de Zonas</h2>
                    </div>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {zones.map(zone => (
                        <div key={zone.id} className="flex flex-col gap-3 p-3 bg-gray-50 rounded border">
                            <div className="flex items-center gap-3">
                                <div className="flex-1 space-y-1">
                                    <input 
                                        type="text" 
                                        value={zone.name} 
                                        onChange={(e) => updateZone(String(zone.id), { name: e.target.value })}
                                        className="w-full px-2 py-1 bg-white border rounded font-medium text-sm"
                                        placeholder="Nombre zona"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 font-medium text-sm">$</span>
                                    <input 
                                        type="number" 
                                        value={zone.cost} 
                                        onChange={(e) => updateZone(String(zone.id), { cost: Number(e.target.value) })}
                                        className="w-20 px-2 py-1 bg-white border rounded font-bold text-sm"
                                    />
                                </div>
                                <button 
                                    onClick={() => updateZone(String(zone.id), { allow_delivery: !zone.allow_delivery })}
                                    className={`p-1.5 rounded transition ${zone.allow_delivery ? 'text-green-600 bg-green-50' : 'text-red-400 bg-red-100'}`}
                                    title={zone.allow_delivery ? "Permitido" : "Bloqueado"}
                                >
                                    {zone.allow_delivery ? <Shield size={18} /> : <ShieldOff size={18} />}
                                </button>
                            </div>
                        </div>
                    ))}
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

                    <div className="pt-4 border-t border-gray-100 italic">
                        <div className="flex items-center gap-3 mb-2">
                            <Printer className="text-blue-500" size={18} />
                            <h3 className="font-semibold text-gray-800">Impresora Térmica</h3>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={waConfig.auto_print ?? false}
                                onChange={(e) => setWaConfig({...waConfig, auto_print: e.target.checked})}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-gray-700 text-sm">Impresión Automática (Comanda de Cocina)</span>
                        </label>
                        <p className="text-[10px] text-gray-500 mt-1 ml-6">
                            Si se activa, cada vez que el bot confirme un pedido, se enviará automáticamente a la cola de impresión.
                        </p>
                    </div>
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

            {/* Business Hours Settings */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <Clock className="text-orange-600" />
                        <h2 className="text-lg font-semibold">Horarios de Atención</h2>
                    </div>
                </div>
                
                <div className="mb-4">
                     <label className="flex items-center gap-2 cursor-pointer mb-4">
                        <input 
                            type="checkbox" 
                            checked={waConfig.business_hours?.isActive ?? false}
                            onChange={(e) => setWaConfig({
                                ...waConfig, 
                                business_hours: { 
                                    ...(waConfig.business_hours || { days: [1,2,3,4,5], startTime: '09:00', endTime: '18:00', timezone: 'America/Argentina/Buenos_Aires' }), 
                                    isActive: e.target.checked 
                                }
                            })}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <span className="text-gray-700 font-medium">Habilitar control de horarios global</span>
                    </label>
                    <p className="text-xs text-gray-500 mb-4">Si está habilitado, los flujos podrán consultar estos horarios para determinar si el local está abierto.</p>

                    <div className={`space-y-4 ${(waConfig.business_hours?.isActive ?? false) ? '' : 'opacity-50 pointer-events-none'}`}>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Días Abierto (0=Domingo, 1=Lunes...)</label>
                            <div className="flex gap-2 flex-wrap">
                                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, idx) => (
                                    <label key={idx} className="flex items-center gap-1 bg-gray-50 px-3 py-1.5 rounded border cursor-pointer hover:bg-gray-100">
                                        <input 
                                            type="checkbox"
                                            checked={(waConfig.business_hours?.days || []).includes(idx)}
                                            onChange={(e) => {
                                                const currentDays = waConfig.business_hours?.days || [];
                                                const newDays = e.target.checked 
                                                    ? [...currentDays, idx]
                                                    : currentDays.filter(d => d !== idx);
                                                
                                                setWaConfig({
                                                    ...waConfig,
                                                    business_hours: {
                                                        ...(waConfig.business_hours || { isActive: false, days: [], startTime: '09:00', endTime: '18:00', timezone: 'America/Argentina/Buenos_Aires' }),
                                                        days: newDays
                                                    }
                                                });
                                            }}
                                            className="text-orange-600 rounded focus:ring-orange-500"
                                        />
                                        <span className="text-sm">{day}</span>
                                    </label>
                                ))}
                            </div>
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hora Apertura</label>
                                <input 
                                    type="time" 
                                    value={waConfig.business_hours?.startTime || '09:00'}
                                    onChange={(e) => setWaConfig({
                                        ...waConfig,
                                        business_hours: {
                                            ...(waConfig.business_hours || { isActive: false, days: [1,2,3,4,5], endTime: '18:00', timezone: 'America/Argentina/Buenos_Aires' }),
                                            startTime: e.target.value
                                        }
                                    })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hora Cierre</label>
                                <input 
                                    type="time" 
                                    value={waConfig.business_hours?.endTime || '18:00'}
                                    onChange={(e) => setWaConfig({
                                        ...waConfig,
                                        business_hours: {
                                            ...(waConfig.business_hours || { isActive: false, days: [1,2,3,4,5], startTime: '09:00', timezone: 'America/Argentina/Buenos_Aires' }),
                                            endTime: e.target.value
                                        }
                                    })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                         </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={saveWaConfig}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium transition"
                        >
                            <Save size={16} />
                            Guardar Horarios
                        </button>
                    </div>
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

      {activeTab === 'catalog' && waConfig && (
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-2 mb-6">
              <Store className="text-blue-600" />
              <h2 className="text-lg font-semibold">Diseño del Catálogo Público</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Negocio</label>
                <input 
                  type="text"
                  value={waConfig.catalog_business_name || ''}
                  onChange={(e) => setWaConfig({...waConfig, catalog_business_name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Mi Pizzería"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de WhatsApp (Ventas)</label>
                <input 
                  type="text"
                  value={waConfig.whatsapp_phone || ''}
                  onChange={(e) => setWaConfig({...waConfig, whatsapp_phone: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="Ej: 5491123456789 (Sin + ni guiones)"
                />
                <p className="text-xs text-gray-500 mt-1">El número donde llegarán los pedidos del catálogo.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color de Acento (Hexadecimal)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="color"
                    value={waConfig.catalog_accent_color || '#dc2626'}
                    onChange={(e) => setWaConfig({...waConfig, catalog_accent_color: e.target.value})}
                    className="h-10 w-20 p-1 border rounded cursor-pointer"
                  />
                  <input 
                    type="text"
                    value={waConfig.catalog_accent_color || '#dc2626'}
                    onChange={(e) => setWaConfig({...waConfig, catalog_accent_color: e.target.value})}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    placeholder="#DC2626"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                    <span>Logo (URL)</span>
                    <button 
                      type="button" 
                      onClick={() => document.getElementById('logo-upload')?.click()}
                      className="text-blue-600 text-xs hover:underline"
                    >
                      Subir archivo
                    </button>
                  </label>
                  <input 
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const toastId = toast.loading('Subiendo logo...');
                      try {
                        const path = `branding/logo_${Date.now()}.${file.name.split('.').pop()}`;
                        const { error } = await supabase.storage.from('product-images').upload(path, file);
                        if (error) throw error;
                        const { data } = supabase.storage.from('product-images').getPublicUrl(path);
                        setWaConfig({...waConfig, catalog_logo_url: data.publicUrl});
                        toast.success('Logo subido correctamente', { id: toastId });
                      } catch (err) {
                        toast.error('Error al subir logo', { id: toastId });
                      }
                    }}
                  />
                  <input 
                    type="text"
                    value={waConfig.catalog_logo_url || ''}
                    onChange={(e) => setWaConfig({...waConfig, catalog_logo_url: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="https://..."
                  />
                  {waConfig.catalog_logo_url && (
                    <div className="mt-2 h-20 w-20 rounded-full border bg-gray-50 overflow-hidden flex items-center justify-center">
                      <img src={waConfig.catalog_logo_url} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                    <span>Banner (URL)</span>
                    <button 
                      type="button" 
                      onClick={() => document.getElementById('banner-upload')?.click()}
                      className="text-blue-600 text-xs hover:underline"
                    >
                      Subir archivo
                    </button>
                  </label>
                  <input 
                    id="banner-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const toastId = toast.loading('Subiendo banner...');
                      try {
                        const path = `branding/banner_${Date.now()}.${file.name.split('.').pop()}`;
                        const { error } = await supabase.storage.from('product-images').upload(path, file);
                        if (error) throw error;
                        const { data } = supabase.storage.from('product-images').getPublicUrl(path);
                        setWaConfig({...waConfig, catalog_banner_url: data.publicUrl});
                        toast.success('Banner subido correctamente', { id: toastId });
                      } catch (err) {
                        toast.error('Error al subir banner', { id: toastId });
                      }
                    }}
                  />
                  <input 
                    type="text"
                    value={waConfig.catalog_banner_url || ''}
                    onChange={(e) => setWaConfig({...waConfig, catalog_banner_url: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="https://..."
                  />
                  {waConfig.catalog_banner_url && (
                    <div className="mt-2 h-24 w-full rounded-xl border bg-gray-50 overflow-hidden">
                      <img src={waConfig.catalog_banner_url} alt="Banner preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end pt-4 border-t">
                  <button 
                      onClick={saveWaConfig}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                      <Save size={18} />
                      Guardar Diseño
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'printer' && (
        !printerConfig ? (
          <div className="p-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed">
            <Loader2 className="mx-auto text-blue-400 mb-4 animate-spin" size={48} />
            <h3 className="text-lg font-medium text-gray-800 mb-2">Cargando configuración...</h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-4">
              Si el problema persiste, intente recargar la página.
            </p>
            <button 
              onClick={() => loadSettings()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Reintentar
            </button>
          </div>
        ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Printer className="text-blue-600" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Ticket y Comandera</h2>
                <p className="text-sm text-gray-500">Personaliza el formato de tus tickets térmicos</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">Impresión Automática</h3>
                      <p className="text-xs text-gray-500">Imprimir ticket apenas se confirma un pedido</p>
                    </div>
                    <button
                      onClick={() => setPrinterConfig({...printerConfig, auto_print_enabled: !printerConfig.auto_print_enabled})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        printerConfig.auto_print_enabled ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          printerConfig.auto_print_enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">Logo del Negocio</h3>
                      <p className="text-xs text-gray-500">Subir logo blanco y negro (PNG)</p>
                    </div>
                    <button
                      onClick={() => setPrinterConfig({...printerConfig, print_logo: !printerConfig.print_logo})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        printerConfig.print_logo ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          printerConfig.print_logo ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <button 
                        onClick={() => document.getElementById('printer-logo-upload')?.click()}
                        className="w-full py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition font-medium"
                      >
                        {printerConfig.logo_url ? 'Cambiar Logo' : 'Seleccionar Imagen'}
                      </button>
                      <input 
                        id="printer-logo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const toastId = toast.loading('Subiendo logo...');
                          try {
                            const path = `branding/printer_logo_${Date.now()}.${file.name.split('.').pop()}`;
                            const { error } = await supabase.storage.from('product-images').upload(path, file);
                            if (error) throw error;
                            const { data } = supabase.storage.from('product-images').getPublicUrl(path);
                            setPrinterConfig({...printerConfig, logo_url: data.publicUrl});
                            toast.success('Logo listo', { id: toastId });
                          } catch (err) {
                            toast.error('Error al subir logo', { id: toastId });
                          }
                        }}
                      />
                    </div>
                    {printerConfig.logo_url && (
                        <div className="w-12 h-12 rounded border bg-white overflow-hidden flex items-center justify-center p-1">
                            <img src={printerConfig.logo_url} alt="Logo" className="max-h-full max-w-full object-contain grayscale invert" />
                        </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre del Local (Encabezado)</label>
                    <input 
                      type="text"
                      value={printerConfig.store_name}
                      onChange={(e) => setPrinterConfig({...printerConfig, store_name: e.target.value})}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="@MiLocal"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mensaje de Despedida (Pie)</label>
                    <textarea 
                      value={printerConfig.footer_message}
                      onChange={(e) => setPrinterConfig({...printerConfig, footer_message: e.target.value})}
                      rows={2}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                      placeholder="¡Gracias por su compra!"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Margen Superior (Líneas)</label>
                      <input 
                        type="number"
                        min="0"
                        max="10"
                        value={printerConfig.margin_top}
                        onChange={(e) => setPrinterConfig({...printerConfig, margin_top: parseInt(e.target.value) || 0})}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Margen Inferior (Corte)</label>
                      <input 
                        type="number"
                        min="0"
                        max="20"
                        value={printerConfig.margin_bottom}
                        onChange={(e) => setPrinterConfig({...printerConfig, margin_bottom: parseInt(e.target.value) || 0})}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-100 p-6 rounded-2xl border-2 border-dashed border-gray-300 relative overflow-hidden flex flex-col items-center">
                <div className="absolute top-0 left-0 right-0 bg-gray-200 h-2" />
                <div className="text-[10px] text-gray-400 font-mono mb-4">VISTA PREVIA DEL TICKET</div>
                
                <div className="w-full max-w-[240px] bg-white shadow-lg p-4 font-mono text-[11px] space-y-3 text-gray-800 border-b-2 border-gray-200">
                  {/* Margen Top visual */}
                  {Array.from({ length: Math.min(printerConfig.margin_top, 3) }).map((_, i) => (
                    <div key={i} className="h-2" />
                  ))}
                  {printerConfig.print_logo && printerConfig.logo_url && (
                    <div className="flex justify-center mb-2">
                        <img src={printerConfig.logo_url} alt="Receipt Logo" className="w-16 h-16 object-contain grayscale invert" />
                    </div>
                  )}

                  <div className="text-center font-bold text-sm mb-1">{printerConfig.store_name}</div>
                  <div className="text-center border-b border-dashed border-gray-400 pb-1 mb-2">ORDEN #1234</div>
                  
                  <div className="mb-2">
                    <div className="font-bold">CLIENTE: Juan Pérez</div>
                    <div className="flex items-center gap-1 uppercase">🛵 DELIVERY</div>
                    <div className="italic break-words">Dirección: Av. San Martín 123, Bahía Blanca</div>
                  </div>
                  
                  <div className="border-t border-dashed border-gray-400 pt-1"></div>
                  
                  <div className="flex justify-between">
                    <span>2x Hamburguesa Clásica</span>
                    <span>$12000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1x Coca Cola 500ml</span>
                    <span>$1500</span>
                  </div>
                  
                  <div className="border-t border-dashed border-gray-400 pt-1 mt-2 font-bold flex justify-between text-xs">
                    <span>TOTAL</span>
                    <span>$13500</span>
                  </div>

                  <div className="text-center italic mt-4 px-2 whitespace-pre-wrap">{printerConfig.footer_message}</div>

                   {/* Margen Bottom visual */}
                   {Array.from({ length: Math.min(printerConfig.margin_bottom, 3) }).map((_, i) => (
                    <div key={i} className="h-2" />
                  ))}
                </div>
                <div className="mt-4 text-[10px] text-gray-400 italic">El tamaño real dependerá del papel (58mm/80mm)</div>
                <button 
                  onClick={handleTestPrint}
                  className="mt-6 flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 font-medium transition-all text-xs"
                >
                  <Printer size={14} />
                  Realizar Impresión de Prueba
                </button>
              </div>
            </div>

            <div className="mt-10 flex justify-end pt-6 border-t border-gray-100">
              <button 
                onClick={savePrinterConfig}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Save size={20} />
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
