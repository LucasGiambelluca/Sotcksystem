// src/services/ShortcutsManager.ts

import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { ConfigurationService } from './ConfigurationService';

export class ShortcutsManager {
  /**
   * Procesa IDs de botones globales que no pertenecen a un nodo específico.
   * Retorna una lista de mensajes si el ID fue manejado, o null si no.
   */
  static async handle(id: string, phone: string): Promise<any[] | null> {
    const rawId = id || '';
    // Strip markdown wrappers (*hola*, _hola_) only at the edges: inner underscores
    // are significant (button IDs like rate_5, order_issue). Then accents + lowercase.
    const normalizedId = rawId.replace(/^[\*_]+|[\*_]+$/g, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    console.log(`\x1b[35m[ShortcutsManager] Handling shortcut: RAW="${rawId}" NORMALIZED="${normalizedId}" for ${phone}\x1b[0m`);
    logger.info(`[ShortcutsManager] Handling shortcut: RAW="${rawId}" NORMALIZED="${normalizedId}" for ${phone}`);

    switch (normalizedId) {
      case 'view_order':
        return await this.getViewOrderResponse(phone);
      
      case 'track_order':
      case 'how_much_longer':
      case 'call_courier':
        // Estos botones ya no se muestran, pero si quedaran mensajes viejos:
        return [
          "🛵 *Estado del Envío*\n\nTu pedido ya está en manos del repartidor. ¡Llegará muy pronto! 🎉"
        ];
      case 'help':
      case 'support':
      case 'atencion-humana':
      case 'atencion_humano':
      case 'atencion humano':
      case 'asesor':
      case 'soporte':
      case 'consulta':
        // Activar Handover Humano
        await this.triggerHandover(phone);
        return [
          `🤝 *Asistencia humana solicitada*\n\nHe pausado mis respuestas automáticas. Un asesor de nuestro equipo se comunicará con vos por este mismo chat a la brevedad. ¡Gracias por tu paciencia! ⏳`
        ];

      case 'rate_5':
      case 'rate_excellent':
        await this.saveRating(phone, 5);
        return [
          "🎉 ¡Muchas gracias por elegirnos y por tu calificación! Nos encanta saber que disfrutaste tu pedido. ¡Te esperamos pronto! 😊🙌"
        ];

      case 'rate_4':
      case 'rate_3':
      case 'rate_2':
      case 'rate_1':
      case 'rate_good':
        await this.saveRating(phone, normalizedId === 'rate_good' ? 4 : parseInt(normalizedId.split('_')[1], 10));
        return [
          "🙏 ¡Gracias por elegirnos! Tomamos nota de tu feedback para seguir mejorando. ¡Te esperamos pronto! 😊"
        ];

      case 'order_issue':
        // Generate a report (log to DB)
        await this.reportIssue(phone);
        return [
          "❌ Lamentamos el inconveniente, pronto nos comunicaremos con vos para solucionarlo."
        ];

      default:
        return null;
    }
  }

  private static async saveRating(phone: string, rating: number): Promise<void> {
    try {
      // Vincular al último pedido del cliente (si existe)
      const { data: order } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase.from('order_ratings').insert({
        phone,
        order_id: order?.id || null,
        order_number: order?.order_number || null,
        rating,
        source: 'whatsapp_button',
        created_at: new Date().toISOString()
      });

      if (error) {
        logger.error(`[ShortcutsManager] Error saving rating: ${error.message}`);
      } else {
        logger.info(`[ShortcutsManager] Rating ${rating}⭐ saved for ${phone} (Order: ${order?.order_number || 'None'})`);
      }
    } catch (e: any) {
      logger.error(`[ShortcutsManager] Error saving rating: ${e.message}`);
    }
  }

  private static async notifyTeam(title: string, message: string, type: string, metadata: any = {}): Promise<void> {
    try {
      await supabase.from('notifications').insert({
        title,
        message,
        type,
        metadata,
        read: false
      });
    } catch (e: any) {
      logger.error(`[ShortcutsManager] Error creating internal notification: ${e.message}`);
    }
  }

  private static async triggerHandover(phone: string): Promise<void> {
    try {
      logger.info(`[ShortcutsManager] Triggering human handover for ${phone}`);

      // 1. Pausar ejecuciones automáticas activas
      await supabase.from('flow_executions')
        .update({ status: 'HANDOVER', paused_at: new Date().toISOString() })
        .eq('phone', phone)
        .eq('status', 'active');

      // 2. Marcar conversación para atención humana
      await supabase.from('whatsapp_conversations')
        .update({ status: 'HANDOVER', updated_at: new Date().toISOString() })
        .eq('phone', phone);

      // 3. Avisar al equipo: sin esto el cliente queda esperando un asesor que nadie sabe que debe atender
      await this.notifyTeam(
        '📞 Soporte solicitado',
        `El cliente ${phone} pidió hablar con un asesor por WhatsApp. El bot quedó pausado para ese chat.`,
        'SUPPORT_REQUEST',
        { phone }
      );

    } catch (e: any) {
      logger.error(`[ShortcutsManager] Error triggering handover: ${e.message}`);
    }
  }

  private static async reportIssue(phone: string): Promise<void> {
    try {
      // Intentar vincular el problema al último pedido
      const { data: order } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const issueData = {
        phone,
        order_id: order?.id || null,
        order_number: order?.order_number || null,
        issue_type: 'customer_reported_via_whatsapp',
        description: 'El cliente reportó un problema con su pedido presionando el botón de soporte.',
        status: 'pending',
        created_at: new Date().toISOString()
      };

      // Si existe una tabla de incidentes/tickets, lo guardamos. 
      // Si no, lo guardamos como una nota en el pedido o en flow_logs.
      const { error } = await supabase.from('customer_issues').insert(issueData);
      
      if (error) {
        // Fallback: si la tabla no existe u otro fallo, dejar rastro como nota del pedido
        logger.error(`[ShortcutsManager] Error inserting customer_issue: ${error.message}`);
        if (order?.id) {
           await supabase.from('orders').update({
             notes: `[SOPORTE] ${issueData.description}`
           }).eq('id', order.id);
        }
      }

      // Avisar al equipo para que alguien lo contacte
      await this.notifyTeam(
        '⚠️ Problema con un pedido',
        `El cliente ${phone} reportó un problema con su pedido ${order?.order_number ? `#${order.order_number}` : ''} desde WhatsApp.`,
        'ORDER_ISSUE',
        { phone, orderId: order?.id || null, orderNumber: order?.order_number || null }
      );

      logger.info(`[ShortcutsManager] Issue reported for ${phone} (Order: ${order?.order_number || 'None'})`);
    } catch (e: any) {
      logger.error(`[ShortcutsManager] Error reporting issue: ${e.message}`);
    }
  }

  private static async getViewOrderResponse(phone: string): Promise<any[]> {
    try {
      // Buscar el último pedido de este teléfono
      const { data: order, error } = await supabase
        .from('orders')
        .select('order_number, status, total, delivery_address')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !order) {
        return ["🔎 No encontré pedidos recientes asociados a este número."];
      }

      const statusMap: Record<string, string> = {
        'PENDING': 'Recibido 📝',
        'CONFIRMED': 'Confirmado ✅',
        'IN_PREPARATION': 'En cocina 👨‍🍳',
        'IN_TRANSIT': 'En camino 🛵',
        'OUT_FOR_DELIVERY': 'En camino 🛵',
        'READY': 'Listo para retirar 🥡',
        'READY_FOR_PICKUP': 'Listo para retirar 🥡',
        'DELIVERED': 'Entregado 🎉',
        'CANCELLED': 'Cancelado ❌'
      };

      const statusLabel = statusMap[order.status.toUpperCase()] || order.status;
      
      return [
        `📄 *Estado de tu Pedido*\n\n` +
        `🆔 *Orden:* #${order.order_number}\n` +
        `📊 *Estado:* ${statusLabel}\n` +
        `💰 *Total:* $${order.total}\n` +
        `📍 *Destino:* ${order.delivery_address || 'Retiro en Local'}\n\n` +
        `_Te avisaremos ante cualquier novedad._`
      ];
    } catch (e) {
      return ["⚠️ Error al consultar el pedido. Intenta de nuevo en unos minutos."];
    }
  }
}
