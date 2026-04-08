import { supabase } from '../supabaseClient';

export const printerService = {
  /**
   * Envía un ticket a la App RawBT (Android)
   * @param base64Content Contenido del ticket en Base64 (comandos ESC/POS)
   */
  async printToRawBT(base64Content: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const WS_URL = 'ws://localhost:40213';
        const socket = new WebSocket(WS_URL);

        socket.onopen = () => {
          console.log('📡 Conectado a RawBT via WebSocket');
          // Convertimos a binario
          const binaryString = window.atob(base64Content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          // Enviamos los bytes directamente
          socket.send(bytes);
          
          // Cerramos despues de un pequeño delay
          setTimeout(() => {
            socket.close();
            resolve(true);
          }, 500);
        };

        socket.onerror = (error) => {
          console.error('❌ Error de WebSocket con RawBT:', error);
          // Fallback al metodo antiguo si el socket falla
          window.location.href = `rawbt:base64,${base64Content}`;
          resolve(true);
        };
      } catch (e) {
        resolve(false);
      }
    });
  },

  /**
   * Suscribe al Panel a la cola de impresión de Supabase
   */
  subscribeToPrintQueue(onNewJob: (job: any) => void) {
    return supabase
      .channel('global-print-queue')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'print_queue' },
        (payload) => {
          if (payload.new.status === 'pending') {
            onNewJob(payload.new);
          }
        }
      )
      .subscribe();
  },

  /**
   * Marca un trabajo como impreso en la base de datos
   */
  async markAsPrinted(jobId: string) {
    await supabase
      .from('print_queue')
      .update({ 
        status: 'printed', 
        printed_at: new Date().toISOString() 
      })
      .eq('id', jobId);
  }
};
