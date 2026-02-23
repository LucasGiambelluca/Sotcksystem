import { supabase } from '../supabaseClient';
import type { Order, OrderWithDetails, Product } from '../types';

// CRUD Operations for Orders
export async function createOrder(orderData: {
  client_id: string;
  channel: Order['channel'];
  delivery_date?: string;
  time_slot?: string;
  notes?: string;
  original_text?: string;
  items: Array<{ product_id: string; quantity: number; unit_price: number }>;
}) {
  try {
    // Calculate total
    const total_amount = orderData.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        client_id: orderData.client_id,
        channel: orderData.channel,
        total_amount,
        delivery_date: orderData.delivery_date || null,
        time_slot: orderData.time_slot || null,
        notes: orderData.notes || null,
        original_text: orderData.original_text || null,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert order items
    const itemsToInsert = orderData.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    return { data: order, error: null };
  } catch (error) {
    console.error('Error creating order:', error);
    return { data: null, error };
  }
}

// Helper to map Supabase response keys (table names) to our TypeScript interface keys
export function mapOrder(raw: any): OrderWithDetails {
  const { clients, order_items, ...rest } = raw;
  return {
    ...rest,
    client: clients || null,
    items: (order_items || []).map((oi: any) => {
      const { products, ...itemRest } = oi;
      return { ...itemRest, product: products || null };
    }),
  };
}

