import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SoundProvider } from './context/SoundContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Clients from './pages/Clients';
import Products from './pages/Products';
import ClientDetails from './pages/ClientDetails';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import RoutesPage from './pages/Routes';
import RoutePlanner from './pages/RoutePlanner';
import RouteDetails from './pages/RouteDetails';
import NewOrder from './pages/NewOrder';
import OrderDetails from './pages/OrderDetails';
import WhatsAppInbox from './pages/WhatsAppInbox';
import WhatsAppConnect from './pages/WhatsAppConnect';
import WhatsAppGroups from './pages/WhatsAppGroups';
import BotBuilder from './pages/BotBuilder';
import Settings from './pages/Settings';
import KitchenDashboard from './pages/KitchenDashboard';
import DriverView from './pages/DriverView';
import ClaimsPanel from './pages/ClaimsPanel';
import Catalog from './pages/Catalog';
import PricingPresentation from './pages/PricingPresentation';
import StockReports from './pages/StockReports';
import CatalogAdmin from './pages/CatalogAdmin';
import Recipes from './pages/Recipes';
import CadetePWA from './pages/CadetePWA';
import Dispatcher from './pages/Dispatcher';
import TabletOrdering from './pages/TabletOrdering';

function App() {
  return (
    <BrowserRouter basename="/elpollocomilon">
      <AuthProvider>
        <SoundProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/driver/:id" element={<DriverView />} />
            <Route path="/cadete" element={<CadetePWA />} />
            <Route path="/catalog" element={<Catalog />} />
            
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/:id" element={<ClientDetails />} />
                <Route path="/products" element={<Products />} />
                <Route path="/stock-reports" element={<StockReports />} />
                <Route path="/catalog-admin" element={<CatalogAdmin />} />
                <Route path="/recipes" element={<Recipes />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/claims" element={<ClaimsPanel />} />
                <Route path="/kitchen" element={<KitchenDashboard />} />
                <Route path="/orders/new" element={<NewOrder />} />
                <Route path="/orders/:id" element={<OrderDetails />} />
                <Route path="/routes" element={<RoutesPage />} />
                <Route path="/routes/:id/planner" element={<RoutePlanner />} />
                <Route path="/routes/:id" element={<RouteDetails />} />
                <Route path="/whatsapp" element={<WhatsAppInbox />} />
                <Route path="/whatsapp/connect" element={<WhatsAppConnect />} />
                <Route path="/whatsapp/groups" element={<WhatsAppGroups />} />
                <Route path="/whatsapp/builder" element={<BotBuilder />} />
                <Route path="/despacho" element={<Dispatcher />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/admin/pricing-demo" element={<PricingPresentation />} />
              </Route>
              <Route path="/tablet-ordering" element={<TabletOrdering />} />
            </Route>
          </Routes>
        </SoundProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
