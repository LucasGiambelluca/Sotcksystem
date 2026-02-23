import React, { useState } from 'react';
import { MessageSquare, HelpCircle, GitFork, BarChart2, Store, ShoppingCart, ShoppingBag, CheckCircle, ArrowRightCircle, MousePointerClick, UploadCloud, FileText, PauseCircle, Clock, ChevronLeft, ChevronRight, AlertTriangle, PackageSearch } from 'lucide-react';

const nodeItems = [
  { type: 'messageNode', icon: MessageSquare, label: 'Mensaje', desc: 'Envía un texto simple.', bg: 'bg-blue-100', text: 'text-blue-600' },
  { type: 'questionNode', icon: HelpCircle, label: 'Pregunta', desc: 'Espera una respuesta.', bg: 'bg-yellow-100', text: 'text-yellow-600' },
  { type: 'pollNode', icon: BarChart2, label: 'Encuesta', desc: 'Opciones múltiples.', bg: 'bg-purple-100', text: 'text-purple-600' },
  { type: 'conditionNode', icon: GitFork, label: 'Condición', desc: 'Ramifica según variable.', bg: 'bg-orange-100', text: 'text-orange-600' },
  { type: 'catalogNode', icon: Store, label: 'Catálogo', desc: 'Envía lista de precios.', bg: 'bg-green-100', text: 'text-green-600' },
  { type: 'stockCheckNode', icon: PackageSearch, label: 'Consulta Stock', desc: 'Busca disponibilidad.', bg: 'bg-emerald-100', text: 'text-emerald-600' },
  { type: 'addToCartNode', icon: ShoppingBag, label: 'Agregar Carrito', desc: 'Agrega producto al carrito.', bg: 'bg-cyan-100', text: 'text-cyan-600' },
  { type: 'orderSummaryNode', icon: ShoppingCart, label: 'Resumen', desc: 'Muestra el carrito.', bg: 'bg-indigo-100', text: 'text-indigo-600' },
  { type: 'createOrderNode', icon: CheckCircle, label: 'Crear Pedido', desc: 'Guarda en DB.', bg: 'bg-teal-100', text: 'text-teal-600' },
  { type: 'flowLinkNode', icon: ArrowRightCircle, label: 'Ir a Flujo', desc: 'Salta a otro flujo.', bg: 'bg-gray-100', text: 'text-gray-600' },
  { type: 'mediaUploadNode', icon: UploadCloud, label: 'Recibir Archivo', desc: 'Pide un archivo.', bg: 'bg-pink-100', text: 'text-pink-600' },
  { type: 'documentNode', icon: FileText, label: 'Enviar PDF', desc: 'Genera comprobante.', bg: 'bg-red-100', text: 'text-red-600' },
  { type: 'threadNode', icon: PauseCircle, label: 'Control Bot', desc: 'Pausa/Reanuda.', bg: 'bg-orange-100', text: 'text-orange-600' },
  { type: 'timerNode', icon: Clock, label: 'Timer / Espera', desc: 'Pausa el flujo.', bg: 'bg-blue-100', text: 'text-blue-600' },
  { type: 'reportNode', icon: AlertTriangle, label: 'Reporte', desc: 'Crea reclamo/queja.', bg: 'bg-red-100', text: 'text-red-600' },
  { type: 'handoverNode', icon: HelpCircle, label: 'Asesor Humano', desc: 'Pausa el bot y avisa.', bg: 'bg-rose-100', text: 'text-rose-600' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className={`${collapsed ? 'w-12' : 'w-52'} bg-white border-l border-gray-200 flex flex-col h-full transition-all duration-200 relative`}>
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -left-3 top-4 bg-white border border-gray-300 rounded-full w-6 h-6 flex items-center justify-center shadow-sm hover:bg-gray-50 z-10"
      >
        {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {collapsed ? (
        /* Collapsed: icon-only strip */
        <div className="flex flex-col items-center gap-1 pt-10 px-1 overflow-y-auto">
          {nodeItems.map(item => (
            <div
              key={item.type}
              className="p-2 rounded cursor-grab hover:bg-gray-100 transition"
              onDragStart={(e) => onDragStart(e, item.type)}
              draggable
              title={item.label}
            >
              <item.icon size={16} className={item.text} />
            </div>
          ))}
        </div>
      ) : (
        /* Expanded */
        <div className="p-3 flex flex-col gap-2 h-full overflow-y-auto">
          <h2 className="font-bold text-gray-700 text-sm">Nodos</h2>
          <div className="space-y-1.5">
            {nodeItems.map(item => (
              <div
                key={item.type}
                className="bg-white p-2 rounded shadow-sm hover:shadow transition cursor-grab active:cursor-grabbing border border-gray-100 flex items-center gap-2"
                onDragStart={(e) => onDragStart(e, item.type)}
                draggable
              >
                <div className={`${item.bg} p-1.5 rounded ${item.text}`}>
                  <item.icon size={14} />
                </div>
                <span className="text-xs font-medium text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto p-2 bg-gray-50 rounded text-[10px] text-gray-500 border border-gray-200 flex gap-1">
            <MousePointerClick size={12} />
            <p>Uní los puntos para conectar.</p>
          </div>
        </div>
      )}
    </aside>
  );
}
