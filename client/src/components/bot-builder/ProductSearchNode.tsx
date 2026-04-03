import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Brain, HelpCircle, Trash2 } from 'lucide-react';

export default memo(({ data, isConnectable }: any) => {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-blue-200 w-72 overflow-hidden">
      <div className="bg-blue-600 text-white p-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
            <Brain size={16} />
            <span className="font-semibold text-sm">Buscador Inteligente</span>
        </div>
        <button onClick={data.onDelete} className="text-white hover:text-blue-200 transition">
            <Trash2 size={14} />
        </button>
      </div>
      
      <div className="p-3 bg-blue-50 space-y-4">
        <p className="text-[10px] text-blue-800 leading-tight">
          Busca productos en el catálogo por nombre o categoría y permite agregarlos al carrito mediante un menú numérico.
        </p>

        <div className="space-y-3 p-2 bg-white rounded border border-blue-100 shadow-inner">
            <div>
              <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Término de Búsqueda (Fijo)</label>
              <input 
                className="w-full text-xs p-1.5 border border-blue-100 rounded focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-blue-200"
                value={data.query || ''}
                onChange={(evt) => data.onChangeQuery ? data.onChangeQuery(evt.target.value) : null}
                placeholder="Ej: bebidas (O dejar vacío para usar el mensaje del cliente)"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Título del Menú</label>
              <textarea
                className="w-full text-xs p-1.5 border border-blue-100 rounded resize-none focus:ring-1 focus:ring-blue-500 outline-none"
                rows={2}
                value={data.message || ''}
                onChange={(evt) => data.onChangeMessage ? data.onChangeMessage(evt.target.value) : null}
                placeholder="Ej: Estas son las bebidas que tenemos:"
              />
            </div>
        </div>

        <div className="flex items-start gap-2 text-[10px] text-blue-600 bg-blue-100/50 p-2 rounded italic">
            <HelpCircle size={12} className="mt-0.5 shrink-0" />
            <span>Este nodo <b>pausa</b> el flujo para que el cliente elija un número. Al elegirlo, el producto se suma al carrito automáticamente y el flujo avanza.</span>
        </div>
      </div>

      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3 bg-blue-500 border-white border-2" />
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3 bg-blue-500 border-white border-2" />
    </div>
  );
});