export async function getOrders(filters?: {
  status?: Order['status'];
  channel?: Order['channel'];
  client_id?: string;
  date_from?: string;
  date_to?: string;
}) {
  try {
    let query = supabase
      .from('orders')
      .select(`
        *,
        clients (id, name, phone, address),
        order_items (
          *,
          products (id, name, price)
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.channel) {
      query = query.eq('channel', filters.channel);
    }
    if (filters?.client_id) {
      query = query.eq('client_id', filters.client_id);
    }
    if (filters?.date_from) {
      query = query.gte('delivery_date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('delivery_date', filters.date_to);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data: (data || []).map(mapOrder) as OrderWithDetails[], error: null };
  } catch (error) {
    console.error('Error fetching orders:', error);
    return { data: null, error };
  }
}

export async function getOrderById(orderId: string) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        clients (id, name, phone, address),
        order_items (
          *,
          products (id, name, price)
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) throw error;

    return { data: mapOrder(data) as OrderWithDetails, error: null };
  } catch (error) {
    console.error('Error fetching order:', error);
    return { data: null, error };
  }
}

export async function updateOrderStatus(orderId: string, status: Order['status']) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    // Send WhatsApp notification
    try {
      const { sendOrderStatusNotification } = await import('./orderNotificationService');
      await sendOrderStatusNotification(orderId, status);
    } catch (notifError) {
      console.error('❌ Failed to send notification:', notifError);
      // Don't fail the status update if notification fails
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error updating order status:', error);
    return { data: null, error };
  }
}

export async function deleteOrder(orderId: string) {
  try {
    const { error } = await supabase.from('orders').delete().eq('id', orderId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error deleting order:', error);
    return { error };
  }
}

export async function updateOrder(orderId: string, updates: {
  delivery_date?: string | null;
  time_slot?: string | null;
  notes?: string | null;
  channel?: Order['channel'];
}) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error updating order:', error);
    return { data: null, error };
  }
}

export async function updateClient(clientId: string, updates: {
  name?: string;
  phone?: string | null;
  address?: string | null;
}) {
  try {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error updating client:', error);
    return { data: null, error };
  }
}

// WhatsApp Text Parser
interface ParsedOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export function parseOrderFromText(
  text: string,
  products: Product[]
): ParsedOrderItem[] {
  const parsedItems: ParsedOrderItem[] = [];
  const lines = text.toLowerCase().split(/\n|,/); // Split by newlines or commas

  const numberMap: Record<string, number> = {
    'un': 1, 'una': 1, 'uno': 1,
    'dos': 2,
    'tres': 3,
    'cuatro': 4,
    'cinco': 5,
    'seis': 6,
    'siete': 7,
    'ocho': 8,
    'nueve': 9,
    'diez': 10
  };

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // 1. Replace number words with digits
    // "un bidon" -> "1 bidon"
    Object.keys(numberMap).forEach(key => {
      const regex = new RegExp(`^${key}\\s`, 'i');
      if (regex.test(line)) {
        line = line.replace(regex, `${numberMap[key]} `);
      }
    });

    let quantity = 0;
    let productName = '';

    // 2. Try explicit patterns — use matchAll to find ALL products in one line
    // Supports: "2 de nalga 1 peceto", "2x coca 3 fanta", "2 nalga"
    const globalPattern = /(\d+)\s*(?:x\s*|(?:de\s+))?\s*([a-záéíóúñ\.]+(?:\s+[a-záéíóúñ\.]+)*?)(?=\s+\d|\s*$)/gi;
    const matches = [...line.matchAll(globalPattern)];

    if (matches.length > 0) {
      for (const match of matches) {
        quantity = Number(match[1]);
        productName = match[2].trim();

        if (quantity > 0 && productName) {
          const matchedProduct = findBestProductMatch(productName, products);
          if (matchedProduct) {
            const existing = parsedItems.find(
              (item) => item.product_id === matchedProduct.id
            );
            if (existing) {
              existing.quantity += quantity;
            } else {
              parsedItems.push({
                product_id: matchedProduct.id,
                product_name: matchedProduct.name,
                quantity,
                unit_price: matchedProduct.price,
              });
            }
          }
        }
      }
      continue; // Skip to next line since we handled all matches
    }

    // 3. Try reversed pattern: "nalga 2"
    const reversedPattern = /([a-záéíóúñ\s\.]+?)\s*(?:x|de)?\s*(\d+)/i;
    const reversedMatch = line.match(reversedPattern);
    if (reversedMatch) {
      quantity = Number(reversedMatch[2]);
      productName = reversedMatch[1].trim();
    }

    // 4. If no explicit number pattern, try to match just the product name (qty = 1)
    if (!productName) {
      const potentialProduct = findBestProductMatch(line, products);
      if (potentialProduct) {
        quantity = 1;
        productName = line;
      }
    }

    // 5. Resolve product and add
    if (productName && quantity > 0) {
      const matchedProduct = findBestProductMatch(productName, products);

      if (matchedProduct) {
        const existing = parsedItems.find(
          (item) => item.product_id === matchedProduct.id
        );
        if (existing) {
          existing.quantity += quantity;
        } else {
          parsedItems.push({
            product_id: matchedProduct.id,
            product_name: matchedProduct.name,
            quantity,
            unit_price: matchedProduct.price,
          });
        }
      }
    }
  }

  return parsedItems;
}

// Simple fuzzy matching helper
function findBestProductMatch(
  searchTerm: string,
  products: Product[]
): Product | null {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .trim();

  // Singularize: "bidones" -> "bidon", "latas" -> "lata"
  const singularize = (word: string) => {
    if (word.endsWith('es')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
  };

  const stopWords = ['de', 'del', 'la', 'el', 'un', 'una', 'los', 'las'];

  const cleanSearch = normalize(searchTerm);
  const searchWords = cleanSearch
    .split(/\s+/)
    .filter(w => !stopWords.includes(w))
    .map(singularize);

  if (searchWords.length === 0) return null;

  // 1. Exact match (normalized)
  let match = products.find((p) => normalize(p.name) === cleanSearch);
  if (match) return match;

  // 2. Word match with singularization
  match = products.find((p) => {
    const productWords = normalize(p.name).split(/\s+/).map(singularize);
    
    // Check if ALL significant search words exist in the product name
    // (e.g. search "bidon 20", product "Bidón 20L" -> "bidon" matches, "20" matches)
    const allWordsMatch = searchWords.every(sw => 
      productWords.some(pw => pw.includes(sw) || sw.includes(pw))
    );

    return allWordsMatch;
  });

  return match || null;
}

// WhatsApp Message Templates
export function generateWhatsAppMessage(
  type: 'confirmation' | 'modification' | 'delivery',
  data: {
    clientName: string;
    orderId: string;
    phone: string;
    estimatedTime?: string;
    changes?: string;
  }
): string {
  const baseUrl = 'https://wa.me/';
  const phoneNumber = data.phone.replace(/\D/g, ''); // Remove non-digits

  let message = '';

  switch (type) {
    case 'confirmation':
      message = `Hola ${data.clientName}, tu pedido #${data.orderId} ha sido confirmado. ¡Gracias por tu compra!`;
      break;
    case 'modification':
      message = `Hola ${data.clientName}, hemos realizado cambios en tu pedido #${data.orderId}: ${data.changes || 'Ver detalles'}`;
      break;
    case 'delivery':
      message = `Hola ${data.clientName}, estamos en camino con tu pedido #${data.orderId}. Llegamos aproximadamente a las ${data.estimatedTime || 'pronto'}.`;
      break;
  }

  return `${baseUrl}${phoneNumber}?text=${encodeURIComponent(message)}`;
}
