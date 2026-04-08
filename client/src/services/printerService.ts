import { supabase } from '../supabaseClient';

export const printerService = {
  /**
   * Envía un ticket a la App RawBT (Android)
   * @param base64Content Contenido del ticket en Base64 (comandos ESC/POS)
   */
  async printToRawBT(base64Content: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Intentamos con 127.0.0.1 que es mas directo que localhost en Android
      const trySocket = (url: string) => {
        try {
          const socket = new WebSocket(url);
          let timeout = setTimeout(() => {
            socket.close();
            if (url.includes('127.0.0.1')) {
              trySocket('ws://localhost:40213'); // Reintento con localhost
            } else {
              // Si ambos fallan, fallback al intent ruidoso
              window.location.href = `rawbt:base64,${base64Content}`;
              resolve(true);
            }
          }, 1500);

          socket.onopen = () => {
            clearTimeout(timeout);
            const binaryString = window.atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            socket.send(bytes);
            setTimeout(() => { socket.close(); resolve(true); }, 500);
          };

          socket.onerror = () => {
            clearTimeout(timeout);
            if (url.includes('127.0.0.1')) {
              trySocket('ws://localhost:40213');
            } else {
              window.location.href = `rawbt:base64,${base64Content}`;
              resolve(true);
            }
          };
        } catch (e) {
          resolve(false);
        }
      };

      trySocket('ws://127.0.0.1:40213');
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
