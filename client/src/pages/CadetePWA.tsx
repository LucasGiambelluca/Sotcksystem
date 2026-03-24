import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { logisticsV2Service } from '../services/logisticsV2Service';
import { employeeService } from '../services/employeeService';
import { shiftService } from '../services/shiftService';
import { updateOrderStatus } from '../services/orderService';
import { 
  Power, Navigation, CheckCircle2, 
  Clock, MapPin, Store, User, 
  Radio, LogOut, TrendingUp, BellRing
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
        if (!isOnline || !employee) return;
        try {
            const orders = await logisticsV2Service.getAvailableOrders(employee.id);
            if (orders.length > prevAvailableCount) {
                playNotification();
            }
            setPrevAvailableCount(orders.length);
            setAvailableOrders(orders);
        } catch (err) {
            console.error(err);
        }
    }, [isOnline, employee, prevAvailableCount, playNotification]);

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
  }, [employee, isOnline, activeAssignment, playNotification]);

    useEffect(() => {
        if (!isOnline || !employee) return;
        
        fetchMission();
        fetchAvailable();
        
        // Comprehensive Realtime Subscription
        const channel = supabase
            .channel(`cadete_${employee.id}_updates`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'assignments', 
                filter: `cadete_id=eq.${employee.id}` 
            }, () => fetchMission())
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'assignment_orders' 
            }, () => fetchMission())
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders'
            }, () => fetchAvailable())
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
              
              // NEW: If delivery is completed, update the main order status to DELIVERED
              if (stop?.action_type === 'DELIVERY' && status === 'COMPLETED' && stop.order_id) {
                  console.log(`[CadetePWA] Confirming final delivery for order ${stop.order_id}`);
                  await updateOrderStatus(stop.order_id, 'DELIVERED');
              }
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
          <div className="min-h-screen bg-[#0f172a] p-8 flex flex-col items-center justify-center font-sans relative overflow-hidden">
              {/* Decorative background elements */}
              <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[40%] bg-red-600/10 rounded-full blur-[120px] pointer-events-none"></div>
              <div className="absolute bottom-[-5%] left-[-5%] w-[50%] h-[30%] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>

              <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
                  <div className="bg-white/5 backdrop-blur-2xl w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl border border-white/10 group hover:scale-110 transition-transform duration-500">
                      <Navigation className="text-red-500 w-12 h-12 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                  </div>
                  
                  <div className="text-center mb-10 space-y-2">
                      <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">
                        Modo <span className="text-red-500">Cadete</span>
                      </h1>
                      <p className="text-slate-400 font-medium text-sm">Tu centro de operaciones logísticas en tiempo real.</p>
                  </div>
                  
                  {showSelector ? (
                      <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] text-center mb-4">Identificate para Continuar</p>
                          {cadetesDisponibles.length === 0 ? (
                              <div className="bg-white/5 backdrop-blur-md border border-dashed border-white/10 rounded-[2.5rem] p-10 text-center">
                                  <p className="text-sm text-slate-500 font-medium">No hay personal logístico registrado.</p>
                              </div>
                          ) : (
                              <div className="grid gap-4 max-h-[40vh] overflow-y-auto px-2 no-scrollbar">
                                  {cadetesDisponibles.map(c => (
                                      <button
                                        key={c.id}
                                        onClick={() => handleStartShift(c.id)}
                                        className="w-full py-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl font-black text-white hover:bg-white/10 hover:border-red-500/50 transition-all flex items-center px-8 gap-5 group shadow-lg"
                                      >
                                          <div className="w-10 h-10 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 group-hover:bg-red-500 group-hover:text-white transition-colors shadow-inner">
                                              <User size={20} />
                                          </div>
                                          <span className="text-lg tracking-tight uppercase italic">{c.name}</span>
                                          <CheckCircle2 size={16} className="ml-auto text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </button>
                                  ))}
                              </div>
                          )}
                          <button 
                            onClick={() => setShowSelector(false)}
                            className="w-full py-4 text-slate-500 text-xs font-black tracking-widest hover:text-white transition-colors mt-4"
                          >
                              ← VOLVER ATRÁS
                          </button>
                      </div>
                  ) : (
                    <div className="w-full flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-700">
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
                            className="w-full py-6 bg-red-600 text-white rounded-[2.5rem] font-black shadow-[0_20px_60px_rgba(220,38,38,0.4)] active:scale-95 transition-all text-xl flex items-center justify-center gap-4 border-b-4 border-red-800"
                        >
                            <Power size={26} />
                            INICIAR TURNO
                        </button>
                        
                        <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black tracking-widest uppercase opacity-50">
                            <div className="w-8 h-[1px] bg-slate-700"></div>
                            V0.4 ALPHA
                            <div className="w-8 h-[1px] bg-slate-700"></div>
                        </div>
                    </div>
                  )}
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col font-sans pb-24 relative overflow-x-hidden">
      {/* Dynamic Background Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-30 px-6 py-5 bg-slate-900/60 backdrop-blur-xl border-b border-white/5 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-4">
            <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-tr from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border border-white/10 shadow-inner">
                    <User className="text-slate-400" size={24} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-lg"></div>
            </div>
            <div>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] leading-none mb-1">En Línea</p>
                <h2 className="text-xl font-black text-white leading-tight tracking-tight">{employee.name}</h2>
            </div>
        </div>
        <button 
          onClick={handleEndShift}
          className="p-3 bg-white/5 text-slate-400 rounded-2xl hover:bg-red-500/10 hover:text-red-400 transition-all border border-white/5 active:scale-90"
        >
            <LogOut size={22} />
        </button>
      </header>

      <main className="flex-1 p-6 z-10 space-y-8 max-w-lg mx-auto w-full">
        {!activeAssignment ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Dashboard Stats */}
            <div className="grid grid-cols-2 gap-5">
                <div className="bg-white/5 backdrop-blur-md p-5 rounded-[2rem] border border-white/10 shadow-xl group hover:bg-white/10 transition-colors">
                    <div className="bg-emerald-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3 border border-emerald-500/20">
                        <CheckCircle2 size={20} className="text-emerald-500" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Misiones hoy</p>
                    <span className="text-2xl font-black text-white">4</span>
                </div>
                <div className="bg-white/5 backdrop-blur-md p-5 rounded-[2rem] border border-white/10 shadow-xl group hover:bg-white/10 transition-colors">
                    <div className="bg-blue-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3 border border-blue-500/20">
                        <TrendingUp size={20} className="text-blue-500" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ganado</p>
                    <span className="text-2xl font-black text-white">$58.400</span>
                </div>
            </div>

            {/* Pulsing Radar Section */}
            <div className="relative py-14 flex flex-col items-center justify-center bg-gradient-to-b from-white/5 via-transparent to-transparent rounded-[3rem] border border-white/5 overflow-hidden">
                {/* Sonar Effect */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-40 h-40 bg-red-500/10 rounded-full animate-ping duration-[3000ms]"></div>
                    <div className="absolute w-60 h-60 bg-red-500/5 rounded-full animate-ping duration-[4000ms]"></div>
                </div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-red-500/40 rotate-12 group-hover:rotate-0 transition-transform">
                        <Radio className="text-white animate-pulse" size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Rastreo de Pedidos</h3>
                    <p className="text-slate-400 text-sm mt-2 max-w-[240px] font-medium">Buscando misiones cercanas para asignarte automáticamente.</p>
                </div>
            </div>

            {availableOrders.length > 0 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-6 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
                            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Pedidos Disponibles</h4>
                        </div>
                        <span className="bg-white/10 text-white text-[10px] font-black px-3 py-1 rounded-full border border-white/5">{availableOrders.length} DISPONIBLES</span>
                    </div>
                    
                    <div className="grid gap-4">
                        {availableOrders.map((order, idx) => {
                            const isSelected = selectedOrderIds.includes(order.id);
                            return (
                                <div 
                                  key={order.id} 
                                  onClick={() => toggleOrderSelection(order.id)}
                                  style={{ animationDelay: `${idx * 100}ms` }}
                                  className={`group relative bg-slate-900 rounded-[2rem] p-6 border-2 transition-all transition-all animate-in fade-in slide-in-from-right-4 shadow-xl ${
                                    isSelected 
                                        ? 'border-red-500 ring-8 ring-red-500/5 bg-slate-800' 
                                        : 'border-white/5 hover:border-white/15'
                                  }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                                isSelected ? 'bg-red-500 border-red-500 rotate-[360deg]' : 'border-slate-700'
                                            }`}>
                                                {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                            </div>
                                            <p className="text-[10px] font-mono font-bold text-slate-500">ORDEN #{order.order_number}</p>
                                        </div>
                                        <div className="bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                                            <span className="text-emerald-400 font-black text-sm">${order.total_amount?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <h5 className="text-lg font-black text-white group-hover:text-red-400 transition-colors uppercase tracking-tight">{order.client?.name || 'Cliente'}</h5>
                                    <div className="flex items-center gap-2 text-slate-400 text-xs mt-2 font-medium">
                                        <MapPin size={14} className="text-red-500/70" />
                                        <span className="truncate">{order.delivery_address || 'Bahía Blanca'}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {selectedOrderIds.length > 0 && (
                <div className="fixed bottom-32 left-8 right-8 z-40 animate-in slide-in-from-bottom-20 duration-500">
                    <button 
                      onClick={handleClaimMultiple}
                      className="w-full py-6 bg-red-600 text-white rounded-[2.5rem] font-black shadow-[0_20px_50px_rgba(220,38,38,0.4)] flex items-center justify-center gap-4 border-b-4 border-red-800 active:translate-y-1 active:border-b-0 transition-all text-xl"
                    >
                        <Navigation size={24} className="animate-pulse" />
                        TOMAR RUTA ({selectedOrderIds.length})
                    </button>
                </div>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-5 duration-700 space-y-6">
            <div className="flex items-center justify-between px-2">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Misión Activa</span>
                <span className="bg-white/5 backdrop-blur-sm text-red-400 px-4 py-1.5 rounded-full text-[11px] font-black border border-white/10 shadow-lg">#{activeAssignment.id.slice(-4).toUpperCase()}</span>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-2xl rounded-[3rem] p-8 shadow-2xl border border-white/5 relative overflow-hidden group">
                {/* Background lighting */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full"></div>

                <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total a Recaudar</p>
                        <h3 className="text-4xl font-black text-white tracking-tighter">${activeAssignment.assignment_orders?.reduce((acc: number, o: any) => acc + (o.order?.total_amount || 0), 0).toLocaleString()}</h3>
                    </div>
                    <div className="bg-white/5 p-4 rounded-[2rem] border border-white/5 text-center min-w-[80px]">
                        <p className="text-2xl font-black text-white leading-none">{activeAssignment.assignment_orders?.length}</p>
                        <p className="text-[8px] font-extrabold text-slate-500 uppercase mt-1">Paradas</p>
                    </div>
                </div>

                <div className="space-y-10 relative">
                    {(() => {
                        if (activeAssignment.status === 'ASSIGNED') {
                            return (
                                <div className="text-center py-10 flex flex-col items-center gap-8 animate-in zoom-in-95 duration-500">
                                    <div className="relative">
                                        <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 shadow-[inset_0_0_20px_rgba(59,130,246,0.2)]">
                                            <BellRing size={48} className="animate-bounce" />
                                        </div>
                                        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-[40px] animate-pulse"></div>
                                    </div>
                                    <div className="space-y-3">
                                        <h3 className="text-2xl font-black text-white tracking-tight uppercase">Nueva Ruta Disponible</h3>
                                        <p className="text-slate-400 text-sm px-6 font-medium">Se te ha asignado una misión con {activeAssignment.assignment_orders?.length} destinos prioritarios.</p>
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
                                      className="w-full py-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-[2.5rem] font-black shadow-[0_20px_50px_rgba(37,99,235,0.4)] active:scale-95 transition-all text-xl flex items-center justify-center gap-4 border-b-4 border-blue-800"
                                    >
                                        <Navigation size={26} />
                                        INICIAR LOGÍSTICA
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
                                <div className="text-center py-8 flex flex-col items-center gap-6 animate-in zoom-in duration-500">
                                    <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                                        <CheckCircle2 size={48} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-black text-white uppercase tracking-tight">¡Objetivos Logrados!</h3>
                                        <p className="text-slate-400 text-sm font-medium">Todas las entregas fueron completadas con éxito.</p>
                                    </div>
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
                                      className="w-full py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black shadow-2xl shadow-emerald-600/30 active:scale-95 transition-all mt-4 text-lg border-b-4 border-emerald-800"
                                    >
                                        CERRAR MISIÓN Y VOLVER
                                    </button>
                                </div>
                            );
                        }

                        return displayStops.map((stop: any, idx: number) => {
                            const isDone = stop.status === 'COMPLETED';
                            const isCurrent = firstIncomplete?.id === stop.id;
                            const address = stop.action_type === 'PICKUP' ? 'S. Martín 450 (Local)' : stop.order?.delivery_address || 'Bahía Blanca';
                            
                            return (
                                <div key={stop.id} className={`flex gap-6 relative transition-all duration-500 ${isDone ? 'opacity-30 blur-[0.5px]' : ''}`}>
                                    {/* Vertical Connector */}
                                    {idx < displayStops.length - 1 && (
                                        <div className={`absolute left-[1.15rem] top-10 bottom-[-40px] w-0.5 ${isDone ? 'bg-emerald-500/50' : 'bg-white/5'}`}></div>
                                    )}

                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 z-10 transition-all duration-500 ${
                                        isDone ? 'bg-emerald-500 text-white rotate-[360deg]' : 
                                        isCurrent ? 'bg-red-600 text-white shadow-[0_0_25px_rgba(220,38,38,0.5)] scale-125 border-2 border-white/20' : 
                                        'bg-slate-800 text-slate-500 border border-white/5'
                                    }`}>
                                        {stop.action_type === 'PICKUP' ? <Store size={20} /> : <MapPin size={20} />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`font-black text-lg truncate tracking-tight transition-colors ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                                                {stop.action_type === 'PICKUP' 
                                                    ? `RETIRO LOCAL ${stop.isConsolidated ? `(${stop.count})` : ''}` 
                                                    : `ENTREGA #${stop.order?.id?.slice(-4).toUpperCase()}`}
                                            </h4>
                                            <span className="text-[10px] font-black text-slate-600 font-mono mt-1 whitespace-nowrap">
                                                {stop.estimated_arrival ? stop.estimated_arrival.slice(11, 16) : '--:--'} HS
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 font-medium truncate">{address}</p>
                                        
                                        {isCurrent && (
                                            <div className="flex flex-col gap-4 mt-6 animate-in slide-in-from-top-4 duration-500">
                                                <button 
                                                  onClick={() => openNavigation(address)}
                                                  className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black flex items-center justify-center gap-3 shadow-2xl shadow-blue-600/20 active:scale-95 transition-all text-sm border-b-4 border-blue-800 group"
                                                >
                                                    <Navigation size={20} className="group-hover:animate-bounce" /> 
                                                    NAVEGAR GPS
                                                </button>
                                                
                                                <div className="grid grid-cols-1 gap-3">
                                                    {stop.action_type === 'DELIVERY' && stop.status === 'PENDING' && (
                                                        <button 
                                                          onClick={() => handleUpdateStop(stop.id, 'ARRIVED')}
                                                          className="w-full py-5 bg-amber-500 text-white rounded-3xl font-black flex items-center justify-center gap-3 shadow-xl shadow-amber-500/10 active:scale-95 transition-all text-sm border-b-4 border-amber-700"
                                                        >
                                                            <BellRing size={20} /> 
                                                            AVISAR LLEGADA 📱
                                                        </button>
                                                    )}
                                                    
                                                    {stop.status === 'ARRIVED' && (
                                                        <div className="w-full py-4 bg-amber-500/10 text-amber-500 rounded-3xl font-black flex items-center justify-center gap-2 text-xs border border-amber-500/20 mb-2">
                                                            <CheckCircle2 size={16} />
                                                            CLIENTE NOTIFICADO
                                                        </div>
                                                    )}

                                                    <button 
                                                      onClick={() => handleUpdateStop(stop.id, 'COMPLETED')}
                                                      className="w-full py-5 bg-emerald-500 text-white rounded-3xl font-black flex items-center justify-center gap-3 shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all text-sm border-b-4 border-emerald-700"
                                                    >
                                                        <CheckCircle2 size={20} /> 
                                                        {stop.action_type === 'PICKUP' ? 'FINALIZAR RETIRO' : 'CONFIRMAR ENTREGA'}
                                                    </button>
                                                </div>
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

      {/* Glass Footer Persistence */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-slate-900/40 backdrop-blur-2xl border-t border-white/5 flex items-center justify-start gap-5 z-20">
          <div className="flex items-center gap-3 px-5 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black tracking-widest border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
              GPS ACTIVO
          </div>
          <div className="flex flex-col">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Último Reporte</p>
              <p className="text-[11px] font-bold text-slate-300">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} HS</p>
          </div>
      </footer>
    </div>
  );
}
