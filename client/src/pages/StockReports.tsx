import { useEffect, useState } from 'react';
import { Package, TrendingUp, TrendingDown, RefreshCw, Calendar, FileText } from 'lucide-react';
import { stockMovementService } from '../services/stockMovementService';
import type { StockMovement } from '../types';

export default function StockReports() {
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await stockMovementService.getAllMovements();
            setMovements(data);
        } catch (error) {
            console.error('Error loading stock movements:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate summaries
    const totalPurchased = movements.filter(m => m.type === 'PURCHASE').reduce((sum, m) => sum + m.quantity, 0);
    const totalTransferred = movements.filter(m => m.type === 'TRANSFER').reduce((sum, m) => sum + m.quantity, 0);
    const totalSold = movements.filter(m => m.type === 'SALE').reduce((sum, m) => sum + m.quantity, 0);

    const getMovementIcon = (type: string) => {
        switch (type) {
            case 'PURCHASE': return <TrendingUp className="text-emerald-500" size={20} />;
            case 'TRANSFER': return <RefreshCw className="text-indigo-500" size={20} />;
            case 'SALE': return <TrendingDown className="text-blue-500" size={20} />;
            default: return <FileText className="text-gray-400" size={20} />;
        }
    };

    const getMovementLabel = (type: string) => {
        switch (type) {
            case 'PURCHASE': return <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md font-medium text-xs">Ingreso Consolidado</span>;
            case 'TRANSFER': return <span className="text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md font-medium text-xs">A Producción</span>;
            case 'SALE': return <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded-md font-medium text-xs">Venta Directa/Bot</span>;
            case 'ADJUSTMENT': return <span className="text-gray-700 bg-gray-50 px-2 py-1 rounded-md font-medium text-xs">Ajuste Manual</span>;
            default: return type;
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando reportes...</div>;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Reportes de Stock</h1>
                    <p className="text-gray-500 mt-1">Historial completo de movimientos de mercadería</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center space-x-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                        <TrendingUp className="text-emerald-600" size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Comprado (Depósito)</p>
                        <p className="text-2xl font-bold text-gray-900">{totalPurchased} un.</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center space-x-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <RefreshCw className="text-indigo-600" size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Usado p/ Producción</p>
                        <p className="text-2xl font-bold text-gray-900">{totalTransferred} un.</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                        <TrendingDown className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Vendido a Clientes</p>
                        <p className="text-2xl font-bold text-gray-900">{totalSold} un.</p>
                    </div>
                </div>
            </div>

            {/* Movements List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center">
                    <Calendar className="text-gray-400 mr-2" size={20} />
                    <h2 className="font-semibold text-gray-700">Todos los Movimientos</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white text-gray-500 font-medium text-sm uppercase tracking-wider border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Producto</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4 text-right">Cantidad</th>
                                <th className="px-6 py-4">Notas / Origen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {movements.map((m) => (
                                <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(m.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <Package size={16} className="text-gray-400 mr-2" />
                                            <span className="font-medium text-gray-900">{(m as any).product?.name || 'Desconocido'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center space-x-2">
                                            {getMovementIcon(m.type)}
                                            {getMovementLabel(m.type)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                        {m.type === 'SALE' || m.type === 'TRANSFER' ? '-' : '+'}{m.quantity}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={m.description || ''}>
                                        {m.description || '-'}
                                    </td>
                                </tr>
                            ))}
                            {movements.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                        No hay movimientos registrados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
