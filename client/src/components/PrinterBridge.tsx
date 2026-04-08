import { useState, useEffect } from 'react';
import { printerService } from '../services/printerService';
import { Printer, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

export default function PrinterBridge() {
  const [isActive, setIsActive] = useState(() => {
    return localStorage.getItem('printer_bridge_active') === 'true';
  });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    localStorage.setItem('printer_bridge_active', isActive.toString());
    
    if (!isActive) return;

    // Suscribirse a la cola de impresión
    const subscription = printerService.subscribeToPrintQueue(async (job) => {
      console.log('🖨️ Nuevo trabajo detectado:', job.id);
      
      try {
        await printerService.printToRawBT(job.raw_content);
        await printerService.markAsPrinted(job.id);
      } catch (err) {
        console.error('Error en el puente:', err);
      }
    });

    const checkRawBT = async () => {
      try {
        const WS_URL = 'ws://localhost:40213';
        const socket = new WebSocket(WS_URL);
        
        socket.onopen = () => {
          setIsConnected(true);
          socket.close();
        };
        
        socket.onerror = () => {
          setIsConnected(false);
        };
      } catch (e) {
        setIsConnected(false);
      }
    };

    checkRawBT();
    const interval = setInterval(checkRawBT, 10000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [isActive]);

  const testConnection = async () => {
    // Comando ESC/POS para un "Beep" (si la impresora lo soporta) o un pequeño avance
    const testBytes = new Uint8Array([0x1B, 0x40, 0x1B, 0x64, 0x02]); 
    const success = await printerService.printToRawBT(window.btoa(String.fromCharCode(...testBytes)));
    if (success) {
      toast.success('Conexión probada. Si no salió cartel, ¡está OK!');
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-dark-bg/50 rounded-xl border border-white/5 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Printer size={18} className={isActive ? 'text-primary-500' : 'text-gray-500'} />
          <span className="text-xs font-bold uppercase tracking-wider">Modo Impresora</span>
        </div>
        <button
          onClick={() => setIsActive(!isActive)}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
            isActive ? 'bg-primary-600' : 'bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              isActive ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      
      {isActive && (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2">
            {isConnected ? (
                <>
                  <Wifi size={12} className="text-green-500" />
                  <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">Directo (Sin Carteles)</span>
                </>
            ) : (
                <>
                  <WifiOff size={12} className="text-red-400" />
                  <span className="text-[10px] text-red-400 font-bold uppercase tracking-tighter">Vía App (Con Carteles)</span>
                </>
            )}
          </div>
          <button 
            onClick={testConnection}
            className="text-[10px] bg-white/5 hover:bg-white/10 text-gray-300 py-1 rounded border border-white/10 transition-colors uppercase font-bold"
          >
            Probar Conexión
          </button>
        </div>
      )}
      
      <p className="text-[9px] text-gray-400 leading-tight">
        {isActive 
          ? 'Impresión automática activa.' 
          : 'Impresión desactivada.'}
      </p>
    </div>
  );
}
