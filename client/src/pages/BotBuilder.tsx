
import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
} from 'reactflow';
import type { Connection, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { Save, Trash2, Download, Upload } from 'lucide-react';
// ... existing imports ...

// ... inside BotBuilder component ...

// ... existing imports ...
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import Sidebar from '../components/bot-builder/Sidebar';
import MessageNode from '../components/bot-builder/MessageNode';
import QuestionNode from '../components/bot-builder/QuestionNode';
import ConditionalNode from '../components/bot-builder/ConditionNode';
import PollNode from '../components/bot-builder/PollNode';

import CatalogNode from '../components/bot-builder/CatalogNode';
import OrderSummaryNode from '../components/bot-builder/OrderSummaryNode';
import CreateOrderNode from '../components/bot-builder/CreateOrderNode';
import FlowLinkNode from '../components/bot-builder/FlowLinkNode';
import MediaUploadNode from '../components/bot-builder/MediaUploadNode';
import DocumentGeneratorNode from '../components/bot-builder/DocumentGeneratorNode';
import ThreadNode from '../components/bot-builder/ThreadNode';
import TimerNode from '../components/bot-builder/TimerNode';
import ReportNode from '../components/bot-builder/ReportNode';
import StockCheckNode from '../components/bot-builder/StockCheckNode';
import AddToCartNode from '../components/bot-builder/AddToCartNode';
import HandoverNode from '../components/bot-builder/HandoverNode';
import BusinessHoursNode from '../components/bot-builder/BusinessHoursNode';
import SendCatalogNode from '../components/bot-builder/SendCatalogNode';
import SendMediaNode from '../components/bot-builder/SendMediaNode';
import OrderStatusNode from '../components/bot-builder/OrderStatusNode';
import GroqNode from '../components/bot-builder/GroqNode';
import IntentResolverNode from '../components/bot-builder/IntentResolverNode';
import LocationValidatorNode from '../components/bot-builder/LocationValidatorNode';
import OrderValidatorNode from '../components/bot-builder/OrderValidatorNode';
import ClearCartNode from '../components/bot-builder/ClearCartNode';
import ProductSearchNode from '../components/bot-builder/ProductSearchNode';

// Register custom node types
const nodeTypes = {
  messageNode: MessageNode,
  questionNode: QuestionNode,
  conditionNode: ConditionalNode,
  pollNode: PollNode,
  catalogNode: CatalogNode,
  orderSummaryNode: OrderSummaryNode,
  createOrderNode: CreateOrderNode,
  flowLinkNode: FlowLinkNode,
  mediaUploadNode: MediaUploadNode,
  documentNode: DocumentGeneratorNode,
  threadNode: ThreadNode,
  timerNode: TimerNode,
  reportNode: ReportNode,
  stockCheckNode: StockCheckNode,
  addToCartNode: AddToCartNode,
  handoverNode: HandoverNode,
  businessHoursNode: BusinessHoursNode,
  sendCatalogNode: SendCatalogNode,
  sendMediaNode: SendMediaNode,
  orderStatusNode: OrderStatusNode,
  groqNode: GroqNode,
  intentResolverNode: IntentResolverNode,
  locationValidatorNode: LocationValidatorNode,
  orderValidatorNode: OrderValidatorNode,
  clearCartNode: ClearCartNode,
  productSearchNode: ProductSearchNode,
};

const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'input',
    data: { label: 'Inicio (Palabra Clave: Hola)' },
    position: { x: 250, y: 5 },
    style: { background: '#22c55e', color: 'white', border: 'none', fontWeight: 'bold' }
  },
];

