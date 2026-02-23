import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { PackageSearch, Trash2 } from 'lucide-react';

export default memo(({ data, isConnectable }: any) => {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-72">
      <div className="bg-emerald-600 text-white p-2 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PackageSearch size={16} />
          <span className="font-medium text-sm">Consulta Stock</span>
        </div>
        <button onClick={data.onDelete} className="text-white hover:text-red-200 transition">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase">Pregunta al usuario</label>
          <textarea
            className="w-full text-sm border border-gray-200 rounded p-2 mt-1 resize-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
            value={data.question || ''}
            onChange={(e) => data.onChangeQuestion?.(e.target.value)}
            placeholder='🔍 ¿Qué producto querés consultar?'
            rows={2}
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase">Guardar resultado en</label>
          <input
            className="w-full text-sm border border-gray-200 rounded p-2 mt-1 font-mono focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
            value={data.variable || ''}
            onChange={(e) => data.onChangeVariable?.(e.target.value)}
            placeholder="stock_result"
          />
        </div>

        <div className="text-[10px] bg-emerald-50 text-emerald-700 p-2 rounded border border-emerald-200 leading-relaxed">
          📦 Busca un producto en la base de datos y guarda: nombre, stock, precio, y si hay disponibilidad.
          <br />
          Usa <code className="bg-emerald-100 px-1 rounded">{'{{stock_result.available}}'}</code> en un nodo Condición para ramificar.
        </div>
      </div>

      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-3 h-3 bg-gray-400" />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-3 h-3 bg-emerald-500" />
    </div>
  );
});
