import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { employeeService } from '../services/employeeService';
import type { Employee } from '../types';

export default function Staff() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({ name: '', role: 'cadete', phone: '', pin_code: '', is_active: true });

  const roles = [
    { value: 'admin', label: 'Administrador' },
    { value: 'cadete', label: 'Cadete (Repartidor)' },
    { value: 'delivery', label: 'Delivery (Externo)' },
    { value: 'cocina', label: 'Cocina' },
    { value: 'ventas', label: 'Ventas' },
  ];

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await employeeService.getAll();
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await employeeService.update(editingEmployee.id, formData);
        toast.success('Empleado actualizado correctamente');
      } else {
        await employeeService.create(formData);
        toast.success('Empleado creado correctamente');
      }
      closeModal();
      loadEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('Error al guardar el empleado');
    }
  };

  const handleDelete = (id: string) => {
    toast('¿Estás seguro de desactivar este empleado?', {
      action: {
        label: 'Desactivar',
        onClick: async () => {
          try {
            await employeeService.deactivate(id);
            toast.success('Empleado desactivado');
            loadEmployees();
          } catch (error) {
            console.error('Error deactivating employee:', error);
            toast.error('Error al desactivar');
          }
        }
      },
    });
  };

  const openModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmployee(emp);
      setFormData({ 
        name: emp.name, 
        role: emp.role,
        phone: emp.phone || '', 
        pin_code: emp.pin_code || '',
        is_active: emp.is_active
      });
    } else {
      setEditingEmployee(null);
      setFormData({ name: '', role: 'cadete', phone: '', pin_code: '', is_active: true });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  if (loading) return <div className="p-8 flex justify-center text-primary-600">Cargando personal...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Personal (Staff)</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Gestiona los empleados y sus roles</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-primary-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center space-x-2 hover:bg-primary-700 shadow-lg shadow-primary-900/20 transition-all w-full md:w-auto"
        >
          <Plus size={20} />
          <span className="font-medium">Nuevo Empleado</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Empleado</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                        {getInitials(emp.name)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{emp.name}</div>
                        <div className="text-xs text-gray-400 font-mono">#{emp.id.slice(0, 8)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium uppercase">
                      {roles.find(r => r.value === emp.role)?.label || emp.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {emp.is_active ? (
                      <span className="text-green-600 flex items-center gap-1 text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full" /> Activo
                      </span>
                    ) : (
                      <span className="text-gray-400 flex items-center gap-1 text-sm">
                        <div className="w-2 h-2 bg-gray-300 rounded-full" /> Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => openModal(emp)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(emp.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold">{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl"
                  placeholder="Ej: Lucas Giambelluca"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rol *</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl"
                >
                  {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl"
                  placeholder="Ej: 549..."
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-500">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-xl font-bold">
                  {editingEmployee ? 'Actualizar' : 'Crear Empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
