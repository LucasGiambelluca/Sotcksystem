import { useEffect, useState } from 'react';
import { Users, Package, DollarSign, TrendingUp, AlertCircle, Activity, ArrowRight, MessageCircle, Truck, Settings } from 'lucide-react';
import { clientService } from '../services/clientService';
import { productService } from '../services/productService';
import { supabase } from '../supabaseClient';
import type { Product } from '../types';
import { Link } from 'react-router-dom';
import SalesChart from '../components/SalesChart';
import RecentActivity from '../components/RecentActivity';
import { toast } from 'sonner';

interface DashboardStats {
  totalClients: number;
  totalProducts: number;
  lowStockProducts: number;
  totalDebt: number;
  salesData: { date: string; amount: number }[];
  recentActivity: any[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    totalDebt: 0,
    salesData: [],
    recentActivity: []
  });
  
  const [dashboardConfig, setDashboardConfig] = useState({
    stats: true,
    whatsapp: true,
    routes: true,
    system: true,
    chart: true,
    activity: true
  });
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  
  const [pendingWhatsAppOrders, setPendingWhatsAppOrders] = useState<any[]>([]);
  const [upcomingRoutes, setUpcomingRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // 1. Load config
      const { data: configData } = await supabase
        .from('dashboard_config')
        .select('*')
        .limit(1)
        .single();
        
      if (configData && configData.widgets) {
         setDashboardConfig(configData.widgets);
      }

      // 2. Load Stats
      const [clients, products, movements, waOrders, routes] = await Promise.all([
        clientService.getAll(),
        productService.getAll(),
        supabase.from('movements').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('orders').select('*, clients(*)').eq('channel', 'WHATSAPP').eq('status', 'PENDING').limit(5),
        supabase.from('routes').select('*').gte('date', new Date().toISOString().split('T')[0]).order('date', { ascending: true }).limit(5)
      ]);

      const totalDebt = (movements.data || []).reduce((acc: number, curr: { type: string; amount: number }) => {
        if (curr.type === 'DEBT') return acc + curr.amount;
        if (curr.type === 'PAYMENT') return acc - curr.amount;
        return acc;
      }, 0);

      // Process sales data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();

      const salesData = last7Days.map(date => {
        const dayTotal = (movements.data || [])
          .filter((m: any) => m.created_at.startsWith(date) && m.type === 'DEBT')
          .reduce((acc: number, curr: any) => acc + curr.amount, 0);
        
        return {
          date: new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
          amount: dayTotal
        };
      });

      setStats({
        totalClients: clients.length,
        totalProducts: products.length,
        lowStockProducts: products.filter((p: Product) => p.stock <= 5).length,
        totalDebt: totalDebt,
        salesData,
        recentActivity: (movements.data || []).slice(0, 5)
      });
      
      setPendingWhatsAppOrders(waOrders.data || []);
      setUpcomingRoutes(routes.data || []);

    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWidget = (key: keyof typeof dashboardConfig) => {
    setDashboardConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
       const { data: existing } = await supabase.from('dashboard_config').select('id').limit(1).single();
       if (existing) {
          await supabase.from('dashboard_config').update({ widgets: dashboardConfig }).eq('id', existing.id);
       } else {
          await supabase.from('dashboard_config').insert({ widgets: dashboardConfig });
       }
       toast.success('Configuración del panel guardada');
       setIsEditingConfig(false);
    } catch (e) {
       console.error("Error saving config:", e);
       toast.error('Error al guardar la configuración');
    } finally {
       setSavingConfig(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center text-primary-600">Cargando dashboard...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Panel de Control</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Resumen general de tu negocio</p>
        </div>
        
        <div>
           {isEditingConfig ? (
             <div className="flex items-center gap-2">
                 <button onClick={() => setIsEditingConfig(false)} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                     Cancelar
                 </button>
                 <button onClick={saveConfig} disabled={savingConfig} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors disabled:opacity-50">
                     {savingConfig ? 'Guardando...' : 'Guardar Cambios'}
                 </button>
             </div>
           ) : (
             <button onClick={() => setIsEditingConfig(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors shadow-sm">
                 <Settings size={18} />
                 Personalizar Panel
             </button>
           )}
        </div>
      </div>
      
      {/* 
        EDICIÓN DE WIDGETS 
      */}
      {isEditingConfig && (
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-primary-100 mb-8 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Activar / Desactivar Secciones</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {Object.keys(dashboardConfig).map((key) => {
                  const widgetKey = key as keyof typeof dashboardConfig;
                  const labels: Record<string, string> = {
                     stats: 'Métricas Superiores (Tarjetas)',
                     whatsapp: 'Pedidos de WhatsApp',
                     routes: 'Próximas Entregas',
                     system: 'Estado del Sistema',
                     chart: 'Gráfico de Ventas',
                     activity: 'Actividad Reciente'
                  };
                  return (
                     <label key={widgetKey} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors bg-white">
                        <span className="text-sm font-medium text-gray-700">{labels[widgetKey]}</span>
                        <div className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={dashboardConfig[widgetKey]} onChange={() => toggleWidget(widgetKey)} />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </div>
                     </label>
                  );
               })}
            </div>
         </div>
      )}
      
      {dashboardConfig.stats && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8 animate-in fade-in zoom-in-95">
        {/* Card: Clientes */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-50 p-3 rounded-xl">
              <Users className="text-blue-600" size={24} />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Clientes Totales</h3>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalClients}</p>
        </div>

        {/* Card: Productos */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-50 p-3 rounded-xl">
              <Package className="text-purple-600" size={24} />
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Productos</h3>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalProducts}</p>
        </div>

        {/* Card: Deuda */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-red-50 p-3 rounded-xl">
              <DollarSign className="text-red-600" size={24} />
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Deuda Total</h3>
          <p className="text-3xl font-bold text-gray-900 mt-1">${stats.totalDebt.toFixed(2)}</p>
        </div>

        {/* Card: Stock Bajo */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-yellow-50 p-3 rounded-xl">
              <AlertCircle className="text-yellow-600" size={24} />
            </div>
            {stats.lowStockProducts > 0 && (
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">Atención</span>
            )}
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Stock Bajo</h3>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.lowStockProducts}</p>
        </div>
      </div>
      )}

      {(dashboardConfig.whatsapp || dashboardConfig.routes) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8">
        {/* WhatsApp Pending Orders */}
        {dashboardConfig.whatsapp && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <div className="bg-green-50 p-2 rounded-lg">
                        <MessageCircle className="text-green-600" size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Pedidos WhatsApp</h2>
                </div>
                <Link to="/orders" className="text-sm text-green-600 hover:text-green-700 font-medium">
                    Ver todos
                </Link>
            </div>
            
            <div className="space-y-4">
                {pendingWhatsAppOrders.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">No hay pedidos pendientes de WhatsApp</p>
                ) : (
                    pendingWhatsAppOrders.map((order: any) => (
                        <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-xs">
                                    WA
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                        {order.clients?.name || order.client?.name || 'Cliente desconocido'}
                                    </h4>
                                    <p className="text-xs text-gray-500">
                                        {new Date(order.created_at).toLocaleDateString()} • ${order.total_amount}
                                    </p>
                                </div>
                            </div>
                            <Link to={`/orders/${order.id}`} className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50 text-gray-700">
                                Ver
                            </Link>
                        </div>
                    ))
                )}
            </div>
        </div>
        )}

        {/* Upcoming Deliveries */}
        {dashboardConfig.routes && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
            <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center space-x-3">
                    <div className="bg-indigo-50 p-2 rounded-lg">
                        <Truck className="text-indigo-600" size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Próximas Entregas</h2>
                </div>
                <Link to="/routes" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    Ver todas
                </Link>
            </div>

            <div className="space-y-4">
                 {upcomingRoutes.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">No hay rutas programadas</p>
                ) : (
                    upcomingRoutes.map((route: any) => (
                         <div key={route.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                            <div>
                                <h4 className="font-semibold text-gray-900 text-sm">{route.name}</h4>
                                <p className="text-xs text-gray-500">
                                    {new Date(route.date).toLocaleDateString()} • {route.status === 'DRAFT' ? 'Borrador' : route.status === 'ACTIVE' ? 'Activa' : 'Completada'}
                                </p>
                            </div>
                             <Link to={`/routes/${route.id}`} className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50 text-gray-700">
                                Gestionar
                            </Link>
                        </div>
                    ))
                )}
            </div>
        </div>
        )}
      </div>
      )}

      {(dashboardConfig.system || dashboardConfig.chart || dashboardConfig.activity) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Resumen del Sistema */}
        {dashboardConfig.system && (
        <div className="space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-primary-50 p-2 rounded-lg">
                <Activity className="text-primary-600" size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Estado del Sistema</h2>
            </div>
            <div className="bg-blue-50 rounded-xl p-6 mb-6">
              <div className="flex items-start space-x-3">
                <div className="bg-blue-100 p-1.5 rounded-full mt-0.5">
                  <TrendingUp className="text-blue-600" size={16} />
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900">Sistema Operativo</h4>
                  <p className="text-blue-700 text-sm mt-1">
                    Todas las funciones están activas. La base de datos está conectada y sincronizada.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
               <Link to="/products" className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                  <div className="flex items-center space-x-3">
                    <Package size={20} className="text-gray-400 group-hover:text-primary-600" />
                    <span className="font-medium text-gray-700 group-hover:text-gray-900">Gestionar Inventario</span>
                  </div>
                  <ArrowRight size={18} className="text-gray-400 group-hover:text-primary-600" />
               </Link>
               <Link to="/clients" className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                  <div className="flex items-center space-x-3">
                    <Users size={20} className="text-gray-400 group-hover:text-primary-600" />
                    <span className="font-medium text-gray-700 group-hover:text-gray-900">Ver Clientes</span>
                  </div>
                  <ArrowRight size={18} className="text-gray-400 group-hover:text-primary-600" />
               </Link>
            </div>
          </div>
        </div>
        )}

        {/* Sales Chart */}
        {dashboardConfig.chart && (
        <SalesChart data={stats.salesData} />
        )}

        {/* Recent Activity */}
        {dashboardConfig.activity && (
        <RecentActivity activities={stats.recentActivity} />
        )}
      </div>
      )}
    </div>
  );
}
