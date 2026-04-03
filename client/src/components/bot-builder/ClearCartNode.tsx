import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Trash2 } from 'lucide-react';

export default memo(({ data, isConnectable }: any) => {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-red-200 w-64 overflow-hidden">
      <div className="bg-red-600 text-white p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Trash2 size={16} />
            <span className="font-medium text-sm text-white">Vaciar Carrito</span>
        </div>
        <button onClick={data.onDelete} className="text-white hover:text-red-200 transition">
            <Trash2 size={14} />
        </button>
      </div>
      
      <div className="p-3 bg-red-50 space-y-3">
        <p className="text-[10px] text-red-800 leading-tight italic">
          Este nodo limpia todos los productos del pedido actual y reinicia el total a $0.
        </p>

        <div>
          <label className="block text-[10px] font-bold text-red-700 uppercase mb-1">Mensaje de Confirmación</label>
          <textarea
            className="w-full text-xs p-2 border border-red-100 rounded resize-none focus:outline-none focus:border-red-500 bg-white"
            rows={2}
            value={data.message || ''}
            onChange={(evt) => data.onChangeMessage ? data.onChangeMessage(evt.target.value) : null}
            placeholder="Ej: Carrito vaciado. ¿Qué querés hacer ahora?"
          />
        </div>
      </div>

      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3 bg-red-500" />
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3 bg-red-500" />
    </div>
  );
});
