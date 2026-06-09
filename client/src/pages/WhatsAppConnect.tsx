import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSession,
  saveSession,
  getInstanceStatus,
  activateDemoMode,
} from '../services/whatsappService';
import type { WhatsAppSession } from '../types';
import { ArrowLeft, WifiOff, QrCode, RefreshCw, CheckCircle2, Settings, MessageSquare, Save, Unplug, Cloud, Eye, EyeOff, Zap } from 'lucide-react';
import { toast } from 'sonner';

const WA_SERVER = import.meta.env.VITE_API_URL || 'http://localhost:3001';
// Tenant API base for our own backend. Bare /api/... URLs fall through Caddy's
// default route to the primary tenant — meta-config reads/writes would then hit
// the OTHER business's WhatsApp credentials.
const API_BASE = import.meta.env.VITE_API_URL || '';

// ngrok free tier shows a browser warning page - this header bypasses it
const waFetch = (url: string, options: RequestInit = {}) => fetch(url, {
  ...options,
  headers: {
    'ngrok-skip-browser-warning': 'true',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  },
});

export default function WhatsAppConnect() {
  const navigate = useNavigate();
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'demo_mode'>('disconnected');
  
  // Config Form
  const [idInstance, setIdInstance] = useState('default');
  const [apiToken, setApiToken] = useState('internal-key');
  const [provider, setProvider] = useState<'INTERNAL' | 'GREEN-API' | 'EVOLUTION' | 'META_OFFICIAL'>('INTERNAL');
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // Meta API Official fields
  const [metaCloudToken, setMetaCloudToken] = useState('');
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [metaVerifyToken, setMetaVerifyToken] = useState('SotckSystemToken2026');
  const [metaTokenPreview, setMetaTokenPreview] = useState('');
  const [metaConfigured, setMetaConfigured] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testingMeta, setTestingMeta] = useState(false);
  const [metaTestResult, setMetaTestResult] = useState<{valid: boolean; phone?: string; error?: string} | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);

  // Welcome Message Config
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeActive, setWelcomeActive] = useState(false);
  const [savingWelcome, setSavingWelcome] = useState(false);
  
  // Embedded Signup
  const [isSigningUp, setIsSigningUp] = useState(false);

  useEffect(() => {
    loadSession();
    loadWelcomeConfig();
    loadMetaConfig();
    initFacebookSdk();
  }, []);

  function initFacebookSdk() {
    // @ts-ignore
    window.fbAsyncInit = function() {
      // @ts-ignore
      FB.init({
        appId: import.meta.env.VITE_META_APP_ID || '', // Needs to be in .env
        cookie: true,
        xfbml: true,
        version: 'v21.0'
      });
    };

    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      // @ts-ignore
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      // @ts-ignore
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
  }

  async function launchEmbeddedSignup() {
    const appId = import.meta.env.VITE_META_APP_ID;
    const configId = import.meta.env.VITE_META_CONFIG_ID;
    
    if (!appId || !configId) {
      toast.error('Falta configurar VITE_META_APP_ID o VITE_META_CONFIG_ID en el .env del cliente');
      return;
    }

    // @ts-ignore
    if (!window.FB) {
      toast.error('SDK de Facebook no cargado. Reintentando...');
      initFacebookSdk();
      return;
    }

    setIsSigningUp(true);
    try {
      // @ts-ignore
      FB.login((response) => {
        if (response.authResponse) {
          const code = response.authResponse.code;
          handleMetaSignupCallback(code);
        } else {
          toast.error('Cancelaste el inicio de sesión con Facebook o hubo un error.');
          setIsSigningUp(false);
        }
      }, {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          sessionInfoVersion: '3',
        }
      });
    } catch (e) {
      toast.error('Ocurrió un error al abrir el popup de Facebook.');
      setIsSigningUp(false);
    }
  }

  async function handleMetaSignupCallback(code: string) {
    try {
      // Note: In some SDK versions, WABA and Phone ID are returned in the response object
      // under a special 'extras' field if using Embedded Signup.
      // If not, the backend can discover them via GET /me/whatsapp_business_accounts
      
      const res = await fetch(`${API_BASE}/api/embedded-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code, 
          waba_id: 'auto', // Backend will try to discover if not provided
          phone_number_id: 'auto' 
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`✅ ¡Conectado con éxito! Número: ${data.phone}`);
        setMetaConfigured(true);
        loadSession(); // Reload session to show connected status
      } else {
        toast.error(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      toast.error('Falló la conexión con el servidor');
    } finally {
      setIsSigningUp(false);
    }
  }

  async function loadWelcomeConfig() {
    try {
      const res = await waFetch(`${WA_SERVER}/api/config`);
      const data = await res.json();
      if (data) {
        setWelcomeMessage(data.welcome_message || '');
        setWelcomeActive(data.is_active || false);
      }
    } catch {
      // Config not available yet, no problem
    }
  }

  async function loadMetaConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/meta-config`);
      const data = await res.json();
      if (data) {
        setMetaConfigured(data.configured);
        setMetaPhoneNumberId(data.phone_number_id || '');
        setMetaVerifyToken(data.verify_token || 'SotckSystemToken2026');
        setMetaTokenPreview(data.token_preview || '');
      }
    } catch {
      // Config not loaded yet
    }
  }

  async function handleTestMeta() {
    if (!metaCloudToken || !metaPhoneNumberId) {
      toast.error('Completá Cloud Token y Phone Number ID');
      return;
    }
    setTestingMeta(true);
    setMetaTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/meta-config/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloud_token: metaCloudToken, phone_number_id: metaPhoneNumberId }),
      });
      const result = await res.json();
      setMetaTestResult(result);
      if (result.valid) {
        toast.success(`✅ Credenciales válidas — ${result.phone}`);
      } else {
        toast.error(`❌ ${result.error}`);
      }
    } catch {
      toast.error('Error al probar credenciales');
    }
    setTestingMeta(false);
  }

  async function handleSaveMeta() {
    if (!metaCloudToken || !metaPhoneNumberId) {
      toast.error('Completá Cloud Token y Phone Number ID');
      return;
    }
    setSavingMeta(true);
    try {
      const res = await fetch(`${API_BASE}/api/meta-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloud_token: metaCloudToken,
          phone_number_id: metaPhoneNumberId,
          verify_token: metaVerifyToken,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Credenciales de Meta guardadas');
        setMetaConfigured(true);
        setMetaTokenPreview(metaCloudToken.substring(0, 10) + '...');
      } else {
        toast.error(data.error || 'Error guardando');
      }
    } catch {
      toast.error('Error guardando credenciales');
    }
    setSavingMeta(false);
  }

  async function saveWelcomeConfig() {
    setSavingWelcome(true);
    try {
      await waFetch(`${WA_SERVER}/api/config`, {
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
        await waFetch(`${WA_SERVER}/api/sessions/logout`, { method: 'POST' });
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
      await waFetch(`${WA_SERVER}/api/sessions/start`, { method: 'POST' });
      toast.info('Esperando QR...');

      // Poll until QR is available (max 20 seconds)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const res = await waFetch(`${WA_SERVER}/api/default/auth/qr`);
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
              const statusRes = await waFetch(`${WA_SERVER}/api/health`);
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
                <option value="INTERNAL">Servidor Interno (QR / Baileys)</option>
                <option value="META_OFFICIAL">📱 Meta API Oficial (Cloud)</option>
                <option value="GREEN-API">Green-API (Nube)</option>
                <option value="EVOLUTION">Evolution API (Externo)</option>
              </select>
            </div>

            {provider === 'INTERNAL' && (
               <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                  Usando el servidor WhatsApp incluido en Docker (localhost:3001).
               </div>
            )}

            {provider === 'META_OFFICIAL' && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Cloud className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-800">WhatsApp Cloud API (Meta)</span>
                  </div>
                  <p className="text-xs text-blue-600">
                    Conectá directamente con la API oficial de Meta. Necesitás una app en{' '}
                    <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="underline font-medium">Meta for Developers</a>.
                  </p>
                  {metaConfigured && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 p-2 rounded">
                      <CheckCircle2 className="w-4 h-4" />
                      Configurado — {metaTokenPreview}
                    </div>
                  )}
                  
                  <button
                    onClick={launchEmbeddedSignup}
                    disabled={isSigningUp}
                    className="mt-3 w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-lg font-bold shadow-sm transition-all animate-pulse-slow"
                  >
                    {isSigningUp ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Zap className="w-5 h-5 fill-current" />
                    )}
                    {isSigningUp ? 'Conectando...' : 'Vincular con Facebook (Recomendado)'}
                  </button>
                  <p className="text-[10px] text-blue-500 mt-2 text-center">
                    Flujo oficial rápido y seguro • No requiere tokens manuales
                  </p>
                </div>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-gray-400">
                    <span className="px-2 bg-white">O Configuración Manual</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cloud Token (Access Token)</label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={metaCloudToken}
                      onChange={(e) => { setMetaCloudToken(e.target.value); setMetaTestResult(null); }}
                      placeholder={metaTokenPreview ? `Actual: ${metaTokenPreview}` : 'EAAxxxxxxx...'}
                      className="w-full p-2 pr-10 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Meta for Developers → Tu App → WhatsApp → API Configuration</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
                  <input
                    type="text"
                    value={metaPhoneNumberId}
                    onChange={(e) => { setMetaPhoneNumberId(e.target.value); setMetaTestResult(null); }}
                    placeholder="123456789012345"
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">ID del número de teléfono registrado en Meta Business Suite</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verify Token (para Webhooks)</label>
                  <input
                    type="text"
                    value={metaVerifyToken}
                    onChange={(e) => setMetaVerifyToken(e.target.value)}
                    placeholder="SotckSystemToken2026"
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">Token que usás en Meta → Webhooks → Verify Token</p>
                </div>

                {metaTestResult && (
                  <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                    metaTestResult.valid 
                      ? 'bg-green-50 text-green-800 border border-green-200' 
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {metaTestResult.valid ? (
                      <><CheckCircle2 className="w-4 h-4 text-green-600" /> Conexión exitosa — Número: {metaTestResult.phone}</>
                    ) : (
                      <><WifiOff className="w-4 h-4 text-red-600" /> Error: {metaTestResult.error}</>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleTestMeta}
                    disabled={testingMeta || !metaCloudToken || !metaPhoneNumberId}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    {testingMeta ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {testingMeta ? 'Probando...' : 'Probar Conexión'}
                  </button>
                  <button
                    onClick={handleSaveMeta}
                    disabled={savingMeta || !metaCloudToken || !metaPhoneNumberId}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    {savingMeta ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingMeta ? 'Guardando...' : 'Guardar Credenciales'}
                  </button>
                </div>
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

            {(provider === 'GREEN-API' || provider === 'EVOLUTION') && (
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
