import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { ShoppingCart, Trash2, CheckCircle2, PlusCircle, XCircle } from 'lucide-react';

export default memo(({ data, isConnectable }: any) => {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-80">
      <div className="bg-emerald-600 text-white p-2 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
            <ShoppingCart size={16} />
            <span className="font-medium text-sm">Validar Pedido (Checkout)</span>
        </div>
        <button onClick={data.onDelete} className="text-white hover:text-red-200 transition">
            <Trash2 size={14} />
        </button>
      </div>
      
      <div className="p-3 bg-emerald-50 space-y-3">
        <p className="text-[10px] text-emerald-800 leading-tight">
          Este nodo muestra el resumen del carrito al cliente y ofrece opciones para confirmar o seguir sumando productos.
        </p>

        <div>
          <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Mensaje Inicial (Opcional)</label>
          <textarea
            className="w-full text-xs p-2 border border-emerald-200 rounded resize-none focus:outline-none focus:border-emerald-500 bg-white"
            rows={2}
            value={data.message || ''}
            onChange={(evt) => data.onChangeMessage ? data.onChangeMessage(evt.target.value) : null}
            placeholder="Ej: ¡Excelente elección! Acá tenés el resumen de tu pedido:"
          />
        </div>

        <div className="space-y-2">
            <label className="block text-[10px] font-bold text-emerald-700 uppercase">Handles de Salida:</label>
            <div className="flex items-center gap-2 text-[10px] bg-white p-1.5 rounded border border-emerald-100">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span className="font-semibold text-gray-700">confirmed</span>
                <span className="text-gray-400"> (Todo correcto)</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] bg-white p-1.5 rounded border border-emerald-100">
                <PlusCircle size={12} className="text-blue-600" />
                <span className="font-semibold text-gray-700">add_drink / add_dessert / add_more</span>
                <span className="text-gray-400"> (Sumar más)</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] bg-white p-1.5 rounded border border-emerald-100">
                <XCircle size={12} className="text-red-600" />
                <span className="font-semibold text-gray-700">cancel</span>
                <span className="text-gray-400"> (Volver atrás)</span>
            </div>
        </div>
      </div>

      {/* Target handle (Input) */}
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3 bg-emerald-500" />
      
      {/* Dynamic Source handles (Outputs) */}
      <div className="border-t border-emerald-100 mt-2 px-3 py-4 space-y-6">
          <div className="flex items-center justify-end gap-3 relative">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">✅ Confirmar</span>
              <Handle type="source" position={Position.Right} id="confirmed" isConnectable={isConnectable} className="w-3 h-3 bg-emerald-500 !-right-[20px]" />
          </div>
          
          <div className="flex items-center justify-end gap-3 relative">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">🥤 Bebida</span>
              <Handle type="source" position={Position.Right} id="add_drink" isConnectable={isConnectable} className="w-3 h-3 bg-blue-500 !-right-[20px]" />
          </div>
          
          <div className="flex items-center justify-end gap-3 relative">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">🍰 Postre</span>
              <Handle type="source" position={Position.Right} id="add_dessert" isConnectable={isConnectable} className="w-3 h-3 bg-indigo-500 !-right-[20px]" />
          </div>
          
          <div className="flex items-center justify-end gap-3 relative">
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-tighter">🛒 Más</span>
              <Handle type="source" position={Position.Right} id="add_more" isConnectable={isConnectable} className="w-3 h-3 bg-orange-500 !-right-[20px]" />
          </div>
          
          <div className="flex items-center justify-end gap-3 relative">
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-tighter">❌ Cancelar</span>
              <Handle type="source" position={Position.Right} id="cancel" isConnectable={isConnectable} className="w-3 h-3 bg-red-500 !-right-[20px]" />
          </div>
      </div>
    </div>
  );
});
