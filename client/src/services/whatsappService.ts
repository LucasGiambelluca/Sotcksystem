import { supabase } from '../supabaseClient';
import type { WhatsAppSession, WhatsAppConversation, WhatsAppMessage } from '../types';

// =============================================
// Session Management (Unified)
// =============================================

export async function getSession() {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .limit(1)
    .single();
  return { data: data as WhatsAppSession | null, error };
}

export async function saveSession(session: Partial<WhatsAppSession>) {
  const existing = await getSession();
  if (existing.data) {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .update({ ...session, updated_at: new Date().toISOString() })
      .eq('id', existing.data.id)
      .select()
      .single();
    return { data: data as WhatsAppSession, error };
  } else {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .insert(session)
      .select()
      .single();
    return { data: data as WhatsAppSession, error };
  }
}

// =============================================
// Hybrid Config & API Calls
// =============================================

// Helper to detect provider
function getProvider(session: WhatsAppSession | null) {
  if (session?.status === 'demo_mode') return 'DEMO';
  if (session?.api_url?.includes('green-api.com')) return 'GREEN-API';
  if (session?.api_url?.includes('waha') || session?.api_url?.includes('onrender.com') || session?.api_url?.includes(':3001')) return 'WAHA';
  return 'EVOLUTION';
}

async function getProviderConfig() {
  const { data } = await getSession();
  const provider = getProvider(data);

  if (provider === 'DEMO') {
    return { provider, idInstance: 'DEMO', apiToken: 'DEMO', apiUrl: '' };
  }

  if (!data?.instance_name || !data?.api_key || !data?.api_url) {
    throw new Error('WhatsApp no configurado. Ve a WhatsApp → Conectar.');
  }

  // GREEN-API: instance_name=idInstance, api_key=apiToken
  // EVOLUTION: instance_name=instanceName, api_key=apikey
  return {
    provider,
    idInstance: data.instance_name,
    apiToken: data.api_key,
    apiUrl: data.api_url,
  };
}

export async function createInstance(instanceName: string, apiUrl: string, apiKey: string) {
  // Detect provider
  const isGreenAPI = apiUrl.includes('green-api.com');
  const isWAHA = apiUrl.includes('waha') || apiUrl.includes('onrender.com') || apiUrl.includes(':3001');
  
  if (isGreenAPI) return; // Green-API instances are pre-created

  if (isWAHA) {
    // WAHA: POST /api/sessions/start
    const res = await fetch(`${apiUrl}/api/sessions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        name: 'default',
        config: {
          proxy: null,
          noweb: {
            store: {
              enabled: true,
            },
          },
        },
      }),
    });
    return res.json();
  }

  // Evolution API
  const res = await fetch(`${apiUrl}/instance/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({
      instanceName: instanceName,
      token: apiKey,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  });
  return res.json();
}

export async function getInstanceStatus(instanceName: string, apiKey: string) {
  const { data } = await getSession();
  const provider = getProvider(data);
  let apiUrl = data?.api_url || '';
  // Ensure protocol
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `http://${apiUrl}`;
  }

  console.log('Using WhatsApp Config:', { provider, apiUrl });

  if (provider === 'DEMO') return { stateInstance: 'authorized', instance: { state: 'open' } };

  if (provider === 'GREEN-API') {
    const res = await fetch(`${apiUrl}/waInstance${instanceName}/getStateInstance/${apiKey}`, {
      method: 'GET',
    });
    const json = await res.json();
    return json; // { stateInstance: 'authorized' }
  } else if (provider === 'WAHA') {
    // WAHA: GET /api/sessions
    try {
      const res = await fetch(`${apiUrl}/api/sessions?all=true`, {
        method: 'GET',
        headers: { 'X-Api-Key': apiKey },
      });
      const json = await res.json();
      // Find session 'default'
      const session = Array.isArray(json) ? json.find((s: any) => s.name === instanceName) : null;
      if (session && session.status === 'WORKING') {
          return { instance: { state: 'open' } };
      }
      return { instance: { state: 'close' } };
    } catch (e) {
      console.error('WAHA Status Error:', e);
      return { instance: { state: 'close' } };
    }
  } else {
    // Evolution
    try {
      const res = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: { 'apikey': apiKey },
      });
      const json = await res.json();
      // Evolution returns { instance: { state: 'open' } }
      return json;
    } catch (e) {
      return { error: e };
    }
  }
}

