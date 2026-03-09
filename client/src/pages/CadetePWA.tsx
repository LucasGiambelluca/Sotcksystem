import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { logisticsV2Service } from '../services/logisticsV2Service';
import { employeeService } from '../services/employeeService';
import { shiftService } from '../services/shiftService';
import { 
  Power, Navigation, CheckCircle2, 
  Clock, MapPin, Store, User, 
  Radio, LogOut, TrendingUp, Bell
} from 'lucide-react';
import { toast } from 'sonner';
import { useSound } from '../context/SoundContext';

export default function CadetePWA() {
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeAssignment, setActiveAssignment] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [cadetesDisponibles, setCadetesDisponibles] = useState<any[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const { playNotification } = useSound();
  const [prevAvailableCount, setPrevAvailableCount] = useState(0);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // 1. Check for stored session/shift
  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedEmpId = localStorage.getItem('cadete_id');
        if (storedEmpId) {
          const emps = await employeeService.getAll();
          const emp = emps.find(e => e.id === storedEmpId);
          if (emp) {
            setEmployee(emp);
            // Check for active shift
            const shifts = await shiftService.getActiveShifts();
            const myShift = shifts.find(s => s.employee_id === emp.id);
            if (myShift) {
              setActiveShift(myShift);
              setIsOnline(true);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // 2. Fetch Active Mission
    const fetchAvailable = useCallback(async () => {
        if (!isOnline) return;
        try {
            const orders = await logisticsV2Service.getAvailableOrders();
            if (orders.length > prevAvailableCount) {
                playNotification();
            }
            setPrevAvailableCount(orders.length);
            setAvailableOrders(orders);
        } catch (err) {
            console.error(err);
        }
    }, [isOnline]);

  const fetchMission = useCallback(async () => {
    if (!employee || !isOnline) return;
    try {
      const mission = await logisticsV2Service.getActiveMission(employee.id);
      if (mission && !activeAssignment) {
          playNotification();
      }
      setActiveAssignment(mission);
    } catch (err) {
      console.error(err);
    }
  }, [employee, isOnline]);

    useEffect(() => {
        if (!isOnline) return;
        fetchMission();
        fetchAvailable();
        
        const channel = supabase
            .channel('logistics_pwa_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => fetchMission())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAvailable())
            .subscribe();
        
        return () => { channel.unsubscribe(); };
    }, [employee, isOnline, fetchMission, fetchAvailable]);

  // 3. Location Tracking
  useEffect(() => {
    if (!isOnline || !employee) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        logisticsV2Service.updateLocation(employee.id, latitude, longitude);
      },
      (err) => console.warn('GPS Error:', err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, employee]);

  // 4. Presence Heartbeat (Every 2 minutes)
  useEffect(() => {
    if (!isOnline || !employee) return;
    
    const interval = setInterval(() => {
      logisticsV2Service.updateCadeteStatus(employee.id, true);
    }, 2 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isOnline, employee]);

  // Actions
    const handleStartShift = async (empId: string) => {
        setLoading(true);
        try {
            // Find the employee in our already fetched list
            const empObj = cadetesDisponibles.find(c => c.id === empId);
            if (!empObj) throw new Error('Empleado no encontrado');

            // Find a station (preferably one for delivery/logistics)
            const { data: stations } = await supabase.from('stations').select('*').limit(5);
            const stationId = stations?.find(s => s.name.toLowerCase().includes('reparto'))?.id 
                        || stations?.[0]?.id 
                        || '';
            
            if (!stationId) {
                // If no station exists, create a default one
                const { data: newStation, error: stationErr } = await supabase
                    .from('stations')
                    .insert({ name: 'Reparto', is_active: true, color: '#db2777' })
                    .select()
                    .single();
                if (stationErr) throw stationErr;
                var currentStationId = newStation.id;
            } else {
                var currentStationId = stationId;
            }

            const shift = await shiftService.startShift(empId, currentStationId);
            await logisticsV2Service.updateCadeteStatus(empId, true);
            setEmployee(empObj); // CRITICAL: Set the employee state
            setActiveShift(shift);
            setIsOnline(true);
            localStorage.setItem('cadete_id', empId);
            toast.success('¡Turno iniciado!');
        } catch (err: any) {
            console.error('Error starting shift:', err);
            toast.error(`Error: ${err.message || 'No se pudo iniciar turno'}`);
        } finally {
            setLoading(false);
        }
    };

  const handleEndShift = async () => {
      if (!activeShift) return;
      try {
          await shiftService.endShift(activeShift.id);
          await logisticsV2Service.updateCadeteStatus(employee.id, false);
          setIsOnline(false);
          setActiveAssignment(null);
          toast.success('Turno finalizado');
      } catch (err) {
          toast.error('Error al cerrar turno');
      }
  };

  const handleUpdateStop = async (stopId: string, status: any) => {
      try {
          const stop = activeAssignment.assignment_orders.find((s: any) => s.id === stopId);
          if (stop?.action_type === 'PICKUP') {
              // If it's a PICKUP, complete ALL PICKUP stops in the mission
              const pickups = activeAssignment.assignment_orders.filter((s: any) => s.action_type === 'PICKUP' && s.status !== 'COMPLETED');
              for (const p of pickups) {
                  await logisticsV2Service.updateStopStatus(p.id, status);
              }
          } else {
              await logisticsV2Service.updateStopStatus(stopId, status);
          }
          toast.success('Estado actualizado');
          fetchMission();
      } catch (err) {
          toast.error('Error al actualizar');
      }
  };

    const handleClaimMultiple = async () => {
        if (!employee || selectedOrderIds.length === 0) return;
        setLoading(true);
        try {
            await logisticsV2Service.assignOrdersToCadete(selectedOrderIds, employee.id);
            toast.success(`¡Misión creada con ${selectedOrderIds.length} pedidos!`);
            setSelectedOrderIds([]);
            fetchMission();
            fetchAvailable();
        } catch (err) {
            toast.error('No se pudo crear la ruta');
        } finally {
            setLoading(false);
        }
    };

    const toggleOrderSelection = (id: string) => {
        setSelectedOrderIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

  const openNavigation = (address: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f8fafc]"><Clock className="animate-spin text-red-600" size={40} /></div>;

  // Login Screen if no employee
  if (!employee || !isOnline) {
      return (
          <div className="min-h-screen bg-[#f8fafc] p-6 flex flex-col items-center justify-center font-sans">
              <div className="bg-white w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-gray-100">
                  <Navigation className="text-secondary w-10 h-10" />
              </div>
              <h1 className="text-2xl font-extrabold text-[#0f172a] mb-2 text-center text-red-600">Modo Cadete</h1>
              <p className="text-[#64748b] text-center mb-8 text-sm">Iniciá tu turno para ver tus misiones de reparto.</p>
              
              {showSelector ? (
                  <div className="w-full max-w-xs space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <p className="text-xs font-bold text-gray-400 uppercase text-center mb-2">Seleccioná tu nombre</p>
                      {cadetesDisponibles.length === 0 ? (
                          <div className="bg-white border-2 border-dashed border-gray-100 rounded-3xl p-6 text-center">
                              <p className="text-sm text-gray-400 mb-4">No hay cadetes registrados en el sistema.</p>
                              <button
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        const { data, error } = await supabase.from('employees').insert({
                                            name: 'Cadete de Prueba',
                                            role: 'cadete',
                                            is_active: true
                                        }).select().single();
                                        if (error) throw error;
                                        handleStartShift(data.id);
                                    } catch (err) {
                                        toast.error('Error al crear cadete de prueba');
                                        setLoading(false);
                                    }
                                }}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md"
                              >
                                CREAR CADETE DE PRUEBA
                              </button>
                          </div>
                      ) : (
                          cadetesDisponibles.map(c => (
                              <button
                                key={c.id}
                                onClick={() => handleStartShift(c.id)}
                                className="w-full py-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-gray-700 hover:border-red-500 hover:text-red-500 transition-all flex items-center px-6 gap-4 shadow-sm"
                              >
                                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                      <User size={16} />
                                  </div>
                                  {c.name}
                              </button>
                          ))
                      )}
                      <button 
                        onClick={() => setShowSelector(false)}
                        className="w-full py-2 text-gray-400 text-xs font-bold"
                      >
                          VOLVER
                      </button>
                  </div>
              ) : (
                  <button 
                    onClick={() => {
                        setLoading(true);
                        employeeService.getAll().then(emps => {
                            const filtered = emps.filter(e => e.role === 'cadete' || e.role === 'delivery');
                            if (filtered.length > 0) {
                                setCadetesDisponibles(filtered);
                                setShowSelector(true);
                            } else {
                                toast.error('No hay cadetes registrados');
                            }
                            setLoading(false);
                        });
                    }}
                    className="w-full max-w-xs py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-500/30 active:scale-95 transition-all text-lg flex items-center justify-center gap-3 border-b-4 border-red-800"
                  >
                      <Power size={22} />
                      INICIAR TURNO
                  </button>
              )}
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans pb-24">
      {/* Header */}
      <header className="bg-white p-5 flex justify-between items-center sticky top-0 z-20 shadow-sm border-b border-gray-100">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border border-gray-200">
                <User className="text-gray-400" size={20} />
            </div>
            <div>
                <p className="text-[10px] font-bold text-success uppercase tracking-wider leading-none">Conectado</p>
                <h2 className="text-lg font-bold text-[#0f172a] leading-tight">{employee.name}</h2>
            </div>
        </div>
        <button 
          onClick={handleEndShift}
          className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all border border-gray-100"
        >
            <LogOut size={20} />
        </button>
      </header>

      <main className="flex-1 p-5 overflow-y-auto">
        {!activeAssignment ? (
          <div className="space-y-6">
            {/* Dashboard Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Misiones hoy</p>
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        <span className="text-lg font-black text-gray-800">4</span>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ganado</p>
                    <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-blue-500" />
                        <span className="text-lg font-black text-gray-800">$58.400</span>
                    </div>
                </div>
            </div>

            <div className="mt-4 text-center py-10 opacity-80 flex flex-col items-center bg-white rounded-[40px] border border-dashed border-gray-200 shadow-inner">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-3">
                    <Radio className="text-red-500 animate-pulse" size={28} />
                </div>
                <h3 className="text-lg font-black text-[#0f172a]">Buscando pedidos...</h3>
                <p className="text-xs mt-1 text-gray-500 max-w-[200px]">Te notificaremos cuando haya una misión disponible para vos.</p>
            </div>

            {availableOrders.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 bg-red-600 rounded-full"></div>
                        <h4 className="text-xs font-black text-[#0f172a] uppercase tracking-widest">Bolsa de Pedidos ({availableOrders.length})</h4>
                    </div>
                    
                    <div className="space-y-4">
                        {availableOrders.map(order => {
                            const isSelected = selectedOrderIds.includes(order.id);
                            return (
                                <div 
                                  key={order.id} 
                                  onClick={() => toggleOrderSelection(order.id)}
                                  className={`bg-white rounded-3xl p-5 border-2 transition-all shadow-sm active:scale-95 ${
                                    isSelected ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'
                                  }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                isSelected ? 'bg-red-500 border-red-500' : 'border-gray-200'
                                            }`}>
                                                {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                            </div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Pedido #{order.order_number}</p>
                                        </div>
                                        <span className="text-emerald-600 font-bold text-sm">${order.total_amount?.toLocaleString()}</span>
                                    </div>
                                    <h5 className="text-base font-black text-[#0f172a]">{order.client?.name || 'Cliente'}</h5>
                                    <div className="flex items-center gap-1 text-gray-500 text-xs mt-1">
                                        <MapPin size={12} className="text-blue-500" />
                                        {order.delivery_address || 'Bahía Blanca'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {selectedOrderIds.length > 0 && (
                <div className="fixed bottom-24 left-5 right-5 z-30 animate-in slide-in-from-bottom-10">
                    <button 
                      onClick={handleClaimMultiple}
                      className="w-full py-5 bg-[#0f172a] text-white rounded-3xl font-black shadow-2xl flex items-center justify-center gap-3 border-b-4 border-black active:translate-y-1 transition-all"
                    >
                        <Navigation size={20} className="text-red-500" />
                        ARMAR RUTA ({selectedOrderIds.length})
                    </button>
                </div>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest">Misión Activa</span>
                <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[11px] font-bold border border-red-200">#{activeAssignment.id.slice(-4).toUpperCase()}</span>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 mb-6 relative overflow-hidden">
                {/* Visual indicator of progress */}
                <div className="flex justify-between items-start mb-6 border-b border-dashed border-gray-100 pb-5">
                    <div>
                        <h3 className="text-2xl font-extrabold text-[#0f172a]">${activeAssignment.assignment_orders?.reduce((acc: number, o: any) => acc + (o.order?.total_amount || 0), 0).toLocaleString()}</h3>
                        <p className="text-xs font-semibold text-gray-400">{activeAssignment.assignment_orders?.length} paradas en esta misión</p>
                    </div>
                </div>

                <div className="space-y-8 relative">
                    {(() => {
                        if (activeAssignment.status === 'ASSIGNED') {
                            return (
                                <div className="text-center py-10 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
                                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-2 shadow-inner">
                                        <Bell size={40} className="animate-bounce" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-black text-[#0f172a]">¡Nueva Misión Asignada!</h3>
                                        <p className="text-sm text-gray-500 px-6">Tenés una nueva ruta con {activeAssignment.assignment_orders?.length} paradas.</p>
                                    </div>
                                    <button 
                                      onClick={async () => {
                                          try {
                                              playNotification();
                                              await logisticsV2Service.updateAssignmentStatus(activeAssignment.id, 'IN_PROGRESS');
                                              fetchMission();
                                              toast.success('¡Misión aceptada!');
                                          } catch (err) {
                                              toast.error('Error al aceptar misión');
                                          }
                                      }}
                                      className="w-full py-6 bg-blue-600 text-white rounded-[32px] font-black shadow-2xl shadow-blue-500/30 active:scale-95 transition-all text-lg flex items-center justify-center gap-3 border-b-4 border-blue-900"
                                    >
                                        <Navigation size={24} />
                                        ACEPTAR Y EMPEZAR
                                    </button>
                                </div>
                            );
                        }

                        const rawStops = activeAssignment.assignment_orders || [];
                        const pickups = rawStops.filter((s: any) => s.action_type === 'PICKUP');
                        const deliveries = rawStops.filter((s: any) => s.action_type === 'DELIVERY');
                        const allPickupsDone = pickups.every((p: any) => p.status === 'COMPLETED');
                        const allDeliveriesDone = deliveries.every((d: any) => d.status === 'COMPLETED');
                        
                        const displayStops: any[] = [];
                        if (pickups.length > 0) {
                            displayStops.push({
                                ...pickups[0],
                                isConsolidated: true,
                                count: pickups.length,
                                status: allPickupsDone ? 'COMPLETED' : 'PENDING'
                            });
                        }
                        displayStops.push(...deliveries.sort((a: any, b: any) => a.sequence_number - b.sequence_number));

                        const firstIncomplete = displayStops.find((s: any) => s.status !== 'COMPLETED');

                        if (!firstIncomplete && allDeliveriesDone) {
                            return (
                                <div className="text-center py-6 flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-2">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <h3 className="text-lg font-black text-[#0f172a]">¡Misión Completada!</h3>
                                    <p className="text-sm text-gray-500 px-6">Ya entregaste todos los pedidos de esta ruta.</p>
                                    <button 
                                      onClick={async () => {
                                          try {
                                              await logisticsV2Service.updateAssignmentStatus(activeAssignment.id, 'COMPLETED');
                                              setActiveAssignment(null);
                                              toast.success('¡Misión finalizada!');
                                          } catch (err) {
                                              toast.error('Error al finalizar misión');
                                          }
                                      }}
                                      className="w-full py-5 bg-[#10b981] text-white rounded-3xl font-black shadow-xl shadow-emerald-500/20 active:scale-95 transition-all mt-4"
                                    >
                                        FINALIZAR Y VOLVER AL INICIO
                                    </button>
                                </div>
                            );
                        }

                        return displayStops.map((stop: any, idx: number) => {
                            const isDone = stop.status === 'COMPLETED';
                            const isCurrent = firstIncomplete?.id === stop.id;
                            const address = stop.action_type === 'PICKUP' ? 'S. Martín 450 (Local)' : stop.order?.delivery_address || 'Bahía Blanca';
                            
                            return (
                                <div key={stop.id} className={`flex gap-5 relative ${isDone ? 'opacity-40' : ''}`}>
                                    {/* Connector Line */}
                                    {idx < displayStops.length - 1 && (
                                        <div className="absolute left-4 top-8 bottom-[-32px] w-[2px] bg-gray-100"></div>
                                    )}

                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 z-10 transition-colors ${
                                        isDone ? 'bg-green-500 text-white' : 
                                        isCurrent ? 'bg-red-600 text-white shadow-lg shadow-red-500/20 scale-110' : 
                                        'bg-gray-100 text-gray-400'
                                    }`}>
                                        {stop.action_type === 'PICKUP' ? <Store size={16} /> : <MapPin size={16} />}
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-[#0f172a] truncate max-w-[180px]">
                                                {stop.action_type === 'PICKUP' 
                                                    ? `Retirar ${stop.isConsolidated ? `(${stop.count} pedidos)` : `#${stop.order?.id?.slice(-4).toUpperCase()}`}` 
                                                    : `Entregar #${stop.order?.id?.slice(-4).toUpperCase()}`}
                                            </h4>
                                            <span className="text-[10px] font-bold text-gray-400">
                                                {stop.estimated_arrival ? stop.estimated_arrival.slice(11, 16) : '--:--'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{address}</p>
                                        
                                        {isCurrent && (
                                            <div className="flex flex-col gap-3 mt-5">
                                                <button 
                                                  onClick={() => openNavigation(address)}
                                                  className="w-full py-4 bg-[#2563eb] text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 active:scale-95 transition-all text-sm border-b-4 border-blue-800"
                                                >
                                                    <Navigation size={18} className="animate-pulse" /> 
                                                    NAVEGAR AL DESTINO
                                                </button>
                                                <button 
                                                  onClick={() => handleUpdateStop(stop.id, 'COMPLETED')}
                                                  className="w-full py-4 bg-[#10b981] text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all text-sm border-b-4 border-emerald-800"
                                                >
                                                    <CheckCircle2 size={18} /> 
                                                    {stop.action_type === 'PICKUP' ? 'YA RETIRÉ TODO EL PEDIDO' : 'CONFIRMAR ENTREGA'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>
          </div>
        )}
      </main>

      {/* Persistence / GPS Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-5 bg-white/80 backdrop-blur-md border-t border-gray-100 flex items-center justify-center gap-4 z-20">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-extrabold tracking-wider border border-emerald-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              GPS ACTIVO
          </div>
          <p className="text-[10px] font-bold text-gray-400">Último reporte: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </footer>
    </div>
  );
}
