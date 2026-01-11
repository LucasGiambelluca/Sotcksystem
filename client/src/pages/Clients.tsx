import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, X, Eye, User } from 'lucide-react';
import { toast } from 'sonner';
import { clientService } from '../services/clientService';
import { movementService } from '../services/movementService';
import type { Client } from '../types';
import ExportButtons from '../components/ExportButtons';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const data = await clientService.getAll();
      setClients(data);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await clientService.update(editingClient.id, formData);
        toast.success('Cliente actualizado correctamente');
      } else {
        await clientService.create(formData);
        toast.success('Cliente creado correctamente');
      }
      closeModal();
      loadClients();
    } catch (error) {
      console.error('Error saving client:', error);
      toast.error('Error al guardar el cliente');
    }
  };

  const handleDelete = (id: string) => {
    toast('¿Estás seguro de eliminar este cliente?', {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await clientService.delete(id);
            toast.success('Cliente eliminado');
            loadClients();
          } catch (error) {
            console.error('Error deleting client:', error);
            toast.error('Error al eliminar el cliente');
          }
        }
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => {},
      },
    });
  };

  const openModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({ 
        name: client.name, 
        phone: client.phone || '', 
        address: client.address || '' 
      });
    } else {
      setEditingClient(null);
      setFormData({ name: '', phone: '', address: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
    setFormData({ name: '', phone: '', address: '' });
  };

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(filteredClients.map(c => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedClients.includes(id)) {
      setSelectedClients(selectedClients.filter(c => c !== id));
    } else {
      setSelectedClients([...selectedClients, id]);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getRandomColor = (name: string) => {
    const colors = ['bg-blue-100 text-blue-600', 'bg-purple-100 text-purple-600', 'bg-green-100 text-green-600', 'bg-yellow-100 text-yellow-600', 'bg-pink-100 text-pink-600'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleExportWithDebt = async () => {
    setExporting(true);
    try {
      const clientsToExport = selectedClients.length > 0 
        ? clients.filter(c => selectedClients.includes(c.id)) 
        : filteredClients;

      const clientIds = clientsToExport.map(c => c.id);
      const balances = await movementService.getBalancesForClients(clientIds);

      const dataToExport = clientsToExport.map(client => ({
        Nombre: client.name,
        Teléfono: client.phone || '-',
        Dirección: client.address || '-',
        Deuda: balances[client.id] || 0
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes con Deuda");
      XLSX.writeFile(workbook, "clientes_con_deuda.xlsx");
      toast.success('Exportación completada');
    } catch (error) {
      console.error('Error exporting clients with debt:', error);
      toast.error('Error al exportar clientes con deuda');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center text-primary-600">Cargando clientes...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Gestiona tu cartera de clientes</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full md:w-auto">
          <ExportButtons 
            data={selectedClients.length > 0 
              ? clients.filter(c => selectedClients.includes(c.id)) 
              : filteredClients}
            filename="clientes"
            columns={[
              { header: 'Nombre', key: 'name' },
              { header: 'Teléfono', key: 'phone' },
              { header: 'Dirección', key: 'address' }
            ]}
          />
          <button
            onClick={handleExportWithDebt}
            disabled={exporting}
            className={`flex items-center space-x-2 px-4 py-2.5 bg-yellow-50 text-yellow-700 rounded-xl hover:bg-yellow-100 transition-colors text-sm font-medium border border-yellow-200 ${exporting ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Exportar a Excel con Deudas"
          >
            {exporting ? (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-700"></span>
            ) : (
              <span className="font-bold">$</span>
            )}
            <span>Excel (Deudas)</span>
          </button>
          <button
            onClick={() => openModal()}
            className="bg-primary-600 text-white px-5 py-2.5 rounded-xl flex items-center justify-center space-x-2 hover:bg-primary-700 shadow-lg shadow-primary-900/20 transition-all w-full sm:w-auto"
          >
            <Plus size={20} />
            <span className="font-medium">Nuevo Cliente</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar cliente por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-gray-50 text-gray-500 font-medium text-sm uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 w-4">
                  <input 
                    type="checkbox" 
                    checked={filteredClients.length > 0 && selectedClients.length === filteredClients.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                </th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Teléfono</th>
                <th className="px-6 py-4">Dirección</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      checked={selectedClients.includes(client.id)}
                      onChange={() => toggleSelect(client.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getRandomColor(client.name)}`}>
                        {getInitials(client.name)}
                      </div>
                      <div>
                        <Link to={`/clients/${client.id}`} className="font-semibold text-gray-900 hover:text-primary-600 transition-colors">
                          {client.name}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm font-mono">
                    #{client.id.slice(0, 6)}
                  </td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{client.phone || '-'}</td>
                  <td className="px-6 py-4 text-gray-500 text-sm max-w-xs truncate">{client.address || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => navigate(`/clients/${client.id}`)}
                        className="bg-green-50 text-green-600 p-2 rounded-lg hover:bg-green-100 transition-colors"
                        title="Ver Cuenta"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => openModal(client)}
                        className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(client.id)}
                        className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="bg-gray-100 p-4 rounded-full">
                        <User size={32} className="text-gray-400" />
                      </div>
                      <p>No se encontraron clientes.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-dark-bg/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Completo *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Ej: +54 9 11..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                  rows={3}
                  placeholder="Ej: Av. Corrientes 1234"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 shadow-lg shadow-primary-900/20 transition-all"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
