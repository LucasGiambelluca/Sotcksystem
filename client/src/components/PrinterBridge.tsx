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
      console.log('🖨️ Nuevo trabajo de impresión detectado:', job.id);
      
      const success = await printerService.printToRawBT(job.raw_content);
      
      if (success) {
        await printerService.markAsPrinted(job.id);
        // toast.success('Ticket enviado a RawBT');
      } else {
        toast.error('Fallo al enviar a RawBT. Asegúrate de que la App esté abierta.');
      }
    });

    // Verificar conexión con RawBT cada 30 segundos
    const checkRawBT = async () => {
      try {
        const res = await fetch('http://localhost:40213/status');
        setIsConnected(res.ok);
      } catch (e) {
        setIsConnected(false);
      }
    };

    checkRawBT();
    const interval = setInterval(checkRawBT, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [isActive]);

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
        <div className="flex items-center gap-2 mt-1">
          {isConnected ? (
              <>
                <Wifi size={12} className="text-green-500" />
                <span className="text-[10px] text-green-500 font-bold">RAWBT CONECTADO</span>
              </>
          ) : (
              <>
                <WifiOff size={12} className="text-red-400" />
                <span className="text-[10px] text-red-400 font-bold uppercase">RawBT no detectado</span>
              </>
          )}
        </div>
      )}
      
      <p className="text-[9px] text-gray-400 leading-tight">
        {isActive 
          ? 'Esta tablet imprimirá automáticamente los nuevos pedidos.' 
          : 'La impresión automática está desactivada en este dispositivo.'}
      </p>
    </div>
  );
}
