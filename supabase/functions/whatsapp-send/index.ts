// Supabase Edge Function: whatsapp-send
// Sends messages through Green-API
// Deploy: supabase functions deploy whatsapp-send

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

    const { phone, message } = await req.json()

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'phone and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Green-API config
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .limit(1)
      .single()

    if (!session?.instance_name || !session?.api_key) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp (Green-API) not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send via Green-API
    let cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '')
    if (!cleanPhone.includes('@c.us')) {
      cleanPhone = `${cleanPhone}@c.us`
    }

    const { instance_name, api_key } = session // instance_name is idInstance, api_key is apiToken

    const res = await fetch(`https://api.green-api.com/waInstance${instance_name}/sendMessage/${api_key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatId: cleanPhone,
        message: message,
      }),
    })

    const result = await res.json()

    if (!result?.idMessage) {
      throw new Error(`Green-API error: ${JSON.stringify(result)}`)
    }

    // Save outbound message
    const rawPhone = cleanPhone.replace('@c.us', '')
    let { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('phone', rawPhone)
      .single()

    if (!conversation) {
      const { data: newConvo } = await supabase
        .from('whatsapp_conversations')
        .insert({
          phone: rawPhone,
          last_message: message,
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single()
      conversation = newConvo
    }

    if (conversation) {
      await supabase.from('whatsapp_messages').insert({
        conversation_id: conversation.id,
        direction: 'OUTBOUND',
        content: message,
        message_type: 'text',
        wa_message_id: result.idMessage,
        timestamp: new Date().toISOString(), // Use Current Time for outbound
      })

      await supabase
        .from('whatsapp_conversations')
        .update({
          last_message: message,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversation.id)
    }

    return new Response(
      JSON.stringify({ ok: true, idMessage: result.idMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('Send error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
