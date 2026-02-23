import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders } from '../services/orderService';
import type { OrderWithDetails, OrderStatus, OrderChannel } from '../types';
import { Package, Phone, MessageCircle, Globe, Filter, Plus } from 'lucide-react';
import Pagination from '../components/common/Pagination';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [channelFilter, setChannelFilter] = useState<OrderChannel | 'ALL'>('ALL');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    loadOrders();
    // Reset page when filter changes
    setCurrentPage(1);
  }, [statusFilter, channelFilter]);

  async function loadOrders() {
    setLoading(true);
    const filters: any = {};
    if (statusFilter !== 'ALL') filters.status = statusFilter;
    if (channelFilter !== 'ALL') filters.channel = channelFilter;

    const { data } = await getOrders(filters);
    if (data) setOrders(data);
    setLoading(false);
  }

  const getChannelIcon = (channel: OrderChannel) => {
    switch (channel) {
      case 'WHATSAPP':
        return <MessageCircle className="w-4 h-4 text-green-600" />;
      case 'PHONE':
        return <Phone className="w-4 h-4 text-blue-600" />;
      case 'WEB':
        return <Globe className="w-4 h-4 text-purple-600" />;
      default:
        return <Package className="w-4 h-4 text-gray-600" />;
    }
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

  // Pagination logic
  const totalItems = orders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedOrders = orders.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Pedidos</h1>
        <button
          onClick={() => navigate('/orders/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Nuevo Pedido
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <div className="flex gap-4 flex-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="ALL">Todos</option>
                <option value="PENDING">Pendiente</option>
                <option value="CONFIRMED">Confirmado</option>
                <option value="IN_PREPARATION">En Preparación</option>
                <option value="IN_TRANSIT">En Tránsito</option>
                <option value="DELIVERED">Entregado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Canal
              </label>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as any)}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="ALL">Todos</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="WEB">Web</option>
                <option value="PHONE">Teléfono</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No hay pedidos</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {paginatedOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getChannelIcon(order.channel)}
                    <h3 className="font-semibold text-lg">
                      {order.client?.name || 'Cliente desconocido'}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {getStatusText(order.status)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>📍 {order.client?.address || 'Sin dirección'}</p>
                    {order.delivery_date && (
                      <p>
                        📅 {new Date(order.delivery_date).toLocaleDateString('es-AR')}
                        {order.time_slot && ` • ${order.time_slot}`}
                      </p>
                    )}
                    <p>
                      📦 {order.items?.length || 0} producto(s) • ${order.total_amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {orders.length > 0 && !loading && (
          <Pagination 
             currentPage={currentPage}
             totalPages={totalPages}
             onPageChange={setCurrentPage}
             itemsPerPage={itemsPerPage}
             totalItems={totalItems}
          />
      )}
    </div>
  );
}
