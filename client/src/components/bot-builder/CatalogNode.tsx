import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Store, Trash2 } from 'lucide-react';

export default memo(({ data, isConnectable }: any) => {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-64">
      <div className="bg-green-600 text-white p-2 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Store size={16} />
            <span className="font-medium text-sm">Catálogo</span>
        </div>
        <button onClick={data.onDelete} className="text-white hover:text-red-200 transition">
            <Trash2 size={14} />
        </button>
      </div>
      
      <div className="p-3 text-sm text-gray-600">
        <p>Este nodo enviará el catálogo completo de productos disponibles al cliente.</p>
        <div className="mt-2 text-xs bg-blue-50 text-blue-700 p-2 rounded border border-blue-200">
            ℹ️ El flujo esperará a que el cliente escriba su pedido. Conecta la salida al siguiente paso (ej: Confirmación).
        </div>
      </div>

      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-3 h-3 bg-gray-400" />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-3 h-3 bg-green-500" />
    </div>
  );
});
