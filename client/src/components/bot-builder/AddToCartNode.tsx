import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { ShoppingBag, Trash2 } from 'lucide-react';

export default memo(({ data, isConnectable }: any) => {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-72">
      <div className="bg-cyan-600 text-white p-2 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} />
          <span className="font-medium text-sm">Agregar al Carrito</span>
        </div>
        <button onClick={data.onDelete} className="text-white hover:text-red-200 transition">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase">Variable del producto</label>
          <input
            className="w-full text-sm border border-gray-200 rounded p-2 mt-1 font-mono focus:ring-2 focus:ring-cyan-300 focus:border-cyan-300"
            value={data.productVariable || ''}
            onChange={(e) => data.onChangeProductVar?.(e.target.value)}
            placeholder="stock_result"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase">Variable de cantidad</label>
          <input
            className="w-full text-sm border border-gray-200 rounded p-2 mt-1 font-mono focus:ring-2 focus:ring-cyan-300 focus:border-cyan-300"
            value={data.qtyVariable || ''}
            onChange={(e) => data.onChangeQtyVar?.(e.target.value)}
            placeholder="cantidad"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase">Variable de detalle <span className="text-gray-400">(opcional: talle, kg...)</span></label>
          <input
            className="w-full text-sm border border-gray-200 rounded p-2 mt-1 font-mono focus:ring-2 focus:ring-cyan-300 focus:border-cyan-300"
            value={data.detailVariable || ''}
            onChange={(e) => data.onChangeDetailVar?.(e.target.value)}
            placeholder="talle"
          />
        </div>

        <div className="text-[10px] bg-cyan-50 text-cyan-700 p-2 rounded border border-cyan-200 leading-relaxed">
          🛒 Lee el producto de <code className="bg-cyan-100 px-1 rounded">{`{{${data.productVariable || 'stock_result'}}}`}</code> y la cantidad de <code className="bg-cyan-100 px-1 rounded">{`{{${data.qtyVariable || 'cantidad'}}}`}</code>, lo agrega al carrito y avanza.
        </div>
      </div>

      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-3 h-3 bg-gray-400" />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-3 h-3 bg-cyan-500" />
    </div>
  );
});
