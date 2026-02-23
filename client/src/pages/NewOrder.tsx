import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { createOrder, updateClient } from '../services/orderService';
import { sendWhatsAppMessage } from '../services/whatsappService';
import WhatsAppImport from '../components/WhatsAppImport';
import type { Client, Product } from '../types';
import { Save, ArrowLeft, Plus, Trash2, MessageCircle, UserPlus, MapPin } from 'lucide-react';
import { toast } from 'sonner';

// Quick Client Modal Component
function QuickClientModal({ 
  isOpen, 
  onClose, 
  phone, 
  onClientCreated 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  phone: string; 
  onClientCreated: (client: Client) => void; 
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [defaultCity, setDefaultCity] = useState('');

  useEffect(() => {
    const city = localStorage.getItem('stock_app_city');
    const province = localStorage.getItem('stock_app_province');
    if (city) {
        setDefaultCity(`${city}, ${province || ''}`);
    }
  }, []);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let finalAddress = address;
    if (defaultCity && address && !address.toLowerCase().includes(defaultCity.split(',')[0].toLowerCase())) {
        finalAddress = `${address}, ${defaultCity}`;
        toast.info(`Se agregó "${defaultCity}" a la dirección automáticamente`);
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({ name, phone, address: finalAddress })
        .select()
        .single();
      
      if (error) throw error;
      
      toast.success('Cliente creado');
      onClientCreated(data as Client);
      onClose();
    } catch (err: any) {
      toast.error('Error al crear cliente: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const appendCity = () => {
    if (defaultCity && !address.includes(defaultCity)) {
        setAddress(`${address}, ${defaultCity}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">Crear Cliente Rápido</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Teléfono (WhatsApp)</label>
            <input type="text" value={phone} disabled className="w-full px-3 py-2 bg-gray-100 border rounded-lg text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <input 
              type="text" 
              required 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" 
              placeholder="Ej. Juan Pérez"
              autoFocus
            />
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700">Dirección</label>
             <input 
               type="text" 
               required
               value={address} 
               onChange={e => setAddress(e.target.value)} 
               className="w-full px-3 py-2 border rounded-lg" 
               placeholder="Ej. Av. Siempre Viva 123"
             />
             {defaultCity && !address.includes(defaultCity.split(',')[0]) && (
                <button 
                  type="button"
                  onClick={appendCity}
                  className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1 font-medium bg-blue-50 px-2 py-1 rounded w-full"
                >
                  <MapPin size={12} />
                  ¿Agregar "{defaultCity}"?
                </button>
             )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button 
              type="submit" 
              disabled={saving} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditAddressModal({
  isOpen,
  onClose,
  client,
  onUpdate
}: {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  onUpdate: (updatedClient: Client) => void;
}) {
  const [address, setAddress] = useState(client.address || '');
  const [saving, setSaving] = useState(false);
  const [defaultCity, setDefaultCity] = useState('');

  useEffect(() => {
    setAddress(client.address || '');
    const city = localStorage.getItem('stock_app_city');
    const province = localStorage.getItem('stock_app_province');
    if (city) {
        setDefaultCity(`${city}, ${province || ''}`);
    }
  }, [client]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      toast.error('La dirección no puede estar vacía');
      return;
    }
    setSaving(true);

    let finalAddress = address;
    if (defaultCity && address && !address.toLowerCase().includes(defaultCity.split(',')[0].toLowerCase())) {
        finalAddress = `${address}, ${defaultCity}`;
        toast.info(`Se agregó "${defaultCity}" a la dirección automáticamente`);
    }

    const { data, error } = await updateClient(client.id, { address: finalAddress });
    setSaving(false);

    if (error) {
      toast.error('Error al actualizar dirección');
    } else {
      toast.success('Dirección actualizada');
      onUpdate(data as Client);
      onClose();
    }
  };

  const appendCity = () => {
    if (defaultCity && !address.includes(defaultCity)) {
        setAddress(`${address}, ${defaultCity}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">Actualizar Dirección</h3>
        <p className="text-sm text-gray-500 mb-4">Cliente: {client.name}</p>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nueva Dirección</label>
            <input 
              type="text" 
              required
              value={address} 
              onChange={e => setAddress(e.target.value)} 
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" 
              placeholder="Ej. Calle Falsa 123, Ciudad"
              autoFocus
            />
             {defaultCity && !address.includes(defaultCity.split(',')[0]) && (
                <button 
                  type="button"
                  onClick={appendCity}
                  className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1 font-medium bg-blue-50 px-2 py-1 rounded w-full"
                >
                  <MapPin size={12} />
                  ¿Agregar "{defaultCity}"?
                </button>
             )}
            <p className="text-xs text-gray-500 mt-1">Tip: Incluye calle, número y ciudad para mejor ubicación en el mapa.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button 
              type="submit" 
              disabled={saving} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Cambio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewOrder() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false); // New state
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [selectedClientId, setSelectedClientId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState('');
  const [channel, setChannel] = useState<'WEB' | 'WHATSAPP' | 'PHONE' | 'OTHER'>('WEB');
  const [orderItems, setOrderItems] = useState<Array<{ product_id: string; quantity: number; unit_price: number; product_name: string }>>([]);
  const [originalText, setOriginalText] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [clientsRes, productsRes] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
    ]);

    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    if (productsRes.data) setProducts(productsRes.data as Product[]);

    // Check for WhatsApp inbox import (from "Convert to Order" button)
    const waItems = sessionStorage.getItem('whatsapp_order_items');
    const waText = sessionStorage.getItem('whatsapp_order_text');
    const waPhone = sessionStorage.getItem('whatsapp_order_phone');
    if (waPhone) setWhatsappPhone(waPhone);

    if (waItems) {
      try {
        setOrderItems(JSON.parse(waItems));
        setChannel('WHATSAPP');
        if (waText) setOriginalText(waText);

        // Try to auto-select client by phone
        if (waPhone && clientsRes.data) {
          const matchedClient = (clientsRes.data as Client[]).find(
            (c) => c.phone && c.phone.replace(/\D/g, '').includes(waPhone.slice(-8))
          );
          if (matchedClient) {
            setSelectedClientId(matchedClient.id);
          }
        }
      } catch { /* ignore parse errors */ }

      // Clean up sessionStorage
      sessionStorage.removeItem('whatsapp_order_items');
      sessionStorage.removeItem('whatsapp_order_text');
      sessionStorage.removeItem('whatsapp_order_phone');
    }
  }

  const handleAddItem = () => {
    if (products.length === 0) return;
    const firstProduct = products[0];
    setOrderItems([
      ...orderItems,
      {
        product_id: firstProduct.id,
        quantity: 1,
        unit_price: firstProduct.price,
        product_name: firstProduct.name,
      },
    ]);
  };

  const updateItem = (index: number, field: keyof typeof orderItems[0], value: any) => {
    const newItems = [...orderItems];
    if (field === 'product_id') {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].product_id = product.id;
        newItems[index].product_name = product.name;
        newItems[index].unit_price = product.price;
      }
    } else {
      (newItems[index] as any)[field] = value;
    }
    setOrderItems(newItems);
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleWhatsAppImport = (items: any[], text: string) => {
    setOrderItems(items);
    setOriginalText(text);
    setChannel('WHATSAPP');
    toast.success('Pedido importado desde WhatsApp');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      toast.error('Selecciona un cliente');
      return;
    }
    if (orderItems.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }

    setLoading(true);
    const { error } = await createOrder({
      client_id: selectedClientId,
      channel,
      delivery_date: deliveryDate,
      time_slot: timeSlot,
      notes: channel === 'WHATSAPP' ? `📱 Pedido desde WhatsApp\n${originalText}` : undefined,
      original_text: originalText,
      items: orderItems,
    });

    setLoading(false);
    if (error) {
      toast.error('Error al crear pedido');
    } else {
      toast.success('Pedido creado exitosamente');

      // Phase 9: Auto-send confirmation with total via WhatsApp
      if (channel === 'WHATSAPP' && whatsappPhone) {
        try {
          const itemsList = orderItems
            .map(i => `• ${i.quantity}x ${i.product_name} — $${(i.quantity * i.unit_price).toLocaleString('es-AR')}`)
            .join('\n');

          const client = clients.find(c => c.id === selectedClientId);
          const totalFormatted = total.toLocaleString('es-AR');

          const confirmationMsg = [
            `✅ *Pedido registrado*`,
            ``,
            `Hola ${client?.name || ''}! Tu pedido ha sido registrado:`,
            ``,
            itemsList,
            ``,
            `💰 *Total: $${totalFormatted}*`,
            deliveryDate ? `📅 Entrega: ${new Date(deliveryDate + 'T12:00:00').toLocaleDateString('es-AR')}` : '',
            ``,
            `¡Gracias por tu compra! 🙏`,
          ].filter(Boolean).join('\n');

          await sendWhatsAppMessage(whatsappPhone, confirmationMsg);
          toast.success('Confirmación enviada por WhatsApp');
        } catch (err) {
          console.error('Error sending WA confirmation:', err);
          toast.error('Pedido creado, pero no se pudo enviar confirmación por WhatsApp');
        }
      }

      navigate('/orders');
    }
  };

  const total = orderItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/orders')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-3xl font-bold">Nuevo Pedido</h1>
        <div className="flex-1" />
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm"
        >
          <MessageCircle className="w-5 h-5" />
          Importar desde WhatsApp
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Banner for Unknown WhatsApp Client */}
        {whatsappPhone && !selectedClientId && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-yellow-800">
              <MessageCircle className="w-5 h-5" />
              <span>
                <strong>Teléfono detectado: {whatsappPhone}</strong> — El cliente no está registrado.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsQuickClientOpen(true)}
              className="px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg font-medium text-sm border border-yellow-300 transition-colors"
            >
              Registrar Cliente Ahora
            </button>
          </div>
        )}

        {/* Client & Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Detalles del Pedido</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Seleccionar Cliente...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsQuickClientOpen(true)}
                  title="Crear Cliente Rápido"
                  className="p-2 border rounded-lg hover:bg-gray-50"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
              {/* Address Display / Edit */}
              {selectedClientId && (() => {
                 const client = clients.find(c => c.id === selectedClientId);
                 return (
                   <div className="mt-2 text-sm">
                      {client?.address ? (
                        <div className="flex items-center gap-2 text-gray-700 bg-gray-50 p-2 rounded border">
                           <MapPin className="w-4 h-4 text-gray-500" />
                           <span className="flex-1">{client.address}</span>
                           <button 
                             type="button"
                             onClick={() => setIsEditAddressOpen(true)}
                             className="text-blue-600 hover:underline text-xs"
                           >
                             Cambiar
                           </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded border border-red-200">
                           <MapPin className="w-4 h-4" />
                           <span className="flex-1 font-medium">¡Sin dirección registrada!</span>
                           <button 
                             type="button"
                             onClick={() => setIsEditAddressOpen(true)}
                             className="text-blue-700 hover:underline text-xs font-bold"
                           >
                             Agregar Dirección
                           </button>
                        </div>
                      )}
                   </div>
                 );
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Canal de Venta
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="WEB">Web / Directo</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="PHONE">Teléfono</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Entrega
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Franja Horaria
              </label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Cualquie horario</option>
                <option value="Mañana (09 - 13)">Mañana (09 - 13)</option>
                <option value="Tarde (14 - 18)">Tarde (14 - 18)</option>
                <option value="Noche (19 - 22)">Noche (19 - 22)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Productos</h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-2 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Agregar Producto
            </button>
          </div>

          <div className="space-y-4">
            {orderItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                No hay productos agregados. Usa "Importar desde WhatsApp" o agrega manualmente.
              </p>
            ) : (
              orderItems.map((item, index) => (
                <div key={index} className="flex gap-4 items-end bg-gray-50 p-3 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Producto
                    </label>
                    <select
                      value={item.product_id}
                      onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (${p.price})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="w-32 text-right pb-2 font-medium text-gray-700">
                    ${(item.quantity * item.unit_price).toFixed(2)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg mb-0.5"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {orderItems.length > 0 && (
            <div className="flex justify-end mt-6 pt-4 border-t">
              <div className="text-right">
                <p className="text-gray-600">Total Estimado</p>
                <p className="text-3xl font-bold bg-green-100 text-green-800 px-3 py-1 rounded inline-block">
                  ${total.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md disabled:bg-gray-400"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Guardando...' : 'Crear Pedido'}
          </button>
        </div>
      </form>

      <WhatsAppImport
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleWhatsAppImport}
        products={products}
      />

      <QuickClientModal 
        isOpen={isQuickClientOpen}
        onClose={() => setIsQuickClientOpen(false)}
        phone={whatsappPhone}
        onClientCreated={(newClient) => {
          setClients([...clients, newClient]);
          setSelectedClientId(newClient.id);
        }}
      />

      {selectedClientId && (() => {
         const client = clients.find(c => c.id === selectedClientId);
         if (!client) return null;
         return (
           <EditAddressModal
             isOpen={isEditAddressOpen}
             onClose={() => setIsEditAddressOpen(false)}
             client={client}
             onUpdate={(updatedClient) => {
               setClients(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
             }}
           />
         );
      })()}
    </div>
  );
}
