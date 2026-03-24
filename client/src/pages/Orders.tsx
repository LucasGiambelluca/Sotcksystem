import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders } from '../services/orderService';
import type { OrderWithDetails, OrderStatus, OrderChannel } from '../types';
import { Package, Phone, MessageCircle, Globe, Filter, Plus } from 'lucide-react';
import { supabase } from '../supabaseClient';
import Pagination from '../components/common/Pagination';
import { employeeService } from '../services/employeeService';
import { toast } from 'sonner';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [channelFilter, setChannelFilter] = useState<OrderChannel | 'ALL'>('ALL');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [couriers, setCouriers] = useState<any[]>([]);

  // Sound refs & debounce
  const lastSoundTime = useRef<number>(0);
  const SOUND_COOLDOWN_MS = 10000;

  const playSound = useCallback((type: 'newOrder' | 'cancel') => {
    const now = Date.now();
    if (now - lastSoundTime.current < SOUND_COOLDOWN_MS) return;
    lastSoundTime.current = now;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'newOrder') {
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } else {
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    loadCouriers();
    // Reset page when filter changes
    setCurrentPage(1);

    const channel = supabase
      .channel('orders-page-alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          loadOrders(); // Refresh table on any change
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [statusFilter, channelFilter, playSound]);

  async function loadCouriers() {
    try {
      const emps = await employeeService.getAll();
      setCouriers(emps.filter(e => e.role === 'cadete' || e.role === 'delivery'));
    } catch (err) {
      console.error('Error loading couriers:', err);
    }
  }

  async function handleAssignCourier(orderId: string, courierId: string | null) {
      try {
          const { error } = await supabase
              .from('orders')
              .update({ 
                  assigned_to: courierId,
                  assigned_at: courierId ? new Date().toISOString() : null
              })
              .eq('id', orderId);
          
          if (error) throw error;
          toast.success(courierId ? 'Cadete asignado' : 'Asignación removida');
          loadOrders();
      } catch (err) {
          toast.error('Error al asignar cadete');
      }
  }

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

                <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Asignar Cadete</label>
                    <select 
                        className="text-xs border rounded-lg p-1.5 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={order.assigned_to || ''}
                        onChange={(e) => handleAssignCourier(order.id, e.target.value || null)}
                    >
                        <option value="">-- Sin asignar --</option>
                        {couriers && couriers.length > 0 ? (
                            couriers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))
                        ) : (
                            <option disabled>Cargando cadetes...</option>
                        )}
                    </select>
                    {order.assigned_to && (
                        <span className="text-[10px] text-blue-600 font-medium italic">
                           ✓ Asignado a {couriers.find(c => c.id === order.assigned_to)?.name}
                        </span>
                    )}
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
