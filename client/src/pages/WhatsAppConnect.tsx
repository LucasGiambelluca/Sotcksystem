import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSession,
  saveSession,
  getInstanceStatus,
  activateDemoMode,
} from '../services/whatsappService';
import type { WhatsAppSession } from '../types';
import { ArrowLeft, WifiOff, QrCode, RefreshCw, CheckCircle2, Settings, MessageSquare, Save, Unplug } from 'lucide-react';
import { toast } from 'sonner';

const WA_SERVER = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function WhatsAppConnect() {
  const navigate = useNavigate();
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'demo_mode'>('disconnected');
  
  // Config Form
  const [idInstance, setIdInstance] = useState('default');
  const [apiToken, setApiToken] = useState('internal-key');
  const [provider, setProvider] = useState<'INTERNAL' | 'GREEN-API' | 'EVOLUTION'>('INTERNAL');
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // Welcome Message Config
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeActive, setWelcomeActive] = useState(false);
  const [savingWelcome, setSavingWelcome] = useState(false);

  useEffect(() => {
    loadSession();
    loadWelcomeConfig();
  }, []);

  async function loadWelcomeConfig() {
    try {
      const res = await fetch(`${WA_SERVER}/api/config`);
      const data = await res.json();
      if (data) {
        setWelcomeMessage(data.welcome_message || '');
        setWelcomeActive(data.is_active || false);
      }
    } catch {
      // Config not available yet, no problem
    }
  }

  async function saveWelcomeConfig() {
    setSavingWelcome(true);
    try {
      await fetch(`${WA_SERVER}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ welcome_message: welcomeMessage, is_active: welcomeActive }),
      });
      toast.success('Mensaje de bienvenida guardado');
    } catch {
      toast.error('Error guardando configuración');
    }
    setSavingWelcome(false);
  }

  async function loadSession() {
    try {
      setLoading(true);
      const { data } = await getSession();
      if (data) {
        setSession(data);
        setStatus(data.status);
        if (data.instance_name) setIdInstance(data.instance_name);
        if (data.api_key) setApiToken(data.api_key);
        if (data.api_url && !data.api_url.includes('green-api.com')) {
           if (data.api_url.includes('localhost:3001')) {
             setProvider('INTERNAL');
           } else {
             setProvider('EVOLUTION');
             setCustomApiUrl(data.api_url);
           }
        }
        
        // Check status if connected or connecting
        if (data.status === 'connecting' || data.status === 'connected') {
          checkStatus(data.instance_name, data.api_key || '');
        }
      } else {
        setShowConfig(true);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error cargando sesión');
    } finally {
      setLoading(false);
    }
  }

  async function checkStatus(instanceName: string, apiKey: string) {
    if (!instanceName || !apiKey) return;
    try {
      const res = await getInstanceStatus(instanceName, apiKey);
      
      let newStatus = 'disconnected';
      if (res.stateInstance === 'authorized' || res.instance?.state === 'open') {
        newStatus = 'connected';
      }
      
      setStatus(newStatus as any);
      if (session?.status !== newStatus) {
         await saveSession({ status: newStatus as any });
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSaveConfig() {
    setLoading(true);
    try {
      let apiUrl = '';
      if (provider === 'INTERNAL') apiUrl = 'http://localhost:3001';
      else if (provider === 'GREEN-API') apiUrl = 'https://api.green-api.com';
      else apiUrl = customApiUrl.replace(/\/$/, '');
      
      await saveSession({
        instance_name: idInstance,
        api_key: apiToken,
        api_url: apiUrl,
        status: 'disconnected',
      });
      
      toast.success('Configuración guardada');
      setShowConfig(false);
      await loadSession();
    } catch (e) {
      toast.error('Error guardando configuración');
    } finally {
      setLoading(false);
    }
  }



  async function handleLogout() {
    if (!confirm('¿Estás seguro de que deseas desconectar el bot? Deberás escanear el QR nuevamente para conectar.')) return;
    setLoading(true);
    try {
        await fetch(`${WA_SERVER}/api/sessions/logout`, { method: 'POST' });
        await saveSession({ status: 'disconnected', qr_code: null });
        setStatus('disconnected');
        setQrCode(null);
        toast.success('Bot desconectado. Generando QR...');
        // Auto-reconnect to show QR immediately
        setTimeout(() => handleConnectAndPollQR(), 1500);
    } catch (e) {
        console.error(e);
        toast.error('Error al desconectar el bot');
        setLoading(false);
    }
  }

  async function handleConnectAndPollQR() {
    setLoading(true);
    setQrCode(null);
    try {
      // Start the bot process
      await fetch(`${WA_SERVER}/api/sessions/start`, { method: 'POST' });
      toast.info('Esperando QR...');

      // Poll until QR is available (max 20 seconds)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`${WA_SERVER}/api/default/auth/qr`);
          const data = await res.json();
          if (data.qr) {
            clearInterval(poll);
            setQrCode(data.qr);
            setStatus('connecting');
            await saveSession({ status: 'connecting' });
            toast.success('¡QR listo! Escaneá con WhatsApp');
            setLoading(false);
            // Poll for connection
            const connPoll = setInterval(async () => {
              const statusRes = await fetch(`${WA_SERVER}/api/health`);
              const statusData = await statusRes.json();
              if (statusData?.checks?.whatsapp === true || statusData?.status === 'healthy') {
                clearInterval(connPoll);
                setStatus('connected');
                setQrCode(null);
                await saveSession({ status: 'connected' });
                toast.success('¡WhatsApp Conectado!');
              }
            }, 3000);
          } else if (data.status === 'WORKING') {
            clearInterval(poll);
            setStatus('connected');
            setLoading(false);
            toast.info('El bot ya estaba conectado');
          } else if (attempts >= 10) {
            clearInterval(poll);
            setLoading(false);
            toast.error('Timeout esperando QR. Intentá de nuevo.');
          }
        } catch { /* keep polling */ }
      }, 2000);
    } catch (e) {
      console.error(e);
      toast.error('Error al iniciar el bot');
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate('/whatsapp')} className="mr-4 p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold flex-1">Conexión de WhatsApp</h1>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
        >
          <Settings size={24} />
        </button>
      </div>

      {(showConfig || !session) && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6 animate-in slide-in-from-top-4">
          <h2 className="text-lg font-semibold mb-4">Configuración del Proveedor</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="INTERNAL">Servidor Interno (Gratis / Docker)</option>
                <option value="GREEN-API">Green-API (Nube)</option>
                <option value="EVOLUTION">Evolution API (Externo)</option>
              </select>
            </div>

            {provider === 'INTERNAL' && (
               <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                  Usando el servidor WhatsApp incluido en Docker (localhost:3001).
               </div>
            )}

            {provider === 'EVOLUTION' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL de la API</label>
                <input
                  type="text"
                  value={customApiUrl}
                  onChange={(e) => setCustomApiUrl(e.target.value)}
                  placeholder="https://tu-api.onrender.com"
                  className="w-full p-2 border rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">La URL donde desplegaste Evolution API.</p>
              </div>
            )}

            {provider !== 'INTERNAL' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {provider === 'GREEN-API' ? 'IdInstance' : 'Nombre de Instancia'}
                  </label>
                  <input
                    type="text"
                    value={idInstance}
                    onChange={(e) => setIdInstance(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {provider === 'GREEN-API' ? 'ApiTokenInstance' : 'API Key'}
                  </label>
                  <input
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  />
                </div>
              </>
            )}

            <button
              onClick={handleSaveConfig}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Guardar Configuración
            </button>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">O prueba sin configurar</span>
              </div>
            </div>

            <button
               onClick={async () => {
                  setLoading(true);
                  try {
                     await activateDemoMode();
                     toast.success('Modo Demo Activado');
                     await loadSession();
                     setShowConfig(false);
                  } catch(e) { toast.error('Error activando demo'); }
                  setLoading(false);
               }}
               className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
               Activar Modo Demo
            </button>
          </div>
        </div>
      )}

      {session && !showConfig && (
        <div className="bg-white p-8 rounded-lg shadow-md text-center mb-6">
          <div className="mb-6 flex justify-center">
            {status === 'connected' || status === 'demo_mode' ? (
              <div className="bg-green-100 p-4 rounded-full">
                <CheckCircle2 size={48} className="text-green-600" />
              </div>
            ) : (
              <div className="bg-gray-100 p-4 rounded-full">
                <WifiOff size={48} className="text-gray-400" />
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold mb-2">
            {status === 'connected' ? 'WhatsApp Conectado' : 
             status === 'demo_mode' ? 'Modo Demo Activo' :
             status === 'connecting' ? 'Conectando...' : 
             'WhatsApp Desconectado'}
          </h2>
          
          <p className="text-gray-500 mb-8">
            {status === 'connected' ? `Conectado a instancia ${session.instance_name}` :
             status === 'demo_mode' ? 'Simulando conexión. Puedes recibir y enviar mensajes de prueba.' :
             'Escanea el código QR para conectar tu cuenta.'}
          </p>

          {/* Disconnect / Demo button — always visible when session exists */}
          <div className="flex justify-center gap-3 mb-6 flex-wrap">
            {(status === 'connected' || status === 'demo_mode') && (
                <button
                   onClick={handleLogout}
                   disabled={loading}
                   className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                   {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Unplug className="w-4 h-4" />}
                   Desconectar y mostrar QR
                </button>
            )}
            {status === 'disconnected' && !qrCode && (
                <button
                   onClick={handleConnectAndPollQR}
                   disabled={loading}
                   className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                   {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <QrCode className="w-4 h-4" />}
                   {loading ? 'Generando QR...' : 'Conectar y ver QR'}
                </button>
            )}
          </div>

          
          {(status === 'connecting') && qrCode && (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-4 border-2 border-green-400 rounded-xl shadow-lg">
                <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-64 h-64" />
              </div>
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Esperando escaneo...
              </p>
              <button
                onClick={handleConnectAndPollQR}
                disabled={loading}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Regenerar QR
              </button>
            </div>
          )}
          
          {status === 'demo_mode' && (
             <p className="text-xs text-gray-400 mt-4">Para usar WhatsApp real, ve a configuración (engranaje) y conecta Green-API o Evolution.</p>
          )}
        </div>
      )}

      {/* Welcome Message Configuration */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold">Mensaje de Bienvenida</h2>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={welcomeActive}
              onChange={(e) => setWelcomeActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            <span className="ml-2 text-sm font-medium text-gray-700">
              {welcomeActive ? 'Activo' : 'Inactivo'}
            </span>
          </label>
        </div>

        <p className="text-sm text-gray-500 mb-3">
          Este mensaje se envía automáticamente cuando alguien te escribe por primera vez.
        </p>

        <textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          rows={4}
          placeholder="¡Hola {nombre}! 👋 Gracias por escribirnos..."
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400">
            Variables: <code className="bg-gray-100 px-1 rounded">{'{nombre}'}</code> <code className="bg-gray-100 px-1 rounded">{'{telefono}'}</code>
          </p>
          <button
            onClick={saveWelcomeConfig}
            disabled={savingWelcome}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            {savingWelcome ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
