import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, DollarSign, History, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { clientService } from '../services/clientService';
import { movementService } from '../services/movementService';
import type { Client, Movement } from '../types';

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  const [transactionType, setTransactionType] = useState<'DEBT' | 'PAYMENT'>('DEBT');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (clientId: string) => {
    try {
      const [clientData, movementsData, balanceData] = await Promise.all([
        clientService.getAll().then(clients => clients.find(c => c.id === clientId)),
        movementService.getByClient(clientId),
        movementService.getClientBalance(clientId)
      ]);
      
      if (clientData) setClient(clientData);
      setMovements(movementsData);
      setBalance(balanceData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      if (editingMovement) {
        await movementService.update(editingMovement.id, {
          type: transactionType,
          amount: parseFloat(amount),
          description
        });
        toast.success('Movimiento actualizado');
      } else {
        await movementService.create({
          client_id: id,
          type: transactionType,
          amount: parseFloat(amount),
          description
        });
        toast.success('Movimiento registrado');
      }
      
      closeModal();
      loadData(id);
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast.error('Error al guardar el movimiento');
    }
  };

  const handleDeleteMovement = (movementId: string) => {
    if (!id) return;

    toast('¿Estás seguro de eliminar este movimiento?', {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await movementService.delete(movementId);
            toast.success('Movimiento eliminado');
            loadData(id);
          } catch (error) {
            console.error('Error deleting movement:', error);
            toast.error('Error al eliminar el movimiento');
          }
        }
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => {},
      },
    });
  };

  const openModal = (type: 'DEBT' | 'PAYMENT', movement?: Movement) => {
    setTransactionType(type);
    if (movement) {
      setEditingMovement(movement);
      setAmount(movement.amount.toString());
      setDescription(movement.description || '');
    } else {
      setEditingMovement(null);
      setAmount('');
      setDescription('');
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMovement(null);
    setAmount('');
    setDescription('');
  };

  if (loading) return <div className="p-8">Cargando...</div>;
  if (!client) return <div className="p-8">Cliente no encontrado</div>;

  return (
    <div className="p-8">
      <button 
        onClick={() => navigate('/clients')}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} className="mr-2" />
        Volver a Clientes
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Client Info Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{client.name}</h2>
          <div className="space-y-2 text-gray-600">
            <p><span className="font-medium">Teléfono:</span> {client.phone || '-'}</p>
            <p><span className="font-medium">Dirección:</span> {client.address || '-'}</p>
          </div>
        </div>

        {/* Balance Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-gray-500 font-medium mb-2">Saldo Actual</h2>
          <p className={`text-4xl font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ${balance.toFixed(2)}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            {balance > 0 ? 'El cliente debe' : 'A favor del cliente'}
          </p>
        </div>

        {/* Actions Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-center space-y-3">
          <button
            onClick={() => openModal('DEBT')}
            className="w-full bg-red-50 text-red-700 py-3 rounded-lg font-medium hover:bg-red-100 flex items-center justify-center space-x-2"
          >
            <Plus size={20} />
            <span>Registrar Deuda / Venta</span>
          </button>
          <button
            onClick={() => openModal('PAYMENT')}
            className="w-full bg-green-50 text-green-700 py-3 rounded-lg font-medium hover:bg-green-100 flex items-center justify-center space-x-2"
          >
            <DollarSign size={20} />
            <span>Registrar Pago</span>
          </button>
        </div>
      </div>

      {/* Movements History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center space-x-2">
          <History size={20} className="text-gray-400" />
          <h3 className="text-lg font-bold text-gray-900">Historial de Movimientos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Descripción</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3 text-right">Monto</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {movements.map((movement) => (
                <tr key={movement.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600">
                    {new Date(movement.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-gray-900">{movement.description}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      movement.type === 'DEBT' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {movement.type === 'DEBT' ? 'Deuda' : 'Pago'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-right font-medium ${
                    movement.type === 'DEBT' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {movement.type === 'DEBT' ? '+' : '-'}${movement.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => openModal(movement.type, movement)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                    >
                      <Pencil size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteMovement(movement.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No hay movimientos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingMovement ? 'Editar Movimiento' : (transactionType === 'DEBT' ? 'Registrar Deuda' : 'Registrar Pago')}
              </h2>
            </div>
            
            <form onSubmit={handleTransaction} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder={transactionType === 'DEBT' ? 'Ej: Compra de Mesa ratona' : 'Ej: Pago parcial efectivo'}
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white rounded-lg ${
                    transactionType === 'DEBT' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