export async function getQRCode(instanceName: string, apiKey: string) {
  const { data } = await getSession();
  const provider = getProvider(data);
  let apiUrl = data?.api_url || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `http://${apiUrl}`;
  }
  console.log('Getting QR for:', { provider, apiUrl });

  if (provider === 'DEMO') return { type: 'alreadyLogged' };

  if (provider === 'GREEN-API') {
    // Green-API: Returns { type: 'qrCode', message: 'base64...' }
    const res = await fetch(`${apiUrl}/waInstance${instanceName}/qr/${apiKey}`, {
      method: 'GET',
    });
    return res.json();
  } else if (provider === 'WAHA') {
    // WAHA: GET /api/default/auth/qr returns PNG image directly
    
    // Ensure session is started first
    try {
      await createInstance(instanceName, apiUrl, apiKey);
    } catch (e) {
      // Ignore error if session already exists/started
    }

    // Retry mechanism for STARTING state
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`${apiUrl}/api/default/auth/qr`, {
          method: 'GET',
          headers: { 'X-Api-Key': apiKey },
        });
        
        const contentType = res.headers.get('content-type') || '';
        
        if (contentType.includes('image')) {
          // WAHA returns raw PNG image - convert to base64 data URL
          const blob = await res.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          return { type: 'qrCode', message: base64 };
        }
        
        // If not image, try JSON
        const json = await res.json();

        // If session is STARTING, wait and retry
        if (res.status === 422 && json.response?.status === 'STARTING') {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        // If session is STOPPED (failed to start), try to restart it
        if (res.status === 422 && json.response?.status === 'STOPPED') {
          await createInstance(instanceName, apiUrl, apiKey);
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }

        if (json.qr) {
          return { type: 'qrCode', message: json.qr };
        }
        
        // If other error, return it
        if (!res.ok && i === 39) return json;
        if (res.ok) return json;
      } catch (e) {
        if (i === 39) throw e;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    return { error: 'Timeout waiting for QR code' };
  } else {
    // Evolution API: Returns { base64: '...' } or checks connect
    const res = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': apiKey },
    });
    const json = await res.json();
    // Normalize to Green-API structure for UI compatibility if needed
    if (json.base64) {
      return { type: 'qrCode', message: json.base64 };
    }
    return json;
  }
}

