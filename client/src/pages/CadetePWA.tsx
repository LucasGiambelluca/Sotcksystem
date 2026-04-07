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
  const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [cadetesDisponibles, setCadetesDisponibles] = useState<any[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const { playNotification } = useSound();

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

  const fetchHistory = useCallback(async () => {
      if (!employee) return;
      try {
          const { data, error } = await supabase
              .from('assignments')
              .select(`
                  *,
                  assignment_orders (
                      *,
                      order:orders (*)
                  )
              `)
              .eq('employee_id', employee.id)
              .eq('status', 'COMPLETED')
              .order('created_at', { ascending: false })
              .limit(10);

          if (error) throw error;
          setAssignmentHistory(data || []);
      } catch (err) {
          console.error('Error fetching history:', err);
      }
  }, [employee]);

    useEffect(() => {
        if (!isOnline || !employee) return;
        
        fetchMission();
        fetchHistory();
        
        // Comprehensive Realtime Subscription
        const channel = supabase
            .channel(`cadete_${employee.id}_updates`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'assignments', 
                filter: `cadete_id=eq.${employee.id}` 
            }, () => { fetchMission(); fetchHistory(); })
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'assignment_orders' 
            }, () => fetchMission())
            .subscribe();
        
        return () => { channel.unsubscribe(); };
    }, [employee, isOnline, fetchMission, fetchHistory]);

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
            const empObj = cadetesDisponibles.find(c => c.id === empId);
            if (!empObj) throw new Error('Empleado no encontrado');

            const { data: stations } = await supabase.from('stations').select('*').limit(5);
            const stationId = stations?.find(s => s.name.toLowerCase().includes('reparto'))?.id 
                        || stations?.[0]?.id 
                        || '';
            
            let currentStationId = stationId;
            if (!stationId) {
                const { data: newStation, error: stationErr } = await supabase
                    .from('stations')
                    .insert({ name: 'Reparto', is_active: true, color: '#db2777' })
                    .select()
                    .single();
                if (stationErr) throw stationErr;
                currentStationId = newStation.id;
            }

            const shift = await shiftService.startShift(empId, currentStationId);
            await logisticsV2Service.updateCadeteStatus(empId, true);
            setEmployee(empObj);
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
              const pickups = activeAssignment.assignment_orders.filter((s: any) => s.action_type === 'PICKUP' && s.status !== 'COMPLETED');
              for (const p of pickups) {
                  await logisticsV2Service.updateStopStatus(p.id, status);
              }
          } else {
              await logisticsV2Service.updateStopStatus(stopId, status);
              if (stop?.action_type === 'DELIVERY' && status === 'COMPLETED' && stop.order_id) {
                  await updateOrderStatus(stop.order_id, 'DELIVERED');
              }
          }
          toast.success('Estado actualizado');
          fetchMission();
          fetchHistory();
      } catch (err) {
          toast.error('Error al actualizar');
      }
  };

  const openNavigation = (address: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f8fafc]"><Clock className="animate-spin text-red-600" size={40} /></div>;

  if (!employee || !isOnline) {
      return (
          <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center font-sans relative overflow-hidden">
              <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[40%] bg-red-500/5 rounded-full blur-[120px] pointer-events-none"></div>
              <div className="absolute bottom-[-5%] left-[-5%] w-[50%] h-[30%] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>

              <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
                  <div className="bg-slate-50 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl border border-slate-100 group hover:scale-110 transition-transform duration-500">
                      <Navigation className="text-red-500 w-12 h-12 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
                  </div>
                  
                  <div className="text-center mb-10 space-y-2">
                      <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                        Modo <span className="text-red-500">Cadete</span>
                      </h1>
                      <p className="text-slate-500 font-medium text-sm">Tu centro de operaciones logísticas.</p>
                  </div>
                  
                  {showSelector ? (
                      <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] text-center mb-4">Identificate para Continuar</p>
                          {cadetesDisponibles.length === 0 ? (
                              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-[2.5rem] p-10 text-center">
                                  <p className="text-sm text-slate-500 font-medium">No hay personal logístico registrado.</p>
                              </div>
                          ) : (
                              <div className="grid gap-4 max-h-[40vh] overflow-y-auto px-2 no-scrollbar">
                                  {cadetesDisponibles.map(c => (
                                      <button
                                        key={c.id}
                                        onClick={() => handleStartShift(c.id)}
                                        className="w-full py-5 bg-white border border-slate-100 rounded-3xl font-black text-slate-800 hover:bg-slate-50 hover:border-red-500 transition-all flex items-center px-8 gap-5 group shadow-sm hover:shadow-md"
                                      >
                                          <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 group-hover:bg-red-500 group-hover:text-white transition-colors shadow-inner">
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
                            className="w-full py-4 text-slate-400 text-xs font-black tracking-widest hover:text-slate-900 transition-colors mt-4"
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
                            className="w-full py-6 bg-red-600 text-white rounded-[2.5rem] font-black shadow-[0_20px_40px_rgba(220,38,38,0.2)] active:scale-95 transition-all text-xl flex items-center justify-center gap-4 border-b-4 border-red-800"
                        >
                            <Power size={26} />
                            INICIAR TURNO
                        </button>
                        <div className="flex items-center gap-2 text-slate-300 text-[10px] font-black tracking-widest uppercase">
                            <div className="w-8 h-[1px] bg-slate-200"></div>
                            V0.4 ALPHA
                            <div className="w-8 h-[1px] bg-slate-200"></div>
                        </div>
                    </div>
                  )}
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans pb-24 relative overflow-x-hidden">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-500/5 rounded-full blur-[150px] pointer-events-none"></div>

      <header className="sticky top-0 z-30 px-6 py-5 bg-white/80 backdrop-blur-3xl border-b border-slate-200 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
            <div className="relative group">
                <div className="w-14 h-14 bg-slate-100 rounded-[1.2rem] flex items-center justify-center overflow-hidden border border-slate-200 shadow-sm transition-transform group-hover:scale-105 duration-300">
                    <User className="text-slate-400" size={28} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-[3px] border-white shadow-md"></div>
            </div>
            <div>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] leading-none mb-1">Modo Activo</p>
                <h2 className="text-xl font-black text-slate-900 leading-tight tracking-tight">{employee.name}</h2>
            </div>
        </div>
        <button 
          onClick={handleEndShift}
          className="p-3.5 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all border border-slate-200 active:scale-90"
        >
            <LogOut size={22} />
        </button>
      </header>

      <main className="flex-1 px-6 pt-8 max-w-lg mx-auto w-full">
        {!activeAssignment ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 gap-5">
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                    <div className="flex items-center gap-5">
                        <div className="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center border border-emerald-100">
                            <CheckCircle2 size={28} className="text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Misiones hoy</p>
                            <span className="text-3xl font-black text-slate-900">
                                {assignmentHistory.filter(a => new Date(a.created_at).toDateString() === new Date().toDateString()).length}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entregas</p>
                        <span className="text-xl font-black text-slate-700">
                            {assignmentHistory
                                .filter(a => new Date(a.created_at).toDateString() === new Date().toDateString())
                                .reduce((acc, a) => acc + (a.assignment_orders?.length || 0), 0)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Waiting for Mission Radar */}
            <div className="relative py-14 flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-40 h-40 bg-red-500/[0.03] rounded-full animate-ping duration-[3000ms]"></div>
                </div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-slate-100 rotate-12 group-hover:rotate-0 transition-transform">
                        <Radio className="text-red-500 animate-pulse" size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Esperando Misión</h3>
                    <p className="text-slate-400 text-sm mt-2 max-w-[240px] font-medium leading-relaxed">Los pedidos aparecerán aquí automáticamente cuando te sean asignados.</p>
                </div>
            </div>

            {/* Mission History */}
            <div className="space-y-4">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] px-2 italic">Historial Reciente</h3>
                <div className="space-y-3">
                    {assignmentHistory.length === 0 ? (
                        <div className="bg-white p-8 rounded-[2rem] border border-dashed border-slate-200 text-center">
                            <p className="text-xs text-slate-400 font-medium">No hay entregas registradas aún.</p>
                        </div>
                    ) : (
                        assignmentHistory.map(a => (
                            <div key={a.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 text-slate-400">
                                        <TrendingUp size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-slate-800 uppercase italic">Misión #{a.id.slice(-4).toUpperCase()}</h4>
                                        <p className="text-[10px] text-slate-400 font-bold">{new Date(a.created_at).toLocaleDateString()} • {a.assignment_orders?.length} Paradas</p>
                                    </div>
                                </div>
                                <div className="bg-emerald-50 px-3 py-1.5 rounded-full text-[9px] font-black text-emerald-600 border border-emerald-100">
                                    COMPLETADA
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-5 duration-700 space-y-6">
            <div className="flex items-center justify-between px-2">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Misión Activa</span>
                <span className="bg-white text-red-500 px-4 py-1.5 rounded-full text-[11px] font-black border border-slate-100 shadow-sm">#{activeAssignment.id.slice(-4).toUpperCase()}</span>
            </div>

            <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-50 relative overflow-hidden group">
                <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Recaudar</p>
                        <h3 className="text-4xl font-black text-slate-900 tracking-tighter">
                            ${(() => {
                                const uniqueOrderIds = new Set();
                                return activeAssignment.assignment_orders?.reduce((acc: number, o: any) => {
                                    if (!o.order_id || uniqueOrderIds.has(o.order_id)) return acc;
                                    uniqueOrderIds.add(o.order_id);
                                    return acc + (o.order?.total_amount || 0);
                                }, 0).toLocaleString();
                            })()}
                        </h3>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 text-center min-w-[80px]">
                        <p className="text-2xl font-black text-slate-900 leading-none">{activeAssignment.assignment_orders?.length}</p>
                        <p className="text-[8px] font-extrabold text-slate-400 uppercase mt-1">Paradas</p>
                    </div>
                </div>

                <div className="space-y-12 relative mt-4">
                    {(() => {
                        if (activeAssignment.status === 'ASSIGNED') {
                            return (
                                <div className="text-center py-10 flex flex-col items-center gap-10 animate-in zoom-in-95 duration-700">
                                    <div className="relative">
                                        <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 border border-blue-100 shadow-sm">
                                            <BellRing size={56} className="animate-bounce" />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">¡Misión Entrante!</h3>
                                        <p className="text-slate-500 text-sm px-8 font-medium leading-relaxed">Se ha trazado una nueva ruta optimizada con {activeAssignment.assignment_orders?.length} puntos de interés.</p>
                                    </div>
                                    <button 
                                      onClick={async () => {
                                          try {
                                              playNotification();
                                              await logisticsV2Service.updateAssignmentStatus(activeAssignment.id, 'IN_PROGRESS');
                                              fetchMission();
                                              toast.success('¡Ruta Iniciada!');
                                          } catch (err) {
                                              toast.error('Error al aceptar misión');
                                          }
                                      }}
                                      className="w-full py-7 bg-blue-600 text-white rounded-[2.5rem] font-black shadow-[0_20px_40px_rgba(37,99,235,0.2)] active:scale-95 transition-all text-xl flex items-center justify-center gap-4 border-b-8 border-blue-800 uppercase italic tracking-tighter"
                                    >
                                        <Navigation size={28} />
                                        Comenzar Operativo
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
                                <div className="text-center py-10 flex flex-col items-center gap-8 animate-in zoom-in duration-700">
                                    <div className="relative">
                                        <div className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-100 shadow-sm">
                                            <CheckCircle2 size={56} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">¡Operativo Exitoso!</h3>
                                        <p className="text-slate-500 text-sm font-medium">Has completado todos los objetivos de esta misión.</p>
                                    </div>
                                    <button 
                                      onClick={async () => {
                                          try {
                                              await logisticsV2Service.updateAssignmentStatus(activeAssignment.id, 'COMPLETED');
                                              setActiveAssignment(null);
                                              toast.success('¡Misión cerrada correctamente!');
                                          } catch (err) {
                                              toast.error('Error al finalizar misión');
                                          }
                                      }}
                                      className="w-full py-7 bg-emerald-600 text-white rounded-[2.5rem] font-black shadow-[0_20px_40px_rgba(16,185,129,0.2)] active:scale-95 transition-all mt-6 text-xl border-b-8 border-emerald-800 uppercase italic tracking-tighter"
                                    >
                                        Finalizar y Volver
                                    </button>
                                </div>
                            );
                        }

                        return displayStops.map((stop: any, idx: number) => {
                            const isDone = stop.status === 'COMPLETED';
                            const isCurrent = firstIncomplete?.id === stop.id;
                            const address = stop.action_type === 'PICKUP' ? 'S. Martín 450 (Local)' : stop.order?.delivery_address || 'Bahía Blanca';
                            
                            return (
                                <div key={stop.id} className={`flex gap-8 relative transition-all duration-700 ${isDone ? 'opacity-30' : ''}`}>
                                    {/* Vertical Connector */}
                                    {idx < displayStops.length - 1 && (
                                        <div className={`absolute left-[1.15rem] top-12 bottom-[-48px] w-0.5 ${isDone ? 'bg-emerald-200' : 'bg-slate-100'}`}></div>
                                    )}

                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 z-10 transition-all duration-700 border-2 ${
                                        isDone ? 'bg-emerald-500 border-emerald-500 text-white rotate-[360deg]' : 
                                        isCurrent ? 'bg-red-600 border-red-600 text-white shadow-lg scale-125' : 
                                        'bg-slate-50 border-slate-200 text-slate-400'
                                    }`}>
                                        {stop.action_type === 'PICKUP' ? <Store size={20} /> : <MapPin size={20} />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`font-black text-lg truncate tracking-tighter transition-colors uppercase italic ${isCurrent ? 'text-slate-900' : 'text-slate-400'}`}>
                                                {stop.action_type === 'PICKUP' 
                                                    ? `Retiro Casa Central ${stop.isConsolidated ? `(${stop.count})` : ''}` 
                                                    : `Entrega #${stop.order?.id?.slice(-4).toUpperCase()}`}
                                            </h4>
                                            {isCurrent && (
                                                <div className="bg-red-50 text-red-600 px-2 py-0.5 rounded-lg border border-red-100 text-[9px] font-black animate-pulse uppercase">Actual</div>
                                            )}
                                        </div>
                                        <p className={`text-sm mt-1 font-medium truncate transition-colors ${isCurrent ? 'text-slate-600' : 'text-slate-300'}`}>{address}</p>
                                        
                                        {isCurrent && (
                                            <div className="flex flex-col gap-5 mt-8 animate-in slide-in-from-top-6 duration-700">
                                                <button 
                                                  onClick={() => openNavigation(address)}
                                                  className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all text-base border-b-6 border-slate-700 group uppercase italic tracking-tighter"
                                                >
                                                    <Navigation size={24} className="group-hover:rotate-45 transition-transform" /> 
                                                    Trazar Ruta GPS
                                                </button>
                                                
                                                <div className="grid grid-cols-1 gap-4">
                                                    {stop.action_type === 'DELIVERY' && stop.status === 'PENDING' && (
                                                        <button 
                                                          onClick={() => handleUpdateStop(stop.id, 'ARRIVED')}
                                                          className="w-full py-5 bg-amber-500 text-white rounded-[2rem] font-black flex items-center justify-center gap-4 shadow-lg active:scale-95 transition-all text-sm border-b-6 border-amber-700 uppercase italic"
                                                        >
                                                            <BellRing size={22} className="animate-pulse" /> 
                                                            Notificar Llegada
                                                        </button>
                                                    )}
                                                    
                                                    {stop.status === 'ARRIVED' && (
                                                        <div className="w-full py-4 bg-amber-50 text-amber-600 rounded-[1.5rem] font-black flex items-center justify-center gap-3 text-xs border border-amber-100 mb-2 italic">
                                                            <CheckCircle2 size={18} />
                                                            CLIENTE YA NOTIFICADO
                                                        </div>
                                                    )}

                                                    <button 
                                                      onClick={() => handleUpdateStop(stop.id, 'COMPLETED')}
                                                      className="w-full py-6 bg-emerald-500 text-white rounded-[2rem] font-black flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all text-base border-b-6 border-emerald-800 uppercase italic tracking-tighter"
                                                    >
                                                        <CheckCircle2 size={24} /> 
                                                        {stop.action_type === 'PICKUP' ? 'Confirmar Retiro' : 'Confirmar Entrega'}
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

      {/* Clean Footer Persistence */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-3xl border-t border-slate-100 flex items-center justify-start gap-5 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-3 px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black tracking-widest border border-emerald-100">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              GPS ACTIVO
          </div>
          <div className="flex flex-col">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Último Reporte</p>
              <p className="text-[11px] font-bold text-slate-700">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} HS</p>
          </div>
      </footer>
    </div>
  );
}
