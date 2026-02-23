
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { Loader2, AlertCircle, CheckCircle, Clock, MessageSquare, Lightbulb, ShoppingCart, AlertTriangle } from 'lucide-react';

interface Claim {
    id: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved';
    priority: 'low' | 'medium' | 'high';
    type: string;
    created_at: string;
    client: {
        name: string;
        phone: string;
    };
    metadata: any;
}

const STATUS_LABELS: Record<string, string> = {
    all: 'Todos',
    open: 'Abierto',
    in_progress: 'En Progreso',
    resolved: 'Resuelto',
};

const TYPE_LABELS: Record<string, string> = {
    all: 'Todos',
    reclamo: 'Reclamo',
    queja: 'Queja',
    sugerencia: 'Sugerencia',
    ventas: 'Ventas',
};

const PRIORITY_LABELS: Record<string, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
};

export default function ClaimsPanel() {
    const [claims, setClaims] = useState<Claim[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchClaims();
    }, [filterStatus, filterType]);

    const fetchClaims = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('claims')
                .select('*, client:clients(name, phone)')
                .order('created_at', { ascending: false });

            if (filterStatus !== 'all') {
                query = query.eq('status', filterStatus);
            }
            if (filterType !== 'all') {
                query = query.eq('type', filterType);
            }

            const { data, error } = await query;
            if (error) throw error;
            setClaims(data || []);
        } catch (error: any) {
            toast.error('Error al cargar reportes: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('claims')
                .update({ status: newStatus, updated_at: new Date() })
                .eq('id', id);

            if (error) throw error;
            toast.success('Estado actualizado');
            fetchClaims();
            setSelectedClaim(null);
        } catch (error: any) {
            toast.error('Error al actualizar: ' + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-red-100 text-red-700 border-red-200';
            case 'in_progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'reclamo': return 'bg-red-50 text-red-600 border-red-200';
            case 'queja': return 'bg-orange-50 text-orange-600 border-orange-200';
            case 'sugerencia': return 'bg-blue-50 text-blue-600 border-blue-200';
            case 'ventas': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
            default: return 'bg-gray-50 text-gray-600 border-gray-200';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'reclamo': return <AlertCircle size={16} className="text-red-500" />;
            case 'queja': return <AlertTriangle size={16} className="text-orange-500" />;
            case 'sugerencia': return <Lightbulb size={16} className="text-blue-500" />;
            case 'ventas': return <ShoppingCart size={16} className="text-emerald-500" />;
            default: return <MessageSquare size={16} className="text-gray-500" />;
        }
    };

    const getStatusLabel = (status: string) => STATUS_LABELS[status] || status;
    const getTypeLabel = (type: string) => TYPE_LABELS[type] || type;
    const getPriorityLabel = (priority: string) => PRIORITY_LABELS[priority] || priority;

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar List */}
            <div className="w-1/3 border-r bg-white flex flex-col">
                <div className="p-4 border-b">
                    <h1 className="text-xl font-bold mb-3">Reportes</h1>

                    {/* Status Filter */}
                    <div className="flex gap-2 mb-3">
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <button
                                key={value}
                                onClick={() => setFilterStatus(value)}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterStatus === value ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Type Filter */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {Object.entries(TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
                    ) : claims.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">No hay reportes encontrados.</div>
                    ) : (
                        claims.map(claim => (
                            <div
                                key={claim.id}
                                onClick={() => setSelectedClaim(claim)}
                                className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedClaim?.id === claim.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(claim.status)}`}>
                                        {getStatusLabel(claim.status)}
                                    </span>
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <Clock size={12} />
                                        {new Date(claim.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="font-medium text-gray-900 truncate">{claim.client?.name || claim.client?.phone || 'Cliente desconocido'}</h3>
                                <p className="text-sm text-gray-500 truncate mb-1">{claim.description}</p>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded border flex items-center gap-1 ${getTypeColor(claim.type)}`}>
                                        {getTypeIcon(claim.type)}
                                        {getTypeLabel(claim.type)}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
                {selectedClaim ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold mb-1">Detalle del Reporte</h2>
                                <p className="text-gray-500 text-sm">ID: {selectedClaim.id}</p>
                            </div>
                            <div className="flex gap-2">
                                {selectedClaim.status !== 'resolved' && (
                                    <button
                                        onClick={() => handleUpdateStatus(selectedClaim.id, 'resolved')}
                                        disabled={updating}
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                                    >
                                        <CheckCircle size={16} />
                                        Resolver
                                    </button>
                                )}
                                {selectedClaim.status === 'open' && (
                                    <button
                                        onClick={() => handleUpdateStatus(selectedClaim.id, 'in_progress')}
                                        disabled={updating}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                    >
                                        En Progreso
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-3 gap-6">
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Cliente</h3>
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                    <p className="text-lg font-medium">{selectedClaim.client?.name || 'N/A'}</p>
                                    <p className="text-gray-600">{selectedClaim.client?.phone}</p>
                                    <a href={`https://wa.me/${selectedClaim.client?.phone}`} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                                        Contactar por WhatsApp
                                    </a>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Estado</h3>
                                <div className="flex flex-col gap-3">
                                    <div className={`p-4 rounded-lg border ${getStatusColor(selectedClaim.status)}`}>
                                        <span className="block text-xs uppercase opacity-70">Estado Actual</span>
                                        <span className="text-lg font-bold">{getStatusLabel(selectedClaim.status)}</span>
                                    </div>
                                    <div className="p-4 rounded-lg border bg-gray-50 border-gray-200">
                                        <span className="block text-xs uppercase text-gray-500">Prioridad</span>
                                        <span className={`text-lg font-bold ${selectedClaim.priority === 'high' ? 'text-red-600' : selectedClaim.priority === 'medium' ? 'text-yellow-600' : 'text-gray-700'}`}>
                                            {getPriorityLabel(selectedClaim.priority)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Tipo de Reporte</h3>
                                <div className={`p-4 rounded-lg border ${getTypeColor(selectedClaim.type)}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        {getTypeIcon(selectedClaim.type)}
                                        <span className="text-lg font-bold">{getTypeLabel(selectedClaim.type)}</span>
                                    </div>
                                    <span className="block text-xs opacity-70">
                                        {selectedClaim.type === 'reclamo' && 'El cliente reporta un problema'}
                                        {selectedClaim.type === 'queja' && 'El cliente expresa una disconformidad'}
                                        {selectedClaim.type === 'sugerencia' && 'El cliente propone una mejora'}
                                        {selectedClaim.type === 'ventas' && 'Consulta o solicitud de venta'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Descripción / Mensaje</h3>
                            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-gray-800 whitespace-pre-wrap leading-relaxed">
                                {selectedClaim.description}
                            </div>
                        </div>

                        {selectedClaim.metadata && Object.keys(selectedClaim.metadata).length > 0 && (
                            <div className="p-6 border-t bg-gray-50">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Metadatos Técnicos</h3>
                                <pre className="text-xs bg-gray-100 p-2 rounded border overflow-x-auto text-gray-600">
                                    {JSON.stringify(selectedClaim.metadata, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <MessageSquare size={48} className="mb-4 opacity-20" />
                        <p>Selecciona un reporte para ver el detalle</p>
                    </div>
                )}
            </div>
        </div>
    );
}
