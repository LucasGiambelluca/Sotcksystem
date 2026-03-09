
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Search, Trash2 } from 'lucide-react';

const OrderStatusNode = ({ data, id }: { data: any, id: string }) => {
  return (
    <div className="bg-white border-2 border-indigo-500 rounded-lg shadow-lg min-w-[200px] overflow-hidden">
      <div className="bg-indigo-500 p-2 flex items-center justify-between text-white">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Search size={16} />
          <span>Consulta de Pedido</span>
        </div>
        <button 
          onClick={() => data.onDelete?.()}
          className="hover:bg-indigo-600 p-1 rounded transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
      
      <div className="p-3">
        <label className="block text-xs font-semibold text-gray-500 mb-1">Variable del Nro. de Orden</label>
        <input 
          type="text" 
          value={data.variable || 'order_number'} 
          onChange={(e) => data.onChangeVariable?.(e.target.value)}
          className="w-full text-sm border-gray-300 rounded focus:ring-indigo-500 py-1"
          placeholder="Ej: order_number"
        />
        <p className="mt-2 text-[10px] text-gray-400 italic">
          Busca en la base de datos el estado del pedido usando el número ingresado.
        </p>
      </div>

      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-500" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500" />
    </div>
  );
};

export default memo(OrderStatusNode);
