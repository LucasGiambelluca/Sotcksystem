import { supabase } from '../supabaseClient';

export const printerService = {
  /**
   * Verifica si el servidor de RawBT está activo en el dispositivo local.
   * Intenta conectarse al puerto por defecto de RawBT (40213).
   */
  async checkRawBT(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new WebSocket('ws://127.0.0.1:40213');
      const timeout = setTimeout(() => {
        socket.close();
        resolve(false);
      }, 1000);

      socket.onopen = () => {
        clearTimeout(timeout);
        socket.close();
        resolve(true);
      };

      socket.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    });
  },

  /**
   * Envía un ticket a la App RawBT (Android)
   * @param base64Content Contenido del ticket en Base64 (comandos ESC/POS)
   */
  async printToRawBT(base64Content: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Intentamos primero por WebSocket (Silencioso y óptimo)
      const socket = new WebSocket('ws://127.0.0.1:40213');
      
      const timeout = setTimeout(() => {
        socket.close();
        // Fallback: Si no hay WebSocket, intentamos por Intent (abre la app RawBT)
        console.warn('RawBT WebSocket timeout. Falling back to Intent URL.');
        window.location.href = `rawbt:base64,${base64Content}`;
        resolve(true);
      }, 1500);

      socket.onopen = () => {
        clearTimeout(timeout);
        try {
          const binaryString = window.atob(base64Content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          socket.send(bytes);
          setTimeout(() => {
            socket.close();
            resolve(true);
          }, 500);
        } catch (e) {
          console.error('Error sending bytes to RawBT:', e);
          socket.close();
          resolve(false);
        }
      };

      socket.onerror = () => {
        clearTimeout(timeout);
        // Fallback al intent ruidoso
        window.location.href = `rawbt:base64,${base64Content}`;
        resolve(true);
      };
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
   * Marca un trabajo como impreso o fallido en la base de datos
   */
  async updateJobStatus(jobId: string, status: 'printed' | 'failed', errorMessage?: string) {
    const updateData: any = { 
      status, 
      printed_at: status === 'printed' ? new Date().toISOString() : null 
    };
    
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    await supabase
      .from('print_queue')
      .update(updateData)
      .eq('id', jobId);
  }
};
