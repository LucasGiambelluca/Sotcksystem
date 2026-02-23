export interface Client {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category?: string;
  created_at: string;
}

export interface Movement {
  id: string;
  client_id: string;
  type: 'DEBT' | 'PAYMENT';
  amount: number;
  description: string | null;
  created_at: string;
}

export type OrderChannel = 'WEB' | 'WHATSAPP' | 'PHONE' | 'OTHER';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'IN_PREPARATION' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface Order {
  id: string;
  client_id: string;
  channel: OrderChannel;
  status: OrderStatus;
  total_amount: number;
  delivery_date: string | null;
  time_slot: string | null;
  delivery_address: string | null;
  notes: string | null;
  original_text: string | null;
  
  // Phase 11 & 12: Logistics
  shipping_cost?: number;
  shipping_zone_id?: number;
  delivery_slot_id?: number;
  is_assembled?: boolean;
  
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export type RouteStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';

export interface Route {
  id: string;
  name: string;
  date: string;
  status: RouteStatus;
  driver_name: string | null;
  vehicle_id: string | null;
  start_address?: string | null;
  created_at: string;
}

export interface RouteOrder {
  id: string;
  route_id: string;
  order_id: string;
  sequence_number: number;
  estimated_arrival: string | null;
  created_at: string;
}

// Phase 11: Delivery Slots & Zones
export interface DeliverySlot {
  id: number;
  label: string;
  is_active: boolean;
}

export interface ShippingZone {
  id: number;
  name: string;
  cost: number;
  is_active: boolean;
}

// Extended types with relations for UI
export interface OrderWithDetails extends Order {
  client?: Client;
  items?: (OrderItem & { product?: Product })[];
  delivery_slot?: DeliverySlot;
  shipping_zone?: ShippingZone;
}

export interface RouteWithOrders extends Route {
  route_orders?: (RouteOrder & { orders?: OrderWithDetails })[];
}

// =====================
// WhatsApp Types
// =====================

export interface WhatsAppSession {
  id: string;
  instance_name: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'demo_mode';
  phone_number: string | null;
  qr_code: string | null;
  api_url: string | null;
  api_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppConversation {
  id: string;
  client_id: string | null;
  phone: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: 'BOT' | 'HANDOVER';
  created_at: string;
  updated_at: string;
  client?: Client;
}

export type WaMessageDirection = 'INBOUND' | 'OUTBOUND';

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  direction: WaMessageDirection;
  content: string | null;
  media_url: string | null;
  message_type: string;
  wa_message_id: string | null;
  is_read: boolean;
  timestamp: string;
  created_at: string;
}
// Phase 13: WhatsApp Configuration & Templates
export interface WhatsAppConfig {
  id: number;
  welcome_message: string;
  is_active: boolean;
  
  // Notification Templates
  template_confirmed?: string;
  template_preparation?: string;
  template_transit?: string;
  template_delivered?: string;
  template_cancelled?: string;
  checkout_message?: string;
  sileo_api_key?: string;
}
