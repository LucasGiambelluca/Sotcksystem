import { History, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'DEBT' | 'PAYMENT';
  amount: number;
  description: string | null;
  created_at: string;
}

interface RecentActivityProps {
  activities: ActivityItem[];
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-orange-50 p-2 rounded-lg">
          <History className="text-orange-600" size={24} />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Actividad Reciente</h2>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${
                activity.type === 'DEBT' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}>
                {activity.type === 'DEBT' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {activity.type === 'DEBT' ? 'Nueva Venta' : 'Pago Recibido'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(activity.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${
                activity.type === 'DEBT' ? 'text-red-600' : 'text-green-600'
              }`}>
                {activity.type === 'DEBT' ? '+' : '-'}${activity.amount.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 max-w-[100px] truncate">
                {activity.description || '-'}
              </p>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <p className="text-center text-gray-400 py-4">No hay actividad reciente</p>
        )}
      </div>
    </div>
  );
}