export async function setWebhook(instanceName: string, apiKey: string, webhookUrl: string) {
  const { data } = await getSession();
  const provider = getProvider(data);
  const apiUrl = data?.api_url;

  if (provider === 'DEMO') return { saveSettings: true };

  if (provider === 'GREEN-API') {
    const res = await fetch(`${apiUrl}/waInstance${instanceName}/setSettings/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: webhookUrl,
        outgoingWebhook: 'yes',
        stateWebhook: 'yes',
        incomingWebhook: 'yes',
      }),
    });
    return res.json();
  } else {
    // Evolution API
    // V2: /webhook/set/:instance
    const res = await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        enabled: true,
        url: webhookUrl,
        webhookByEvents: true,
        events: ['MESSAGES_UPSERT', "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
      }),
    });
    return res.json();
  }
}

export async function activateDemoMode() {
  await saveSession({
    status: 'demo_mode',
    instance_name: 'DEMO_INSTANCE',
    api_key: 'DEMO_KEY',
    api_url: 'DEMO_URL'
  });

  // Create Demo Conversation
  const demoPhone = '5491100000000';
  const { data: client } = await supabase.from('clients').select('id').limit(1).single();
  let { data: convo } = await supabase.from('whatsapp_conversations').select('*').eq('phone', demoPhone).single();

  if (!convo) {
    const { data } = await supabase.from('whatsapp_conversations').insert({
      phone: demoPhone,
      contact_name: 'Cliente Demo',
      client_id: client?.id || null,
      unread_count: 1,
      last_message: 'Hola, quiero hacer un pedido',
      last_message_at: new Date().toISOString()
    }).select().single();
    convo = data;
  }

  if (convo) {
    await supabase.from('whatsapp_messages').insert({
      conversation_id: convo.id,
      direction: 'INBOUND',
      content: 'Hola, buenas tardes. ¿Me podrían enviar 2 Bidones de 20L y 1 Pack de Soda?',
      message_type: 'text',
      timestamp: new Date().toISOString(),
      is_read: false
    });
  }
  return true;
}

export async function sendWhatsAppMessage(phone: string, message: string) {
  const { provider, idInstance, apiToken, apiUrl } = await getProviderConfig();

  // Demo Logic
  if (provider === 'DEMO') {
     const rawPhone = phone.replace(/[\s\-\+\(\)]/g, '').replace('@c.us', '');
     const conversation = await getOrCreateConversation(rawPhone);
     if (conversation) {
       await supabase.from('whatsapp_messages').insert({
         conversation_id: conversation.id,
         direction: 'OUTBOUND',
         content: message,
         message_type: 'text',
         wa_message_id: `DEMO-${Date.now()}`,
       });
       await supabase.from('whatsapp_conversations').update({
         last_message: message,
         last_message_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
       }).eq('id', conversation.id);
       
       // Auto-reply
       setTimeout(async () => {
         await supabase.from('whatsapp_messages').insert({
           conversation_id: conversation.id,
           direction: 'INBOUND',
           content: '¡Gracias! Quedo a la espera.',
           message_type: 'text',
           timestamp: new Date().toISOString(),
           is_read: false
         });
         await supabase.rpc('increment_unread', { convo_id: conversation.id });
         await supabase.from('whatsapp_conversations').update({
            last_message: '¡Gracias! Quedo a la espera.',
            last_message_at: new Date().toISOString(),
            unread_count: 1
         }).eq('id', conversation.id);
       }, 3000);
     }
     return { idMessage: `DEMO-${Date.now()}` };
  }

  // Preserve the original phone for providers that need it (e.g., WAHA with LID numbers)
  const originalPhone = phone.replace(/[\s\-\+\(\)]/g, '');
  
  // Format Phone - strip suffixes for raw number
  let cleanPhone = originalPhone;
  cleanPhone = cleanPhone.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@lid', '');
  
  const rawPhone = cleanPhone; 
  const apiPhone = `${rawPhone}@c.us`; 

  let result;


  if (provider === 'GREEN-API') {
    const url = `${apiUrl}/waInstance${idInstance}/sendMessage/${apiToken}`;
    console.log('🌐 WhatsApp Service: Sending to Green-API:', url);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: apiPhone, message: message }),
    });
    result = await res.json();
  } else if (provider === 'WAHA') {
    // WAHA / Custom Baileys Server API
    // Send the original phone (preserving @lid if present) so the server can handle it correctly
    const url = `${apiUrl}/api/send-message`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: originalPhone,
        message: message
      }),
    });

    if (!res.ok) {
        throw new Error(`WhatsApp API Error: ${res.status}`);
    }

    await res.json();
    result = { idMessage: 'SENT-OK' };
  } else {
    // Evolution API
    const url = `${apiUrl}/message/sendText/${idInstance}`;
    console.log('🌐 WhatsApp Service: Sending to Evolution:', url);
    console.log('📦 Payload:', { number: rawPhone, text: message });
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiToken
      },
      body: JSON.stringify({
        number: rawPhone, 
        options: { delay: 1200, presence: 'composing' },
        textMessage: { text: message }
      }),
    });
    
    if (!res.ok) {
        const text = await res.text();
        console.error('❌ WhatsApp API Error:', res.status, text);
        throw new Error(`WhatsApp API Error: ${res.status} - ${text.substring(0, 100)}...`);
    }
    
    const json = await res.json();
    result = { idMessage: json.key?.id || json.id };
  }

  // Save Outbound
  const conversation = await getOrCreateConversation(rawPhone);
  if (conversation) {
    await supabase.from('whatsapp_messages').insert({
      conversation_id: conversation.id,
      direction: 'OUTBOUND',
      content: message,
      message_type: 'text',
      wa_message_id: result?.idMessage || null,
    });
    await supabase.from('whatsapp_conversations').update({
      last_message: message,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', conversation.id);
  }

  return result;
}

export async function sendCatalog(phone: string) {
  const { apiUrl } = await getProviderConfig();
  
  try {
    const res = await fetch(`${apiUrl}/api/catalog/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return await res.json();
  } catch (error) {
    console.error('Error sending catalog:', error);
    return { error };
  }
}

// =============================================
// Polling for Local Dev (Receiving Messages without Webhook)
// =============================================

export async function disableWebhook() {
  const { provider, idInstance, apiToken, apiUrl } = await getProviderConfig();
  if (provider !== 'GREEN-API') return;

  try {
    await fetch(`${apiUrl}/waInstance${idInstance}/setSettings/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: '',
        outgoingWebhook: 'no',
        stateWebhook: 'no',
        incomingWebhook: 'no',
      }),
    });
    console.log('Webhook disabled for polling mode');
  } catch (e) {
    console.error('Error disabling webhook:', e);
  }
}

export async function syncMessages() {
  const { provider, idInstance, apiToken, apiUrl } = await getProviderConfig();
  if (provider !== 'GREEN-API') return;

  try {
    // Process up to 5 messages per tick
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${apiUrl}/waInstance${idInstance}/receiveNotification/${apiToken}`, { method: 'GET' });
      
      // Better error handling
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Green-API Error (${res.status}):`, errorText);
        break;
      }

      const text = await res.text();
      if (!text) break; // Empty response = no messages
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Invalid JSON from Green-API:', text.substring(0, 200));
        break;
      }
      
      if (!data || !data.receiptId) break; // No more messages

      const { body } = data;
      console.log('New Message Polled:', body);

      if (body.typeWebhook === 'incomingMessageReceived') {
        const { senderData, messageData, idMessage, timestamp } = body;
        if (senderData?.sender !== `${idInstance}@c.us`) {
          const remoteJid = senderData?.sender || '';
          const phone = remoteJid.replace('@c.us', '');
          
          let content = '';
          let messageType = 'text';

          if (messageData?.typeMessage === 'textMessage') {
             content = messageData.textMessageData?.textMessage || '';
          } else if (messageData?.typeMessage === 'extendedTextMessage') {
             content = messageData.extendedTextMessageData?.text || '';
          } else if (messageData?.typeMessage === 'imageMessage') {
             content = messageData.imageMessageData?.caption || '[Imagen]';
             messageType = 'image';
          } else {
             content = `[${messageData?.typeMessage}]`;
          }

          const conversation = await getOrCreateConversation(phone, senderData?.senderName);
          
          // Check if message already exists
          const { data: existingMsg } = await supabase.from('whatsapp_messages').select('id').eq('wa_message_id', idMessage).single();
          
          if (!existingMsg) {
             await supabase.from('whatsapp_messages').insert({
                conversation_id: conversation.id,
                direction: 'INBOUND',
                content,
                message_type: messageType,
                wa_message_id: idMessage,
                timestamp: new Date(timestamp * 1000).toISOString(),
                is_read: false
             });
             await supabase.from('whatsapp_conversations').update({
                last_message: content,
                last_message_at: new Date(timestamp * 1000).toISOString(),
                unread_count: (conversation.unread_count || 0) + 1,
                updated_at: new Date().toISOString()
             }).eq('id', conversation.id);
          }
        }
      }

      // Delete notification to acknowledge receipt
      await fetch(`${apiUrl}/waInstance${idInstance}/deleteNotification/${apiToken}/${data.receiptId}`, { method: 'DELETE' });
    }
  } catch (e) {
    console.error('Polling error:', e);
  }
}

// =============================================
// Conversations
// =============================================

export async function getConversations() {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('*, client:clients(*)')
    .order('last_message_at', { ascending: false });
  return { data: data as WhatsAppConversation[] | null, error };
}

export async function getOrCreateConversation(phone: string, contactName?: string) {
  const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');

  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('phone', cleanPhone)
    .single();

  if (existing) return existing as WhatsAppConversation;

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
    .limit(1)
    .single();

  const { data: newConvo } = await supabase
    .from('whatsapp_conversations')
    .insert({
      phone: cleanPhone,
      contact_name: contactName || cleanPhone,
      client_id: client?.id || null,
    })
    .select()
    .single();

  return newConvo as WhatsAppConversation;
}

export async function resolveHandover(conversationId: string, phone: string) {
  // Update status back to BOT in conversations
  await supabase
    .from('whatsapp_conversations')
    .update({ status: 'BOT', updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  // Resume the flow execution engine
  try {
     await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`, {
         method: 'POST',
         headers: {
             'Content-Type': 'application/json',
             Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
         },
         body: JSON.stringify({
              action: 'RESUME_FLOW',
              phone: phone
         })
     });
     // It triggers backend resume logic, implemented alongside router
  } catch (err) {
      console.error("Failed to resume flow", err);
  }
}

export async function getMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: true })
    .order('created_at', { ascending: true });
  return { data: data as WhatsAppMessage[] | null, error };
}

export async function markConversationAsRead(conversationId: string) {
  await supabase.from('whatsapp_messages').update({ is_read: true }).eq('conversation_id', conversationId).eq('is_read', false);
  await supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', conversationId);
}

export function subscribeToMessages(onNewMessage: (msg: WhatsAppMessage) => void, onConversationUpdate: (convo: WhatsAppConversation) => void) {
  const messagesChannel = supabase.channel('whatsapp-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => onNewMessage(payload.new as WhatsAppMessage))
    .subscribe();
  const convosChannel = supabase.channel('whatsapp-conversations')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, (payload) => onConversationUpdate(payload.new as WhatsAppConversation))
    .subscribe();
  return () => { supabase.removeChannel(messagesChannel); supabase.removeChannel(convosChannel); };
}

export async function getTotalUnreadCount(): Promise<number> {
  const { data } = await supabase.from('whatsapp_conversations').select('unread_count');
  if (!data) return 0;
  return data.reduce((sum: number, c: { unread_count: number }) => sum + (c.unread_count || 0), 0);
}