// Generate unique IDs for nodes safely so they don't clash with loaded JSON
const getId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export default function BotBuilder() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  
  const [flows, setFlows] = useState<any[]>([]);
  const [currentFlowId, setCurrentFlowId] = useState<string | number | null>(null);
  const [flowName, setFlowName] = useState('Nuevo Flujo');
  const [trigger, setTrigger] = useState('hola');
  const [isActive, setIsActive] = useState(true);

  // Load flows list on mount
  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    const { data } = await supabase.from('flows').select('id, name, trigger_word, nodes, edges, is_active').order('created_at', { ascending: false });
    console.log('🔄 Fetched Flows:', data);
    if (data) setFlows(data);
  };

  const updateNodeData = useCallback((id: string, data: any) => {
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, ...data } } : node));
  }, [setNodes]);

  const deleteNode = useCallback((id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);

  const prepareNodes = useCallback((nodes: any[]) => {
    return (nodes || []).map((n: any) => {
      let nodeData = {};
      try {
        nodeData = typeof n.data === 'string' ? JSON.parse(n.data) : (n.data || {});
      } catch (err) {
        console.error('[BotBuilder] Error parsing data:', err);
        nodeData = n.data || {};
      }

      let nodePos = { x: 0, y: 0 };
      try {
        nodePos = typeof n.position === 'string' ? JSON.parse(n.position) : (n.position || { x: 0, y: 0 });
      } catch (err) {
        console.error('[BotBuilder] Error parsing position:', err);
        nodePos = n.position || { x: 0, y: 0 };
      }

      return {
        ...n,
        position: nodePos,
        data: {
          ...nodeData,
          onChange: (text: string) => updateNodeData(n.id, { text }),
          onChangeQuestion: (q: string) => updateNodeData(n.id, { question: q }),
          onChangeVariable: (v: string) => updateNodeData(n.id, { variable: v }),
          onChangeValue: (v: string) => updateNodeData(n.id, { expectedValue: v }),
          onChangeOptions: (o: string[]) => updateNodeData(n.id, { options: o }),
          onChangeSaveField: (f: string) => updateNodeData(n.id, { saveField: f }),
          onChangeFlow: (f: string) => updateNodeData(n.id, { flowId: f }),
          onChangeProductVar: (v: string) => updateNodeData(n.id, { productVariable: v }),
          onChangeQtyVar: (v: string) => updateNodeData(n.id, { qtyVariable: v }),
          onChangeDetailVar: (v: string) => updateNodeData(n.id, { detailVariable: v }),
          onChangeDuration: (d: string) => updateNodeData(n.id, { duration: d }),
          onChangeShowTyping: (t: boolean) => updateNodeData(n.id, { showTyping: t }),
          onChangeReportType: (t: string) => updateNodeData(n.id, { reportType: t }),
          onChangePriority: (p: string) => updateNodeData(n.id, { priority: p }),
          onChangeMessage: (m: string) => updateNodeData(n.id, { message: m }),
          onChangeMediaUrl: (u: string) => updateNodeData(n.id, { mediaUrl: u }),
          onChangeCaption: (c: string) => updateNodeData(n.id, { caption: c }),
          onChangeMediaType: (t: string) => updateNodeData(n.id, { mediaType: t }),
          onChangeFileName: (n_name: string) => updateNodeData(n.id, { fileName: n_name }),
          onChangeMimeType: (m: string) => updateNodeData(n.id, { mimetype: m }),
          onChangePrompt: (p: string) => updateNodeData(n.id, { prompt: p }),
          onChangeSystemPrompt: (s: string) => updateNodeData(n.id, { systemPrompt: s }),
          onChangeTemperature: (t: number) => updateNodeData(n.id, { temperature: t }),
          onChangeSilent: (s: boolean) => updateNodeData(n.id, { silent: s }),
          onChangePossibleIntents: (i: string) => updateNodeData(n.id, { possible_intents: i }),
          onChangeFallbackMessage: (m: string) => updateNodeData(n.id, { fallback_message: m }),
          onChangeMaxRetries: (r: number) => updateNodeData(n.id, { max_retries: r }),
          onChangeContextVariables: (c: string[]) => updateNodeData(n.id, { context_variables: c }),
          onChangeFailNodeId: (f: string) => updateNodeData(n.id, { failNodeId: f }),
          onChangeQuery: (q: string) => updateNodeData(n.id, { query: q }),
          onDelete: () => deleteNode(n.id),
        }
      };
    });
  }, [updateNodeData, deleteNode]);

  const loadFlow = useCallback((flow: any) => {
      console.log('🔄 Loading Flow:', flow);
      setCurrentFlowId(flow.id);
      setFlowName(flow.name);
      setTrigger(flow.trigger_word);
      setIsActive(flow.is_active);
      
      const restoredNodes = prepareNodes(flow.nodes || []);
      console.log('🔄 Setting Nodes:', restoredNodes);
      setNodes(restoredNodes);
      setEdges(flow.edges || []);
      toast.info(`Flujo "${flow.name}" cargado`);
  }, [prepareNodes, setNodes, setEdges]);

  const createNewFlow = useCallback(() => {
      setCurrentFlowId(null);
      setFlowName('Nuevo Flujo');
      setTrigger('nuevo');
      setIsActive(true);
      setNodes(prepareNodes(initialNodes));
      setEdges([]);
  }, [prepareNodes, setNodes, setEdges]);

  // Initial preparation for nodes on mount
  useEffect(() => {
    setNodes((nds) => prepareNodes(nds));
  }, []);

  const onConnect = useCallback((params: Connection | Edge) => {
    // Only create edges for explicit handle-to-handle connections
    if (!params.source || !params.target || params.source === params.target) return;
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { 
            // Default data
            text: type === 'messageNode' || type === 'mediaUploadNode' ? '' : undefined,
            caption: type === 'sendMediaNode' ? '' : undefined,
            mediaUrl: type === 'sendMediaNode' ? '' : undefined,
            mediaType: type === 'sendMediaNode' ? '' : undefined,
            duration: type === 'timerNode' ? 1000 : undefined,
            showTyping: type === 'timerNode' ? true : undefined,
            systemPrompt: type === 'groqNode' ? 'Sos un asistente virtual para una rotisería.' : undefined,
            prompt: type === 'groqNode' ? 'Analizá este mensaje: {{respuesta}}' : undefined,
            variable: type === 'questionNode' || type === 'pollNode' || type === 'mediaUploadNode' || type === 'stockCheckNode' || type === 'groqNode' || type === 'intentResolverNode' ? (type === 'mediaUploadNode' ? 'file_url' : type === 'stockCheckNode' ? 'stock_result' : type === 'groqNode' ? 'ai_response' : type === 'intentResolverNode' ? 'intent_clasificado' : 'respuesta') : undefined,
            temperature: type === 'groqNode' ? 0.7 : undefined,
            silent: type === 'groqNode' ? false : undefined,
            possible_intents: type === 'intentResolverNode' ? 'delivery, retiro, cancelar, no_entendido' : undefined,
            max_retries: type === 'intentResolverNode' ? 2 : undefined,
            fallback_message: type === 'intentResolverNode' ? 'No te entendí bien. ¿Podrías expresarlo con otras palabras?' : undefined,
            context_variables: type === 'intentResolverNode' ? [] : undefined,
            // locationValidatorNode uses default logic from executor
            failNodeId: type === 'locationValidatorNode' ? '' : undefined,
            message: type === 'orderValidatorNode' ? '🛒 *Confirma tu pedido:*' : type === 'clearCartNode' ? '🧹 Carrito vaciado.' : type === 'productSearchNode' ? '🔍 Resultados de búsqueda:' : undefined,
            query: type === 'productSearchNode' ? '' : undefined,
            
            // Callbacks
            onDelete: () => deleteNode(newNode.id),
            onChange: (text: string) => updateNodeData(newNode.id, { text }),
            onChangeQuestion: (q: string) => updateNodeData(newNode.id, { question: q }),
            onChangeVariable: (v: string) => updateNodeData(newNode.id, { variable: v }),
            onChangeValue: (v: string) => updateNodeData(newNode.id, { expectedValue: v }),
            onChangeOptions: (o: string[]) => updateNodeData(newNode.id, { options: o }),
            onChangeFlow: (f: string) => updateNodeData(newNode.id, { flowId: f }),
            onChangeAction: (a: string) => updateNodeData(newNode.id, { action: a }),
            onChangeProductVar: (v: string) => updateNodeData(newNode.id, { productVariable: v }),
            onChangeQtyVar: (v: string) => updateNodeData(newNode.id, { qtyVariable: v }),
            onChangeDetailVar: (v: string) => updateNodeData(newNode.id, { detailVariable: v }),
            onChangeDuration: (d: string) => updateNodeData(newNode.id, { duration: d }),
            onChangeShowTyping: (t: boolean) => updateNodeData(newNode.id, { showTyping: t }),
            onChangeReportType: (t: string) => updateNodeData(newNode.id, { reportType: t }),
            onChangePriority: (p: string) => updateNodeData(newNode.id, { priority: p }),
            onChangeMessage: (m: string) => updateNodeData(newNode.id, { message: m }),
            onChangeMediaUrl: (u: string) => updateNodeData(newNode.id, { mediaUrl: u }),
            onChangeCaption: (c: string) => updateNodeData(newNode.id, { caption: c }),
            onChangeMediaType: (t: string) => updateNodeData(newNode.id, { mediaType: t }),
            onChangeFileName: (n_name: string) => updateNodeData(newNode.id, { fileName: n_name }),
            onChangeMimeType: (m: string) => updateNodeData(newNode.id, { mimetype: m }),
            onChangePrompt: (p: string) => updateNodeData(newNode.id, { prompt: p }),
            onChangeSystemPrompt: (s: string) => updateNodeData(newNode.id, { systemPrompt: s }),
            onChangeTemperature: (t: number) => updateNodeData(newNode.id, { temperature: t }),
            onChangeSilent: (s: boolean) => updateNodeData(newNode.id, { silent: s }),
            onChangePossibleIntents: (i: string) => updateNodeData(newNode.id, { possible_intents: i }),
            onChangeFallbackMessage: (m: string) => updateNodeData(newNode.id, { fallback_message: m }),
            onChangeMaxRetries: (r: number) => updateNodeData(newNode.id, { max_retries: r }),
            onChangeContextVariables: (c: string[]) => updateNodeData(newNode.id, { context_variables: c }),
            onChangeFailNodeId: (f: string) => updateNodeData(newNode.id, { failNodeId: f }),
            onChangeQuery: (q: string) => updateNodeData(newNode.id, { query: q }),
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );
  
  const handleSave = async () => {
    if (!reactFlowInstance) return;
    const flow = reactFlowInstance.toObject();
    
    // Clean up nodes data before saving
    const cleanNodes = flow.nodes.map((n: any) => {
        const { onChange, onChangeQuestion, onChangeVariable, onChangeValue, onChangeOptions, onChangeSaveField, onChangeFlow, onDelete, onChangeAction, onChangeProductVar, onChangeQtyVar, onChangeDetailVar, onChangeDuration, onChangeShowTyping, onChangeReportType, onChangePriority, onChangeMessage, onChangeMediaUrl, onChangeCaption, onChangeMediaType, onChangeFileName, onChangeMimeType, onChangePrompt, onChangeSystemPrompt, onChangeTemperature, onChangeSilent, onChangePossibleIntents, onChangeFallbackMessage, onChangeMaxRetries, onChangeContextVariables, onChangeFailNodeId, onChangeQuery, ...restData } = n.data;
        return { ...n, data: restData };
    });

    try {
        const payload: any = {
            name: flowName,
            trigger_word: trigger,
            nodes: cleanNodes,
            edges: flow.edges,
            is_active: isActive
        };
        
        if (currentFlowId) {
            payload.id = currentFlowId;
        }

        const { data, error } = await supabase.from('flows').upsert(payload).select().single();

        if (error) throw error;
        
        if (data) {
            setCurrentFlowId(data.id);
            fetchFlows(); // Refresh list
        }
        
        toast.success('Flujo guardado correctamente');
    } catch (err: any) {
        toast.error('Error al guardar: ' + err.message);
    }
  };

  const handleExport = () => {
    if (!reactFlowInstance) return;
    const flow = reactFlowInstance.toObject();
    
    // Clean nodes data like we do for handleSave
    const cleanNodes = flow.nodes.map((n: any) => {
        const { 
            onChange, onChangeQuestion, onChangeVariable, onChangeValue, onChangeOptions, 
            onChangeSaveField, onChangeFlow, onDelete, onChangeAction, onChangeProductVar, 
            onChangeQtyVar, onChangeDetailVar, onChangeDuration, onChangeShowTyping, 
            onChangeReportType, onChangePriority, onChangeMessage, onChangeMediaUrl, 
            onChangeCaption, onChangeMediaType, onChangeFileName, onChangeMimeType, 
            onChangePrompt, onChangeSystemPrompt, onChangeTemperature, onChangeSilent, 
            onChangePossibleIntents, onChangeFallbackMessage, onChangeMaxRetries, 
            onChangeContextVariables, onChangeFailNodeId, onChangeQuery, ...restData 
        } = n.data;
        return { ...n, data: restData };
    });

    const exportData = {
        version: '1.0',
        name: flowName,
        trigger_word: trigger,
        is_active: isActive,
        nodes: cleanNodes,
        edges: flow.edges
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${flowName.replace(/\s+/g, '_')}_bot_flow.json`;
    link.click();
    toast.success('Flujo exportado correctamente');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.nodes || !Array.isArray(json.nodes)) {
            throw new Error('El archivo no parece ser un flujo válido (faltan nodos)');
        }

        // Load into editor as a "New Flow" (unsaved)
        setCurrentFlowId(null);
        setFlowName(`${json.name || 'Importado'} (Copia)`);
        setTrigger(json.trigger_word || 'cambiame');
        setIsActive(json.is_active ?? true);
        
        const restoredNodes = prepareNodes(json.nodes);
        setNodes(restoredNodes);
        setEdges(json.edges || []);

        toast.success(`Flujo "${json.name}" importado con éxito. No olvides guardarlo.`);
      } catch (err: any) {
        toast.error('Error al importar: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const handleDelete = async () => {
      if (!currentFlowId) return;
      
      const confirmDelete = window.confirm(`¿Estás seguro de que quieres eliminar el flujo "${flowName}"? Esta acción no se puede deshacer.`);
      if (!confirmDelete) return;

      try {
          const { error } = await supabase.from('flows').delete().eq('id', currentFlowId);
          if (error) throw error;
          
          toast.success('Flujo eliminado correctamente');
          createNewFlow();
          fetchFlows();
      } catch (err: any) {
          console.error('Error deleting flow:', err);
          toast.error('Error al eliminar: ' + err.message);
      }
  };



  return (
    <div className="flex h-screen w-full">
      <ReactFlowProvider>
        <div className="flex-1 flex flex-col h-full bg-gray-50" ref={reactFlowWrapper}>
            {/* Header */}
            <div className="h-16 bg-white border-b flex items-center justify-between px-4 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 font-semibold mb-1">Mis Flujos</label>
                        <select 
                            className="text-sm border-gray-300 rounded focus:ring-purple-500 py-1"
                            value={currentFlowId === null ? '' : (currentFlowId ?? '')}
                            onChange={(e) => {
                                const val = e.target.value;
                                console.log('🔄 Selected ID:', val);
                                if (val === '') {
                                    createNewFlow();
                                } else {
                                    // IDs can be UUIDs (strings) or Numbers. strict comparison might fail if types differ.
                                    // We compare as strings to be safe.
                                    const flow = flows.find(f =>String(f.id) === String(val));
                                    console.log('🔄 Found Flow:', flow);
                                    if (flow) {
                                        loadFlow(flow);
                                    } else {
                                        toast.error('Error al cargar flujo ' + val);
                                    }
                                }
                            }}
                        >
                            <option value="">+ Nuevo Flujo</option>
                            {flows.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="h-8 w-px bg-gray-300 mx-2"></div>

                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 font-semibold mb-1">Nombre del Flujo</label>
                        <input 
                            className="font-bold text-sm border-gray-300 rounded focus:ring-purple-500 py-1 w-48"
                            value={flowName}
                            onChange={(e) => setFlowName(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 font-semibold mb-1">Palabra Clave</label>
                        <input 
                            className="text-sm border-gray-300 rounded focus:ring-purple-500 py-1 w-32 font-mono text-blue-600"
                            value={trigger}
                            onChange={(e) => setTrigger(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                     <label className="flex items-center cursor-pointer relative">
                        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                        <span className="ml-2 text-xs font-medium text-gray-900">Activo</span>
                    </label>

                    <div className="h-8 w-px bg-gray-200 mx-1"></div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleExport}
                            title="Exportar archivo JSON"
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded transition"
                        >
                            <Download size={20} />
                        </button>
                        
                        <label className="p-2 text-gray-600 hover:bg-gray-100 rounded transition cursor-pointer">
                            <Upload size={20} />
                            <input 
                                type="file" 
                                accept=".json" 
                                className="hidden" 
                                onChange={handleImport}
                            />
                        </label>
                    </div>

                    <div className="h-8 w-px bg-gray-200 mx-1"></div>

                    {currentFlowId && (
                        <button 
                            onClick={handleDelete}
                            className="bg-red-50 text-red-600 px-4 py-2 rounded flex items-center gap-2 hover:bg-red-100 transition shadow-sm border border-red-200"
                        >
                            <Trash2 size={18} />
                            Eliminar
                        </button>
                    )}

                    <button 
                        onClick={handleSave}
                        className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-700 transition shadow-md"
                    >
                        <Save size={18} />
                        Guardar
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 w-full h-full">
                <ReactFlow
                    key={currentFlowId || 'initial'}
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    nodeTypes={nodeTypes}
                    // @ts-ignore
                    connectOnDrop={false}
                    deleteKeyCode={['Backspace', 'Delete']}
                    defaultEdgeOptions={{
                        animated: true,
                        style: { strokeWidth: 2, stroke: '#6366f1' },
                    }}
                    onEdgeDoubleClick={(_event, edge) => {
                        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
                    }}
                    fitView
                >
                    <Controls />
                    <Background color="#aaa" gap={16} />
                </ReactFlow>
            </div>
        </div>
        <Sidebar />
      </ReactFlowProvider>
    </div>
  );
}
