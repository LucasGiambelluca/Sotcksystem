import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { CheckCircle, Trash2 } from 'lucide-react';

export default memo(({ data, isConnectable }: any) => {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-64">
      <div className="bg-teal-600 text-white p-2 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
            <CheckCircle size={16} />
            <span className="font-medium text-sm">Crear Pedido</span>
        </div>
        <button onClick={data.onDelete} className="text-white hover:text-red-200 transition">
            <Trash2 size={14} />
        </button>
      </div>
      <div className="p-3">
        <p className="text-xs text-gray-500 mb-2">
          Finaliza la compra y guarda el pedido en la base de datos.
        </p>
        <div className="text-xs bg-gray-50 p-2 rounded border border-gray-100 text-gray-400 italic">
            El pedido quedará en estado "Pendiente".
        </div>
      </div>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} />
    </div>
  );
});
