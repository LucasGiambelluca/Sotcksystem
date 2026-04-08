import { supabase } from '../supabaseClient';

export const printerService = {
  /**
   * Envía un ticket a la App RawBT (Android)
   * @param base64Content Contenido del ticket en Base64 (comandos ESC/POS)
   */
  async printToRawBT(base64Content: string): Promise<boolean> {
    try {
      const RAWBT_URL = 'http://localhost:40213/print';
      
      // Convertimos el base64 de vuelta a un Array de bytes (binario)
      const binaryString = window.atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Enviamos CUALQUIER dato binario directo al cuerpo de la petición
      const response = await fetch(RAWBT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: bytes
      });

      if (response.ok) {
        return true;
      }
      
      console.warn('Fallo el fetch binario, probando con esquema rawbt:');
      window.location.href = `rawbt:base64,${base64Content}`; // Usamos coma que es mas estandar en intents
      return true;
    } catch (error) {
      console.error('Error enviando a RawBT:', error);
      // Fallback final
      window.location.href = `rawbt:base64:${base64Content}`;
      return true;
    }
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
