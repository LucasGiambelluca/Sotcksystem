import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createRoute } from '../services/routeService';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface CreateRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteCreated: () => void;
}

export default function CreateRouteModal({ isOpen, onClose, onRouteCreated }: CreateRouteModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    driver_name: '',
    start_address: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await createRoute({
        name: formData.name,
        date: formData.date,
        driver_name: formData.driver_name,
        start_address: formData.start_address,
      });

      if (error) throw error;

      toast.success('Ruta creada exitosamente');
      onRouteCreated(); 
      onClose();
      // Optional: Navigate immediately to the new route
      if (data) {
        navigate(`/routes/${data.id}`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al crear la ruta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Nueva Ruta de Entrega</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Ruta</label>
            <input
              type="text"
              required
              placeholder="Ej: Reparto Zona Norte"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conductor (Opcional)</label>
            <input
              type="text"
              placeholder="Nombre del chofer"
              value={formData.driver_name}
              onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Punto de Partida (Opcional)</label>
            <input
              type="text"
              placeholder="Ej: Av. Corrientes 1234, CABA"
              value={formData.start_address}
              onChange={(e) => setFormData({ ...formData, start_address: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">Si se deja vacío, se usará la ubicación del depósito.</p>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear Ruta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
