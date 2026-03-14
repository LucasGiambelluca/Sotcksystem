import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Package, LogOut, Menu, X, ShoppingCart, MapPin, MessageCircle, Settings, Share2, FileText, ChefHat, ShoppingBag, FlaskConical, Navigation } from 'lucide-react';
import clsx from 'clsx';
import { Toaster, toast } from 'sonner';
import CommandPalette from './CommandPalette';
import { supabase } from '../supabaseClient';
import systemLogo from '../assets/systemlogo.png';
import { getTotalUnreadCount } from '../services/whatsappService';
import NewOrderAlertModal from './NewOrderAlertModal';

export default function Layout() {
  const { signOut } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [waUnread, setWaUnread] = useState(0);

  useEffect(() => {
    getTotalUnreadCount().then(setWaUnread);
    const interval = setInterval(() => {
      getTotalUnreadCount().then(setWaUnread);
    }, 10000); // Refresh every 10s

    // Listen for new Handover requests globally
    const channel = supabase.channel('global-whatsapp-alerts')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations' }, (payload) => {
         const oldRecord = payload.old as any;
         const newRecord = payload.new as any;
         if (newRecord.status === 'HANDOVER' && oldRecord.status !== 'HANDOVER') {
             toast.error(`Atención requerida: ${newRecord.contact_name || newRecord.phone}`, {
                description: 'Un cliente solicitó asistencia humana.',
                duration: 10000,
             });
         }
      })
      .subscribe();

    return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
    };
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    // --- GRUPO 1: Stock y Control de Mercadería ---
    { name: 'Inventario', path: '/products', icon: Package },
    { name: 'Reportes de Stock', path: '/stock-reports', icon: FileText },
    // --- GRUPO 2: Catálogo e Inventario para Venta al Público ---
    { name: 'Catálogo de Ventas', path: '/catalog-admin', icon: ShoppingBag },
    { name: 'Recetas', path: '/recipes', icon: FlaskConical },
    { name: 'Pedidos', path: '/orders', icon: ShoppingCart },
    { name: 'Comandas', path: '/kitchen', icon: ChefHat },
    // --- GRUPO 3: Atención y Logística ---
    { name: 'Clientes', path: '/clients', icon: Users },
    { name: 'Reportes', path: '/claims', icon: MessageCircle },
    { name: 'Rutas', path: '/routes', icon: MapPin },
    { name: 'Despacho', path: '/despacho', icon: Navigation },
    { name: 'Configuración', path: '/settings', icon: Settings },
    { name: 'WhatsApp', path: '/whatsapp', icon: MessageCircle, badge: waUnread },
    { name: 'Grupos', path: '/whatsapp/groups', icon: Users },
    { name: 'Bot Builder', path: '/whatsapp/builder', icon: Share2 },
  ];

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900 overflow-hidden w-full relative">
      {/* Mobile Header */}
      <div className="xl:hidden fixed top-0 left-0 right-0 bg-dark-bg text-white p-4 flex justify-between items-center z-40 shadow-md">
        <div className="flex items-center space-x-2">
          <img src={systemLogo} alt="StockSystem Logo" className="h-8 w-auto" />
          <h1 className="text-xl font-bold tracking-tight">
            Stock<span className="text-primary-500">System</span>
          </h1>
        </div>
        <button onClick={toggleMobileMenu} className="p-2 hover:bg-dark-surface rounded-lg transition-colors focus:outline-none">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 xl:hidden backdrop-blur-sm transition-opacity"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "fixed pl-4 inset-y-0 left-0 z-50 w-72 bg-dark-bg text-white flex flex-col shadow-xl transition-transform duration-300 ease-in-out xl:translate-x-0 xl:static xl:h-screen",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 hidden xl:block">
          <div className="flex items-center space-x-3 mb-2">
            <img src={systemLogo} alt="StockSystem Logo" className="h-10 w-auto" />
            <h1 className="text-2xl font-bold tracking-tight">
              Stock<span className="text-primary-500">System</span>
            </h1>
          </div>
          <p className="text-xs text-gray-400 uppercase tracking-wider pl-1">Panel de Control</p>
        </div>

        <div className="p-6 xl:hidden mt-12 mb-4">
          <div className="flex items-center space-x-3 mb-2">
            <img src={systemLogo} alt="StockSystem Logo" className="h-8 w-auto" />
            <span className="text-xl font-bold text-white tracking-tight">Stock<span className="text-primary-500">System</span></span>
          </div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Menú Principal</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar pb-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeMobileMenu}
                className={clsx(
                  'flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 group',
                  isActive 
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20' 
                    : 'text-gray-400 hover:bg-dark-surface hover:text-white'
                )}
              >
                <Icon size={22} className={clsx(isActive ? 'text-white' : 'text-gray-500 group-hover:text-white')} />
                <span className="font-medium flex-1">{item.name}</span>
                {(item as any).badge > 0 && (
                  <span className="bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {(item as any).badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mx-4 mb-4">
          <button
            onClick={() => {
              signOut();
              closeMobileMenu();
            }}
            className="flex items-center space-x-3 px-4 py-3 w-full text-left text-gray-400 hover:text-red-400 hover:bg-dark-surface rounded-xl transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen bg-gray-50 flex flex-col w-full relative overflow-hidden">
        <div className={clsx(
          "flex-1 flex flex-col w-full overflow-hidden",
          location.pathname.startsWith('/whatsapp') || location.pathname.startsWith('/kitchen') 
            ? "pt-16 xl:pt-0" 
            : "overflow-y-auto pt-16 xl:pt-0"
        )}>
          <div className={location.pathname.startsWith('/whatsapp') || location.pathname.startsWith('/kitchen') 
            ? 'flex-1 flex flex-col overflow-hidden' 
            : 'flex-1 max-w-7xl w-full mx-auto p-4 md:p-6'}>
            <Outlet />
          </div>
        </div>
      </main>
      <NewOrderAlertModal />
      <Toaster position="top-right" richColors />
      <CommandPalette />
    </div>
  );
}
