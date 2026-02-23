import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getRouteById, 
  updateRoute, 
  updateRouteStatus, 
  removeOrderFromRoute, 
  updateRouteOrderSequence,
  generateGoogleMapsRouteUrl, 
  prepareRouteForExport,
  deleteRoute
} from '../services/routeService';
import { generateWhatsAppMessage } from '../services/orderService';
import type { RouteWithOrders, OrderWithDetails } from '../types';
import { MapPin, MessageCircle, FileDown, ArrowLeft, Navigation, Play, CheckCircle, RotateCcw, Edit2, Save, X, Trash2, ArrowUp, ArrowDown, Printer, Plus } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import AddOrdersModal from '../components/AddOrdersModal';

export default function RouteDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [route, setRoute] = useState<RouteWithOrders | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    date: '',
    driver_name: '',
    start_address: '',
  });
  const [editedStops, setEditedStops] = useState<{ id: string, order: OrderWithDetails, sequence_number: number }[]>([]);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);

  useEffect(() => {
    if (id) loadRoute(id);
  }, [id]);

  async function loadRoute(routeId: string) {
    setLoading(true);
    const { data } = await getRouteById(routeId);
    if (data) {
      setRoute(data);
      // Initialize edit form
      setEditForm({
        name: data.name,
        date: data.date,
        driver_name: data.driver_name || '',
        start_address: data.start_address || '', // New field
      });
      // Initialize stops for editing
      const stops = (data.route_orders || [])
        .sort((a, b) => a.sequence_number - b.sequence_number)
        .map(ro => ({
          id: ro.id, // route_order_id
          order: ro.orders!,
          sequence_number: ro.sequence_number
        }))
        .filter(s => !!s.order);
      setEditedStops(stops);
    }
    setLoading(false);
  }

  const handleStatusChange = async (newStatus: 'DRAFT' | 'ACTIVE' | 'COMPLETED') => {
    if (!route) return;
    try {
      const { error } = await updateRouteStatus(route.id, newStatus);
      if (error) throw error;
      setRoute(prev => prev ? { ...prev, status: newStatus } : null);
      toast.success(`Estado actualizado a ${newStatus}`);
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const handleSaveChanges = async () => {
    if (!route) return;
    setLoading(true);
    try {
      // 1. Update Route Metadata
      const { error: routeError } = await updateRoute(route.id, {
        name: editForm.name,
        date: editForm.date,
        driver_name: editForm.driver_name || null,
        start_address: editForm.start_address || null,
      });
      if (routeError) throw routeError;

      // 2. Update Stops Sequence
      // We only need to update if sequence changed? simpler to update all.
      // And we need to handle deletions? 
      // Deletions in UI remove from 'editedStops'. 
      // We need to compare with original route.route_orders to find deletions.
      
      const currentIds = new Set(editedStops.map(s => s.id));
      
      // Find deleted
      const toDelete = (route.route_orders || []).filter(ro => !currentIds.has(ro.id));
      
      const deletePromises = toDelete.map(ro => removeOrderFromRoute(route.id, ro.order_id));
      
      // Update sequences
      const updatePromises = editedStops.map((stop, index) => 
        updateRouteOrderSequence(stop.id, index + 1)
      );

      await Promise.all([...deletePromises, ...updatePromises]);

      toast.success('Cambios guardados');
      setIsEditing(false);
      loadRoute(route.id); // Reload to get fresh state
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar cambios');
      setLoading(false);
    }
  };

  const moveStop = (index: number, direction: 'up' | 'down') => {
    const newStops = [...editedStops];
    if (direction === 'up' && index > 0) {
      [newStops[index], newStops[index - 1]] = [newStops[index - 1], newStops[index]];
    } else if (direction === 'down' && index < newStops.length - 1) {
      [newStops[index], newStops[index + 1]] = [newStops[index + 1], newStops[index]];
    }
    setEditedStops(newStops);
  };

  const removeStop = (index: number) => {
    const newStops = [...editedStops];
    newStops.splice(index, 1);
    setEditedStops(newStops);
  };

  const handleDeleteRoute = async () => {
    if (!route) return;
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta ruta? Esta acción no se puede deshacer.')) {
      return;
    }

    setLoading(true);
    const { error } = await deleteRoute(route.id);
    
    if (error) {
      toast.error('Error al eliminar la ruta');
      setLoading(false);
    } else {
      toast.success('Ruta eliminada correctamente');
      navigate('/routes');
    }
  };

  const handleOpenMaps = () => {
    if (!route) return;
    const orders = route.route_orders
      ?.sort((a, b) => a.sequence_number - b.sequence_number)
      .map((ro) => ro.orders)
      .filter((o): o is NonNullable<typeof o> => !!o) || [];

    const url = generateGoogleMapsRouteUrl(orders, route.start_address);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error('No se pudo generar la ruta');
    }
  };

  const handleSendWhatsApp = (clientName: string, phone: string, orderId: string, estimatedTime?: string) => {
    const url = generateWhatsAppMessage('delivery', {
      clientName,
      phone,
      orderId,
      estimatedTime,
    });
    window.open(url, '_blank');
  };

  const handleShareToDriver = () => {
    if (!route) return;
    const orders = route.route_orders
      ?.sort((a, b) => a.sequence_number - b.sequence_number)
      .map((ro) => ro.orders)
      .filter((o): o is NonNullable<typeof o> => !!o) || [];

    const url = generateGoogleMapsRouteUrl(orders, route.start_address);
    
    if (!url) {
        toast.error('No se pudo generar la ruta para compartir');
        return;
    }
    
    const driver = route.driver_name || 'Chofer';
    const date = new Date(route.date).toLocaleDateString();
    const text = `Hola ${driver}, aquí tienes tu hoja de ruta del día ${date}:

${url}

Total paradas: ${orders.length}
Buen viaje! 🚚`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleExportExcel = () => {
    if (!route) return;

    const exportData = prepareRouteForExport(route);
    const wb = XLSX.utils.book_new();

    // Sheet 1: Route Summary
    const summaryData = [
      ['Ruta', exportData.routeName],
      ['Fecha', exportData.date],
      ['Conductor', exportData.driver],
      ['Total Paradas', exportData.stops.length],
      [],
      ['#', 'Cliente', 'Dirección', 'Teléfono', 'Total'],
    ];

    exportData.stops.forEach((stop) => {
      summaryData.push([
        stop.sequence.toString(),
        stop.clientName,
        stop.address,
        stop.phone,
        `$${stop.orderTotal.toFixed(2)}`,
      ]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

    // Sheet 2: Picking List
    const pickingData: any[] = [
      ['Producto', 'Cantidad Total', 'Cliente(s)'],
    ];

    const productMap = new Map<string, { quantity: number; clients: string[] }>();

    exportData.stops.forEach((stop) => {
      stop.items.forEach((item) => {
        const existing = productMap.get(item.productName);
        if (existing) {
          existing.quantity += item.quantity;
          if (!existing.clients.includes(stop.clientName)) {
            existing.clients.push(stop.clientName);
          }
        } else {
          productMap.set(item.productName, {
            quantity: item.quantity,
            clients: [stop.clientName],
          });
        }
      });
    });

    productMap.forEach((value, productName) => {
      pickingData.push([
        productName,
        value.quantity,
        value.clients.join(', '),
      ]);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(pickingData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Lista de Picking');

    XLSX.writeFile(wb, `Ruta_${exportData.routeName}_${exportData.date}.xlsx`);
    toast.success('Excel exportado exitosamente');
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="p-6">
        <p className="text-center text-gray-500">Ruta no encontrada</p>
      </div>
    );
  }

  // Display logic: use `editedStops` in edit mode, `route.route_orders` in view mode
  // Display logic: Normalize to common structure
  const displayStops = isEditing 
    ? editedStops.map(s => ({ ...s, sequence: -1 })) 
    : (route.route_orders || [])
        .sort((a, b) => a.sequence_number - b.sequence_number)
        // Normalize 'orders' to 'order'
        .map(ro => ({ ...ro, order: ro.orders! }));

  return (
    <div className="p-6 print:p-0">
      <AddOrdersModal
        isOpen={isAddOrderModalOpen}
        onClose={() => setIsAddOrderModalOpen(false)}
        routeId={route.id}
        onOrdersAdded={() => loadRoute(route.id)}
        currentOrderIds={route.route_orders?.map(ro => ro.order_id) || []}
      />
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 print:hidden">
        <button
          onClick={() => navigate('/routes')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          {isEditing ? (
             <input 
               type="text" 
               value={editForm.name} 
               onChange={e => setEditForm({...editForm, name: e.target.value})}
               className="text-3xl font-bold border-b border-gray-300 focus:border-blue-500 outline-none w-full"
             />
          ) : (
             <h1 className="text-3xl font-bold">{route.name}</h1>
          )}
          
          <div className="text-gray-600 flex flex-col gap-2 mt-1">
             {isEditing ? (
               <div className="flex flex-col gap-2">
                 <div className="flex gap-4">
                    <input 
                      type="date" 
                      value={editForm.date}
                      onChange={e => setEditForm({...editForm, date: e.target.value})}
                      className="border rounded px-2 py-1"
                    />
                    <input 
                      type="text" 
                      placeholder="Conductor"
                      value={editForm.driver_name}
                      onChange={e => setEditForm({...editForm, driver_name: e.target.value})}
                      className="border rounded px-2 py-1"
                    />
                 </div>
                 <input 
                    type="text" 
                    placeholder="Punto de Partida (Dirección de Depósito)"
                    value={editForm.start_address}
                    onChange={e => setEditForm({...editForm, start_address: e.target.value})}
                    className="border rounded px-2 py-1 w-full"
                  />
               </div>
             ) : (
               <>
                 <p>
                   {new Date(route.date).toLocaleDateString('es-AR')} • {route.driver_name || 'Sin conductor asignado'}
                 </p>
                 {route.start_address && (
                   <p className="flex items-center gap-1 text-sm bg-gray-50 w-fit px-2 py-1 rounded">
                     <MapPin className="w-3 h-3 text-blue-500" />
                     Origen: {route.start_address}
                   </p>
                 )}
               </>
             )}
             
             {!isEditing && (
               <div className="mt-1">
                 <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                   route.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' :
                   route.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                   'bg-gray-100 text-gray-800'
                 }`}>
                   {route.status === 'DRAFT' ? 'BORRADOR' : route.status === 'ACTIVE' ? 'EN CURSO' : 'COMPLETADA'}
                 </span>
               </div>
             )}
          </div>
        </div>





        {/* Edit/Save Actions */}
        <div className="flex gap-2">
           {isEditing ? (
             <>
               <button onClick={handleSaveChanges} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                 <Save className="w-4 h-4" /> Guardar
               </button>
               <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                 <X className="w-4 h-4" /> Cancelar
               </button>
             </>
           ) : (
             route.status !== 'COMPLETED' && (
               <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                 <Edit2 className="w-4 h-4" /> Editar
               </button>
             )
           )}
        </div>
      </div>

      {/* Action Buttons Toolbar (View Mode Only) */}
      {!isEditing && (
        <div className="flex flex-wrap gap-3 mb-6 print:hidden">
          {route.status === 'DRAFT' && (
            <button
              onClick={() => handleStatusChange('ACTIVE')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
            >
              <Play className="w-5 h-5" />
              Iniciar Ruta
            </button>
          )}
          {route.status === 'ACTIVE' && (
             <>
              <button
                onClick={() => handleStatusChange('COMPLETED')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm"
              >
                <CheckCircle className="w-5 h-5" />
                Finalizar Ruta
              </button>
              <button
                onClick={() => handleStatusChange('DRAFT')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                <RotateCcw className="w-5 h-5" />
                Volver a Borrador
              </button>
            </>
          )}
          
          <div className="w-px h-8 bg-gray-300 mx-2 hidden md:block"></div>

          <button
            onClick={handleShareToDriver}
            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#128C7E] font-medium transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            Enviar a Chofer
          </button>

          <button
            onClick={() => navigate(`/routes/${route.id}/planner`)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <MapPin className="w-5 h-5" />
            Planificar / Optimizar
          </button>
          <button
            onClick={handleOpenMaps}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Navigation className="w-5 h-5" />
            Ver en Maps
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <FileDown className="w-5 h-5" />
            Excel
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Printer className="w-5 h-5" />
            Imprimir
          </button>
          
          {route.status === 'DRAFT' && (
            <button
               onClick={handleDeleteRoute}
               className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 ml-auto"
            >
               <Trash2 className="w-5 h-5" />
               Eliminar
            </button>
          )}
        </div>
      )}

      {/* Printable Header (Only shows when printing) */}
      <div className="hidden print:block mb-6">
         <h1 className="text-2xl font-bold">{route.name}</h1>
         <p className="text-gray-600">Fecha: {new Date(route.date).toLocaleDateString()} | Conductor: {route.driver_name || 'N/A'}</p>
      </div>

      {/* Stops List */}
      <div className="bg-white rounded-lg shadow print:shadow-none print:border">
        <div className="p-4 border-b print:bg-gray-50 flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            Paradas ({displayStops.length})
          </h2>
          {!isEditing && route.status === 'DRAFT' && (
            <button
               onClick={() => setIsAddOrderModalOpen(true)}
               className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium"
            >
               <Plus className="w-4 h-4" /> Agregar Pedido
            </button>
          )}
        </div>
        <div className="divide-y">
          {displayStops.map((item, index) => {
            // Normalize item structure (view mode vs edit mode item)
            // Edit mode item: { id, order, sequence_number }
            // View mode item: { id, orders, sequence_number, ... } (RouteOrder type)
            // Ideally we normalized earlier.
            
            // normalized to always have .order
            // @ts-ignore
            const order = item.order;

            if (!order) return (
              <div key={item.id} className="p-4 bg-red-50 text-red-600">
                Pedido no encontrado (ID: {item.id})
              </div>
            );
            const sequence = index + 1; // Always calculate distinct sequence for display

            return (
              <div key={item.id} className="p-4 hover:bg-gray-50 group print:break-inside-avoid">
                <div className="flex items-start gap-4">
                  {isEditing ? (
                    <div className="flex flex-col gap-1 text-gray-400">
                      <button onClick={() => moveStop(index, 'up')} disabled={index === 0} className="hover:text-blue-600 disabled:opacity-30">
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => moveStop(index, 'down')} disabled={index === displayStops.length - 1} className="hover:text-blue-600 disabled:opacity-30">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                  
                  <div className={`rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0 ${
                    isEditing ? 'bg-gray-100 text-gray-600' : 'bg-blue-600 text-white'
                  }`}>
                    {sequence}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">
                      {order.client?.name}
                    </h3>
                    <div className="text-sm text-gray-600 space-y-1 mb-3">
                      <p className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {order.client?.address}
                      </p>
                      {order.client?.phone && (
                        <p>📱 {order.client.phone}</p>
                      )}
                      <p>💰 Total: ${order.total_amount.toFixed(2)}</p>
                    </div>
                    <div className="space-y-1 print:hidden">
                      <p className="text-sm font-medium">Items ({order.items?.length}):</p>
                      {/* Only show first 2 items to save space, unless printing? No, show all but compact */}
                      {order.items?.map((prod: any) => (
                        <span key={prod.id} className="inline-block bg-gray-100 rounded px-2 py-0.5 text-xs text-gray-700 mr-2 mb-1">
                          {prod.quantity}x {prod.product?.name}
                        </span>
                      ))}
                    </div>
                    {/* Full item list for print */}
                    <div className="hidden print:block space-y-1 mt-2">
                       <ul className="list-disc pl-5 text-sm">
                         {order.items?.map((prod: any) => (
                           <li key={prod.id}>{prod.quantity}x {prod.product?.name}</li>
                         ))}
                       </ul>
                       <div className="mt-2 pt-2 border-t text-sm font-bold">
                          Cobrar: ${order.total_amount.toFixed(2)}
                       </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 print:hidden">
                    {isEditing ? (
                       <button onClick={() => removeStop(index)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                         <Trash2 className="w-5 h-5" />
                       </button>
                    ) : (
                      order.client?.phone && (
                        <button
                          onClick={() =>
                            handleSendWhatsApp(
                              order.client?.name || '',
                              order.client?.phone || '',
                              order.id,
                              'estimated_arrival' in item ? item.estimated_arrival || undefined : undefined
                            )
                          }
                          className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Avisar
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
