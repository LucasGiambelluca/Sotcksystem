import { useState, useEffect } from 'react';
import { X, Search, Check, Loader2, Package } from 'lucide-react';
import { getOrders } from '../services/orderService';
import { addOrderToRoute } from '../services/routeService';
import { toast } from 'sonner';
import type { OrderWithDetails } from '../types';

interface AddOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeId: string;
  onOrdersAdded: () => void;
  currentOrderIds: string[]; // To filter out already added
}

export default function AddOrdersModal({ isOpen, onClose, routeId, onOrdersAdded, currentOrderIds }: AddOrdersModalProps) {
  /* return null; */

  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadAvailableOrders();
      setSelectedIds(new Set());
    }
  }, [isOpen]);

  async function loadAvailableOrders() {
    setLoading(true);
    // Fetch pending/confirmed/prep orders. 
    // Ideally backend should support NOT IN filter, but for now we filter client side.
    // await getOrders({ status: 'PENDING' }); // Or 'CONFIRMED' etc. Adjust based on business logic. 
    // Let's fetch all active orders for now to be safe, or just CONFIRMED/PREPARATION?
    // User requested "robust system". Let's fetch ALL and filter in UI for better UX finding missing orders.
    // Actually getOrders supports status. Let's fetch active ones.
    
    // Better: Fetch all non-delivered/cancelled?
    // For simplicity, let's fetch 'CONFIRMED' and 'IN_PREPARATION' and 'PENDING'.
    // We'll iterate manually or if getOrders supports array? It probably takes single status.
    // Let's fetch ALL for now (no status filter) and filter client side.
    const { data: allOrders } = await getOrders({});

    if (allOrders) {
      const available = allOrders.filter(o => 
        !['DELIVERED', 'CANCELLED'].includes(o.status) && 
        !currentOrderIds.includes(o.id)
      );
      setOrders(available);
    }
    setLoading(false);
  }

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleAddParams = async () => {
    if (selectedIds.size === 0) return;
    setAdding(true);
    try {
        // Add sequentially or parallel? Parallel is faster.
        const promises = Array.from(selectedIds).map((orderId, index) => {
             // We use currentOrderIds.length + index + 1 for sequence
             return addOrderToRoute(routeId, orderId, currentOrderIds.length + index + 1);
        });

        await Promise.all(promises);
        
        toast.success(`${selectedIds.size} pedidos agregados a la ruta`);
        onOrdersAdded();
        onClose();
    } catch (error) {
        console.error(error);
        toast.error('Error al agregar pedidos');
    } finally {
        setAdding(false);
    }
  };

  const filteredOrders = orders.filter(o => 
    o.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.client?.address?.toLowerCase().includes(search.toLowerCase()) ||
    o.id.includes(search)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Agregar Pedidos a la Ruta</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b bg-gray-50">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
             <input 
               type="text" 
               placeholder="Buscar por cliente, dirección o ID..." 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
             />
           </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : filteredOrders.length === 0 ? (
                <div className="text-center p-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    No hay pedidos disponibles para agregar.
                </div>
            ) : (
                <div className="grid gap-2">
                    {filteredOrders.map(order => {
                        const isSelected = selectedIds.has(order.id);
                        return (
                            <div 
                              key={order.id} 
                              onClick={() => handleToggle(order.id)}
                              className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center gap-3 ${
                                  isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200'
                              }`}
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                                    isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
                                }`}>
                                    {isSelected && <Check className="w-3 h-3" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <h4 className="font-medium">{order.client?.name}</h4>
                                        <span className="text-xs font-mono bg-gray-100 px-1 rounded">#{order.id.slice(0,6)}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 truncate">{order.client?.address}</p>
                                    <div className="flex gap-2 text-xs mt-1">
                                        <span className={`px-1.5 py-0.5 rounded ${
                                            order.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' : 
                                            order.status === 'IN_PREPARATION' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                                        }`}>{order.status}</span>
                                        <span>${order.total_amount}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
            <span className="text-sm text-gray-600">
                {selectedIds.size} seleccionados
            </span>
            <div className="flex gap-3">
                <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                Cancelar
                </button>
                <button
                onClick={handleAddParams}
                disabled={selectedIds.size === 0 || adding}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                Agregar a Ruta
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
