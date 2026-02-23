import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrderById, updateOrderStatus, updateOrder, updateClient, deleteOrder } from '../services/orderService';
import type { OrderWithDetails, OrderStatus, OrderChannel } from '../types';
import {
  ArrowLeft,
  Package,
  Phone,
  MessageCircle,
  Globe,
  MapPin,
  Calendar,
  Clock,
  Trash2,
  CheckCircle,
  XCircle,
  Truck,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    delivery_date: '',
    time_slot: '',
    channel: '' as OrderChannel,
    notes: '',
    client_name: '',
    client_phone: '',
    client_address: '',
  });

  // Suggestion state
  const [defaultCity, setDefaultCity] = useState('');

  useEffect(() => {
    const city = localStorage.getItem('stock_app_city');
    const province = localStorage.getItem('stock_app_province');
    if (city) {
        setDefaultCity(`${city}, ${province || ''}`);
    }
  }, []);

  const appendCity = () => {
    if (defaultCity && !editForm.client_address.includes(defaultCity)) {
        setEditForm({
            ...editForm,
            client_address: `${editForm.client_address}, ${defaultCity}`
        });
    }
  };

  useEffect(() => {
    if (id) loadOrder();
  }, [id]);

  async function loadOrder() {
    setLoading(true);
    const { data } = await getOrderById(id!);
    if (data) {
      setOrder(data);
    } else {
      toast.error('Pedido no encontrado');
      navigate('/orders');
    }
    setLoading(false);
  }

  function startEditing() {
    if (!order) return;
    setEditForm({
      delivery_date: order.delivery_date || '',
      time_slot: order.time_slot || '',
      channel: order.channel,
      notes: order.notes || '',
      client_name: order.client?.name || '',
      client_phone: order.client?.phone || '',
      client_address: order.client?.address || '',
    });
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  async function saveChanges() {
    if (!order) return;
    setUpdating(true);

    try {
      // Update order fields
      const { error: orderError } = await updateOrder(order.id, {
        delivery_date: editForm.delivery_date || null,
        time_slot: editForm.time_slot || null,
        channel: editForm.channel,
        notes: editForm.notes || null,
      });

      if (orderError) throw orderError;

      // Update client fields if client exists
      if (order.client_id) {
        let finalAddress = editForm.client_address;
        if (defaultCity && finalAddress && !finalAddress.toLowerCase().includes(defaultCity.split(',')[0].toLowerCase())) {
            finalAddress = `${finalAddress}, ${defaultCity}`;
            toast.info(`Se agregó "${defaultCity}" a la dirección automáticamente`);
        }

        const { error: clientError } = await updateClient(order.client_id, {
          name: editForm.client_name,
          phone: editForm.client_phone || null,
          address: finalAddress || null,
        });

        if (clientError) throw clientError;
      }

      toast.success('Pedido actualizado');
      setEditing(false);
      // Reload full order with relations
      await loadOrder();
    } catch (err) {
      toast.error('Error al guardar cambios');
      console.error(err);
    } finally {
      setUpdating(false);
    }
  }

  async function handleStatusChange(newStatus: OrderStatus) {
    if (!order) return;
    setUpdating(true);
    const { error } = await updateOrderStatus(order.id, newStatus);
    if (error) {
      toast.error('Error al actualizar estado');
    } else {
      toast.success('Estado actualizado');
      setOrder({ ...order, status: newStatus });
    }
    setUpdating(false);
  }

  async function handleDelete() {
    if (!order) return;
    if (!confirm('¿Estás seguro de eliminar este pedido?')) return;

    const { error } = await deleteOrder(order.id);
    if (error) {
      toast.error('Error al eliminar pedido');
    } else {
      toast.success('Pedido eliminado');
      navigate('/orders');
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'WHATSAPP':
        return <MessageCircle className="w-5 h-5 text-green-600" />;
      case 'PHONE':
        return <Phone className="w-5 h-5 text-blue-600" />;
      case 'WEB':
        return <Globe className="w-5 h-5 text-purple-600" />;
      default:
        return <Package className="w-5 h-5 text-gray-600" />;
    }
  };

  const getChannelText = (channel: string) => {
    const map: Record<string, string> = {
      WHATSAPP: 'WhatsApp',
      PHONE: 'Teléfono',
      WEB: 'Web',
      OTHER: 'Otro',
    };
    return map[channel] || channel;
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PREPARATION':
        return 'bg-purple-100 text-purple-800';
      case 'IN_TRANSIT':
        return 'bg-indigo-100 text-indigo-800';
      case 'DELIVERED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: OrderStatus) => {
    const statusMap: Record<string, string> = {
      PENDING: 'Pendiente',
      CONFIRMED: 'Confirmado',
      IN_PREPARATION: 'En Preparación',
      IN_TRANSIT: 'En Tránsito',
      DELIVERED: 'Entregado',
      CANCELLED: 'Cancelado',
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!order) return null;

  const subtotal =
    order.items?.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    ) || 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/orders')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Detalle del Pedido</h1>
          <p className="text-sm text-gray-500">
            ID: {order.id.slice(0, 8)}...
          </p>
        </div>
        <span
          className={`px-3 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(
            order.status
          )}`}
        >
          {getStatusText(order.status)}
        </span>
        {!editing ? (
          <button
            onClick={startEditing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={saveChanges}
              disabled={updating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {updating ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={cancelEditing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Client & Order Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            Información del Pedido
          </h2>

          {editing ? (
            /* ===== EDIT MODE ===== */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Client fields */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Cliente
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={editForm.client_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, client_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={editForm.client_phone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, client_phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej. 1123456789"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={editForm.client_address}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        client_address: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej. Av. Siempre Viva 123"
                  />
                  {defaultCity && !editForm.client_address.includes(defaultCity.split(',')[0]) && (
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
              </div>

              {/* Order fields */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Pedido
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Canal de Venta
                  </label>
                  <select
                    value={editForm.channel}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        channel: e.target.value as OrderChannel,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    value={editForm.delivery_date}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        delivery_date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Franja Horaria
                  </label>
                  <select
                    value={editForm.time_slot}
                    onChange={(e) =>
                      setEditForm({ ...editForm, time_slot: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Cualquier horario</option>
                    <option value="Mañana (09 - 13)">Mañana (09 - 13)</option>
                    <option value="Tarde (14 - 18)">Tarde (14 - 18)</option>
                    <option value="Noche (19 - 22)">Noche (19 - 22)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm({ ...editForm, notes: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Notas del pedido..."
                  />
                </div>
              </div>
            </div>
          ) : (
            /* ===== VIEW MODE ===== */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Client */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-700">
                  <Package className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">Cliente:</span>
                  <span>
                    {order.client?.name || 'Cliente desconocido'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">Teléfono:</span>
                  <span>
                    {order.client?.phone || (
                      <span className="text-orange-500 italic">Sin teléfono</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">Dirección:</span>
                  <span>
                    {order.delivery_address || order.client?.address || (
                      <span className="text-orange-500 italic">Sin dirección — Editá para agregar</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-700">
                  {getChannelIcon(order.channel)}
                  <span className="font-medium">Canal:</span>
                  <span>{getChannelText(order.channel)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">Entrega:</span>
                  <span>
                    {order.delivery_date
                      ? new Date(order.delivery_date).toLocaleDateString(
                          'es-AR'
                        )
                      : (
                        <span className="text-orange-500 italic">Sin fecha</span>
                      )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">Franja:</span>
                  <span>
                    {order.time_slot || (
                      <span className="text-gray-400 italic">Cualquier horario</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">Creado:</span>
                  <span>
                    {new Date(order.created_at).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes (view mode only) */}
          {!editing && order.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-gray-700 mb-1">Notas:</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                {order.notes}
              </p>
            </div>
          )}
        </div>

        {/* Products */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Productos</h2>
          {order.items && order.items.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-3 font-medium">Producto</th>
                      <th className="pb-3 font-medium text-center">
                        Cantidad
                      </th>
                      <th className="pb-3 font-medium text-right">
                        Precio Unit.
                      </th>
                      <th className="pb-3 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-3 font-medium">
                          {item.product?.name || 'Producto eliminado'}
                        </td>
                        <td className="py-3 text-center">{item.quantity}</td>
                        <td className="py-3 text-right">
                          ${item.unit_price.toFixed(2)}
                        </td>
                        <td className="py-3 text-right font-medium">
                          ${(item.quantity * item.unit_price).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4 pt-4 border-t">
                <div className="text-right">
                  <p className="text-gray-600 text-sm">Total</p>
                  <p className="text-3xl font-bold text-green-700">
                    ${subtotal.toFixed(2)}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-4">
              Sin productos registrados
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Acciones</h2>
          <div className="flex flex-wrap gap-3">
            {/* PENDING → CONFIRMED */}
            {order.status === 'PENDING' && (
              <button
                onClick={() => handleStatusChange('CONFIRMED')}
                disabled={updating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Confirmar Pedido
              </button>
            )}
            
            {/* CONFIRMED → IN_PREPARATION */}
            {order.status === 'CONFIRMED' && (
              <button
                onClick={() => handleStatusChange('IN_PREPARATION')}
                disabled={updating}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Package className="w-4 h-4" />
                Iniciar Preparación
              </button>
            )}
            
            {/* IN_PREPARATION → IN_TRANSIT */}
            {order.status === 'IN_PREPARATION' && (
              <button
                onClick={() => handleStatusChange('IN_TRANSIT')}
                disabled={updating}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Truck className="w-4 h-4" />
                Enviar Pedido
              </button>
            )}
            
            {/* IN_TRANSIT → DELIVERED */}
            {order.status === 'IN_TRANSIT' && (
              <button
                onClick={() => handleStatusChange('DELIVERED')}
                disabled={updating}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Marcar Entregado
              </button>
            )}
            
            {/* Cancel button (available for non-final statuses) */}
            {order.status !== 'CANCELLED' &&
              order.status !== 'DELIVERED' && (
                <button
                  onClick={() => handleStatusChange('CANCELLED')}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Cancelar Pedido
                </button>
              )}
            <div className="flex-1" />
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
