import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoutes } from '../services/routeService';
import type { Route, RouteStatus } from '../types';
import { MapPin, Plus, Calendar, Truck, CheckCircle, Car } from 'lucide-react';

import CreateRouteModal from '../components/CreateRouteModal';

export default function Routes() {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<RouteStatus | 'ALL'>('DRAFT');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    loadRoutes();
  }, []);

  async function loadRoutes() {
    setLoading(true);
    const { data } = await getRoutes();
    if (data) setRoutes(data);
    setLoading(false);
  }

  const filteredRoutes = routes.filter(
    (route) => selectedStatus === 'ALL' || route.status === selectedStatus
  );

  const getStatusColor = (status: Route['status']) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'ACTIVE':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: Route['status']) => {
    const statusMap = {
      DRAFT: 'Borrador',
      ACTIVE: 'Activa',
      COMPLETED: 'Completada',
    };
    return statusMap[status];
  };

  return (
    <div className="p-6">
      <CreateRouteModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onRouteCreated={loadRoutes} 
      />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Rutas de Entrega</h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Nueva Ruta
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 bg-white p-1 rounded-lg border w-fit">
        {[
          { id: 'DRAFT', label: 'Borradores', icon: MapPin },
          { id: 'ACTIVE', label: 'En Curso', icon: Truck },
          { id: 'COMPLETED', label: 'Completadas', icon: CheckCircle },
          { id: 'ALL', label: 'Todas', icon: null },
        ].map((status) => (
          <button
            key={status.id}
            onClick={() => setSelectedStatus(status.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedStatus === status.id
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {status.icon && <status.icon className="w-4 h-4" />}
            {status.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : filteredRoutes.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">
            No hay rutas {selectedStatus !== 'ALL' ? 'con este estado' : 'creadas'}
          </p>
          {selectedStatus === 'DRAFT' && (
            <button
              onClick={() => navigate('/routes/planner')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Crear Primera Ruta
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRoutes.map((route) => (
            <div
              key={route.id}
              onClick={() => navigate(`/routes/${route.id}`)}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow cursor-pointer border hover:border-blue-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${
                      route.status === 'ACTIVE' ? 'bg-blue-100 text-blue-600' :
                      route.status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg hover:text-blue-600 transition-colors">
                        {route.name}
                      </h3>
                      <div className="flex gap-2 mt-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            route.status
                          )}`}
                        >
                          {getStatusText(route.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                    <div className="text-sm text-gray-600">
                      <p className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">Fecha:</span>
                        {new Date(route.date).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    
                     <div className="text-sm text-gray-600">
                      <p className="flex items-center gap-2 mb-1">
                         <Car className="w-4 h-4 text-gray-400" />
                         <span className="font-medium">Conductor:</span>
                         {route.driver_name || 'Sin asignar'}
                      </p>
                        {route.start_address && (
                        <p className="flex items-center gap-2 mt-1 truncate" title={route.start_address}>
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">Origen:</span>
                          {route.start_address}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // We don't have orders here fully populated with clients? 
                        // getRoutes returns *, but does it return clients?
                        // Actually getRoutes in routeService just does select('*').
                        // It DOES NOT join orders/clients. 
                        // So we CAN'T generate map URL here without fetching.
                        // Better just navigate to details.
                        navigate(`/routes/${route.id}`);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                    >
                      Ver Detalles y Mapa &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
