
import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { MapPin, Trash2 } from 'lucide-react';

export default memo(({ data, isConnectable }: any) => {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-64 overflow-hidden">
      <div className="bg-emerald-600 text-white p-2 rounded-t-lg flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
            <MapPin size={16} />
            <span className="font-semibold text-sm">Validador de Ubicación</span>
        </div>
        <button onClick={data.onDelete} className="text-white hover:text-red-200 transition">
            <Trash2 size={14} />
        </button>
      </div>
      <div className="p-3 bg-emerald-50 text-emerald-900">
        <p className="text-[10px] mb-2 leading-relaxed font-medium">
            Este nodo valida automáticamente si la dirección del cliente (en la variable <code className="bg-white px-1 rounded border border-emerald-200">respuesta</code> o <code className="bg-white px-1 rounded border border-emerald-200">direccion</code>) está dentro de tu zona de cobertura.
        </p>
        
        <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 mt-4 px-2">
             <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span>FUERA DE ZONA</span>
             </div>
             <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>DENTRO ✅</span>
             </div>
        </div>
      </div>
      
      {/* Entrada */}
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3 bg-emerald-400 border-2 border-white" />
      
      {/* Salida False (Fuera de zona) */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="false"
        style={{ left: '25%', background: '#ef4444', border: '2px solid white', width: '10px', height: '10px' }}
        isConnectable={isConnectable} 
      />
      
      {/* Salida True (Dentro de zona) */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="true"
        style={{ left: '75%', background: '#22c55e', border: '2px solid white', width: '10px', height: '10px' }}
        isConnectable={isConnectable} 
      />
    </div>
  );
});
