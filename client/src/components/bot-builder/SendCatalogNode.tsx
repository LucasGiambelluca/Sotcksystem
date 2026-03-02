import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { ShoppingBag, Trash2 } from 'lucide-react';

export default memo(({ data, isConnectable }: any) => {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-emerald-300 w-60">
      <div className="bg-emerald-500 text-white p-2 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} />
          <span className="font-medium text-sm">Enviar Catálogo</span>
        </div>
        <button onClick={data.onDelete} className="text-white hover:text-red-200 transition">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-3 bg-emerald-50 text-xs text-gray-600 space-y-1">
        <p>Envía al cliente el link del <strong>catálogo público</strong> para que arme su pedido.</p>
        <div className="mt-2 bg-white border border-emerald-200 rounded px-2 py-1 font-mono text-xs text-emerald-700 truncate">
          {window.location.origin}/catalog
        </div>
        <p className="text-gray-400 text-xs mt-1">El cliente puede ver productos, agregar al carrito y pedir por WhatsApp.</p>
      </div>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} />
    </div>
  );
});
