// Supabase Edge Function: whatsapp-webhook
// Receives incoming messages from Green-API AND Evolution API
// Deploy: supabase functions deploy whatsapp-webhook --no-verify-jwt

import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log('Webhook received:', JSON.stringify(payload).slice(0, 500))

    // ===================================
    // GREEN-API HANDLING
    // ===================================
    if (payload.typeWebhook) {
      const typeWebhook = payload.typeWebhook

      if (typeWebhook === 'incomingMessageReceived') {
        const { senderData, messageData, idMessage, timestamp } = payload

        if (senderData?.sender === payload.instanceData?.wid) {
           return new Response(JSON.stringify({ ok: true, skipped: 'fromMe' }), { headers: corsHeaders })
        }

        const remoteJid = senderData?.sender || ''
        const phone = remoteJid.replace('@c.us', '')

        let content = ''
        let messageType = 'text'

        if (messageData?.typeMessage === 'textMessage') {
          content = messageData.textMessageData?.textMessage || ''
        } else if (messageData?.typeMessage === 'extendedTextMessage') {
          content = messageData.extendedTextMessageData?.text || ''
        } else if (messageData?.typeMessage === 'imageMessage') {
          content = messageData.imageMessageData?.caption || '[Imagen]'
          messageType = 'image'
        } else {
          content = `[${messageData?.typeMessage}]`
        }

        await saveMessage(supabase, phone, senderData?.senderName, content, messageType, idMessage, timestamp)
        return new Response(JSON.stringify({ ok: true, phone }), { headers: corsHeaders })
      } 
      
      if (typeWebhook === 'stateInstanceChanged') {
        const status = payload.stateInstance === 'authorized' ? 'connected' : 'disconnected'
        await supabase.from('whatsapp_sessions').update({ status, updated_at: new Date().toISOString() })
          .eq('instance_name', payload.instanceData?.idInstance?.toString())
        return new Response(JSON.stringify({ ok: true, status }), { headers: corsHeaders })
      }
    }

    // ===================================
    // EVOLUTION API HANDLING
    // ===================================
    const eventType = payload.event || payload.type
    if (eventType) {
      if (eventType === 'messages.upsert' || eventType === 'MESSAGE_UPSERT') {
        const data = payload.data
        const message = data.messages?.[0] || data
        
        if (!message || message.key.fromMe) {
           return new Response(JSON.stringify({ ok: true, skipped: 'fromMe' }), { headers: corsHeaders })
        }

        const remoteJid = message.key.remoteJid || ''
        const phone = remoteJid.replace('@s.whatsapp.net', '') // Evolution format

        let content = ''
        const msgContent = message.message
        
        if (msgContent?.conversation) content = msgContent.conversation
        else if (msgContent?.extendedTextMessage?.text) content = msgContent.extendedTextMessage.text
        else if (msgContent?.imageMessage) content = msgContent.imageMessage.caption || '[Imagen]'
        else content = '[Mensaje Nuevo]'

        const pushName = message.pushName || phone
        const timestamp = message.messageTimestamp || Date.now() / 1000

        await saveMessage(supabase, phone, pushName, content, 'text', message.key.id, timestamp)
        return new Response(JSON.stringify({ ok: true, phone }), { headers: corsHeaders })
      } else if (eventType === 'connection.update' || eventType === 'CONNECTION_UPDATE') {
         // Handle connection update...
         // Usually check data.state === 'open'
         // For now simple OK
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })

  } catch (err: any) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})

async function saveMessage(supabase: any, phone: string, pushName: string, content: string, messageType: string, idMessage: string, timestamp: number) {
  // Get or create conversation
  let { data: conversation } = await supabase
    .from('whatsapp_conversations')
    .select('id, unread_count')
    .eq('phone', phone)
    .single()

  if (!conversation) {
     const { data: client } = await supabase.from('clients').select('id').or(`phone.ilike.%${phone.slice(-8)}%`).limit(1).single()
     const { data: newConvo } = await supabase.from('whatsapp_conversations').insert({
        phone,
        contact_name: pushName || phone,
        client_id: client?.id || null,
        last_message: content,
        last_message_at: new Date(timestamp * 1000).toISOString(),
        unread_count: 1
     }).select().single()
     conversation = newConvo
  } else {
     await supabase.from('whatsapp_conversations').update({
        last_message: content,
        last_message_at: new Date(timestamp * 1000).toISOString(),
        unread_count: (conversation.unread_count || 0) + 1,
        updated_at: new Date().toISOString()
     }).eq('id', conversation.id)
  }

  if (conversation) {
    await supabase.from('whatsapp_messages').insert({
      conversation_id: conversation.id,
      direction: 'INBOUND',
      content,
      message_type: messageType,
      wa_message_id: idMessage,
      timestamp: new Date(timestamp * 1000).toISOString()
    })
  }
}
