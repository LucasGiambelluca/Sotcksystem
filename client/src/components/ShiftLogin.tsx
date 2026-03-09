import { useEffect, useState } from 'react';
import { UserCircle, MapPin, Plus, ChefHat, LogIn, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { employeeService } from '../services/employeeService';
import { stationService } from '../services/stationService';
import { shiftService } from '../services/shiftService';
import type { Employee, Station, Shift } from '../types';

interface ShiftLoginProps {
  onShiftStarted: (shift: Shift) => void;
}

export default function ShiftLogin({ onShiftStarted }: ShiftLoginProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Quick-add states
  const [showNewEmployee, setShowNewEmployee] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('cocinero');
  const [newEmployeePhone, setNewEmployeePhone] = useState('');
  const [showNewStation, setShowNewStation] = useState(false);
  const [newStationName, setNewStationName] = useState('');

  // Manage mode
  const [manageMode, setManageMode] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [emps, sts] = await Promise.all([
        employeeService.getAll(),
        stationService.getAll(),
      ]);
      setEmployees(emps);
      setStations(sts);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleStartShift = async () => {
    if (!selectedEmployee || !selectedStation) {
      toast.error('Seleccioná un empleado y una estación');
      return;
    }
    setStarting(true);
    try {
      const shift = await shiftService.startShift(selectedEmployee, selectedStation);
      toast.success('¡Turno iniciado!');
      onShiftStarted(shift);
    } catch (err) {
      console.error(err);
      toast.error('Error al iniciar turno');
    } finally {
      setStarting(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployeeName.trim()) return;
    try {
      const emp = await employeeService.create({ 
        name: newEmployeeName.trim(), 
        role: newEmployeeRole, 
        phone: newEmployeePhone.trim() || null,
        is_active: true 
      });
      setEmployees(prev => [...prev, emp]);
      setSelectedEmployee(emp.id);
      setNewEmployeeName('');
      setNewEmployeeRole('cocinero');
      setNewEmployeePhone('');
      setShowNewEmployee(false);
      toast.success(`Empleado "${emp.name}" agregado`);
    } catch (err) {
      console.error(err);
      toast.error('Error al agregar empleado');
    }
  };

  const handleAddStation = async () => {
    if (!newStationName.trim()) return;
    try {
      const st = await stationService.create({ name: newStationName.trim(), color: '#3b82f6', is_active: true });
      setStations(prev => [...prev, st]);
      setSelectedStation(st.id);
      setNewStationName('');
      setShowNewStation(false);
      toast.success(`Estación "${st.name}" agregada`);
    } catch (err) {
      console.error(err);
      toast.error('Error al agregar estación');
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al empleado ${name}?`)) return;
    try {
      await employeeService.deactivate(id);
      setEmployees(prev => prev.filter(e => e.id !== id));
      if (selectedEmployee === id) setSelectedEmployee('');
      toast.success('Empleado eliminado');
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar empleado');
    }
  };

  const handleDeleteStation = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la estación ${name}?`)) return;
    try {
      await stationService.deactivate(id);
      setStations(prev => prev.filter(s => s.id !== id));
      if (selectedStation === id) setSelectedStation('');
      toast.success('Estación eliminada');
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar estación');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-gray-500 text-lg font-medium animate-pulse">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-6 w-full">
      <div className="bg-white p-6 sm:p-10 rounded-[28px] shadow-xl text-center max-w-md w-full border border-gray-100 relative">
        <button
          onClick={() => setManageMode(!manageMode)}
          className={`absolute top-6 right-6 p-2 rounded-full transition-colors ${manageMode ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
          title="Administrar opciones"
        >
          <Settings size={20} />
        </button>

        {/* Icon */}
        <div className="bg-gradient-to-br from-orange-400 to-red-500 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20">
          <ChefHat className="text-white w-10 h-10" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Inicio de Turno</h1>
        <p className="text-gray-500 mb-8 text-sm">
          {manageMode ? 'Administrando opciones. Podés eliminar empleados o estaciones.' : 'Seleccioná tu nombre y la estación donde vas a trabajar hoy.'}
        </p>

        {/* Employee Select */}
        <div className="text-left mb-5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <UserCircle size={14} /> ¿Quién sos?
          </label>
          {manageMode ? (
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto no-scrollbar border border-gray-100 rounded-xl p-2 bg-gray-50">
              {employees.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No hay empleados</p>}
              {employees.map(emp => (
                <div key={emp.id} className="flex justify-between items-center bg-white border border-gray-100 p-2 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 w-full">{emp.name}</span>
                  <button onClick={() => handleDeleteEmployee(emp.id, emp.name)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : !showNewEmployee ? (
            <div className="flex gap-2">
              <select
                value={selectedEmployee}
                onChange={e => setSelectedEmployee(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base transition-all"
              >
                <option value="">Seleccionar empleado...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewEmployee(true)}
                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors shrink-0"
                title="Agregar nuevo empleado"
              >
                <Plus size={18} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Nombre completo"
                value={newEmployeeName}
                onChange={e => setNewEmployeeName(e.target.value)}
                className="w-full px-4 py-3 border border-orange-200 rounded-xl bg-orange-50/10 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
                autoFocus
              />
              <div className="flex gap-2">
                <select
                  value={newEmployeeRole}
                  onChange={e => setNewEmployeeRole(e.target.value)}
                  className="flex-1 px-4 py-3 border border-orange-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="cocinero">Cocinero</option>
                  <option value="cadete">Cadete / Repartidor</option>
                  <option value="encargado">Encargado</option>
                </select>
                <input
                  type="text"
                  placeholder="Teléfono (opcional)"
                  value={newEmployeePhone}
                  onChange={e => setNewEmployeePhone(e.target.value)}
                  className="flex-1 px-4 py-3 border border-orange-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddEmployee} className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20">
                  GUARDAR
                </button>
                <button onClick={() => { setShowNewEmployee(false); setNewEmployeeName(''); }} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all font-bold">
                  CANCELAR
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Station Select */}
        <div className="text-left mb-8">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MapPin size={14} /> Estación de trabajo
          </label>
          {manageMode ? (
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto no-scrollbar border border-gray-100 rounded-xl p-2 bg-gray-50">
              {stations.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No hay estaciones</p>}
              {stations.map(st => (
                <div key={st.id} className="flex justify-between items-center bg-white border border-gray-100 p-2 rounded-lg">
                  <div className="flex items-center gap-2 w-full">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                    <span className="text-sm font-medium text-gray-700">{st.name}</span>
                  </div>
                  <button onClick={() => handleDeleteStation(st.id, st.name)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : !showNewStation ? (
            <div className="flex gap-2">
              <div className="flex-1 grid grid-cols-1 gap-2">
                {stations.length === 0 && (
                  <p className="text-sm text-gray-400 italic py-2">No hay estaciones. Agregá una.</p>
                )}
                {stations.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStation(st.id)}
                    className={`w-full px-4 py-3 rounded-xl border-2 font-semibold text-left transition-all ${
                      selectedStation === st.id
                        ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: st.color }} />
                    {st.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowNewStation(true)}
                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors shrink-0 self-start"
                title="Agregar nueva estación"
              >
                <Plus size={18} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre de la estación"
                value={newStationName}
                onChange={e => setNewStationName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStation()}
                className="flex-1 px-4 py-3 border border-orange-300 rounded-xl bg-orange-50/30 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
                autoFocus
              />
              <button onClick={handleAddStation} className="px-4 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all text-sm">
                OK
              </button>
              <button onClick={() => { setShowNewStation(false); setNewStationName(''); }} className="px-3 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all text-sm">
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Start Button */}
        {manageMode ? (
          <button
            onClick={() => setManageMode(false)}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 px-8 rounded-2xl text-lg transition-all active:scale-[0.98]"
          >
            Listo, salir de administrar
          </button>
        ) : (
          <button
            onClick={handleStartShift}
            disabled={starting || !selectedEmployee || !selectedStation}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-2xl text-lg shadow-lg shadow-orange-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <LogIn size={22} />
            {starting ? 'Iniciando...' : 'Iniciar Turno'}
          </button>
        )}
      </div>
    </div>
  );
}
