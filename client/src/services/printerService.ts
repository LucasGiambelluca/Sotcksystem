import { supabase } from '../supabaseClient';

export const printerService = {
  /**
   * Envía un ticket a la App RawBT (Android)
   * @param base64Content Contenido del ticket en Base64 (comandos ESC/POS)
   */
  async printToRawBT(base64Content: string): Promise<boolean> {
    try {
      // RawBT por defecto escucha en el puerto 40213 para peticiones HTTP
      const RAWBT_URL = 'http://localhost:40213/print';
      
      const response = await fetch(RAWBT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: base64Content,
          type: 'base64'
        })
      });

      if (response.ok) {
        return true;
      }
      
      // Si falla el fetch directo (por Mixed Content), probamos con el Intent URL (fallback)
      console.warn('Fallo el fetch directo a RawBT, intentando via Intent URL...');
      window.location.href = `rawbt:base64:${base64Content}`;
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
