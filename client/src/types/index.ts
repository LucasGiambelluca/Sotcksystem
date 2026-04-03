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
  stock: number; // Current Warehouse Stock
  production_stock: number; // Current Production Stock
  min_stock: number; // Minimum stock threshold for Warehouse
  category?: string;
  is_active?: boolean;
  cost?: number; // Cost from provider
  provider?: string | null; // Provider name
  last_restock_date?: string | null; // Last entry date
  created_at: string;
}

export type StockMovementType = 'PURCHASE' | 'TRANSFER' | 'SALE' | 'ADJUSTMENT';

export interface StockMovement {
  id: string;
  product_id: string;
  type: StockMovementType;
  quantity: number;
  description: string | null;
  shift_id?: string | null;
  employee_id?: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  phone?: string | null;
  pin_code?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Station {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

export type ShiftStatus = 'ACTIVE' | 'CLOSED';

export interface Shift {
  id: string;
  employee_id: string;
  station_id: string;
  start_time: string;
  end_time?: string | null;
  status: ShiftStatus;
  notes?: string | null;
  created_at: string;
  // Joined fields
  employee?: Employee;
  station?: Station;
}

export interface PublicCatalogItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category?: string;
  category_id?: string | null;
  category_name?: string | null;
  category_sort_order?: number;
  item_sort_order?: number;
  image_url_1?: string | null;
  image_url_2?: string | null;
  in_stock: boolean;
  is_special?: boolean;
  special_price?: number | null;
  offer_label?: string | null;
  sort_order: number;
}

export interface Movement {
  id: string;
  client_id: string;
  type: 'DEBT' | 'PAYMENT';
  amount: number;
  description: string | null;
  created_at: string;
}

export type OrderChannel = 'WEB' | 'WHATSAPP' | 'PHONE' | 'TABLET' | 'OTHER';
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
  assigned_to?: string | null;
  assigned_at?: string | null;
  
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  catalog_item_id?: string | null; // New: references catalog_items table
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

// CatalogItem: A finished/elaborated product sold to end customers (e.g. Pizza Napolitana)
// This is separate from Product (raw material inventory - e.g. flour, chicken)
export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string; // Keep for backward compatibility
  category_id?: string | null; // NEW: Relation to catalog_categories
  image_url_1?: string | null;
  image_url_2?: string | null;
  station_id?: string | null;
  is_active: boolean;
  is_special?: boolean;
  special_price?: number | null;
  offer_label?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined
  station?: Station | null;
  catalog_category?: CatalogCategory | null;
}

export interface CatalogCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogPromotion {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  button_text: string;
  target_id: string | null; // Product ID
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// RecipeComponent: A sub-item of a catalog item assigned to a specific station
// Ej: CatalogItem "Combo Asado" -> RecipeComponent "Asado de tira" (station: Parrilla)
export interface RecipeComponent {
  id: string;
  catalog_item_id: string;
  name: string;
  station_id: string | null;
  sort_order: number;
  created_at: string;
  // Joined
  station?: Station | null;
}

// OrderStationTask: A per-station ticket generated from an order
export type TaskStatus = 'pending' | 'preparing' | 'ready';

export interface OrderStationTask {
  id: string;
  order_id: string;
  station_id: string;
  status: TaskStatus;
  items: { name: string; quantity: number; parent_item?: string }[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  // Joined
  station?: Station | null;
  order?: Order | null;
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
  id: string | number;
  name: string;
  cost: number;
  is_active: boolean;
  zone_type?: 'radius' | 'text_match' | 'polygon';
  max_radius_km?: number;
  match_keywords?: string[];
  polygon?: any;
  allow_delivery?: boolean;
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
  business_hours?: {
    isActive: boolean;
    days: number[]; // 0=Sunday, 1=Monday...
    startTime: string; // "09:00"
    endTime: string; // "18:00"
    timezone: string;
  };
  catalog_banner_url?: string;
  catalog_logo_url?: string;
  catalog_business_name?: string;
  catalog_accent_color?: string;
  whatsapp_phone?: string;
  shipping_policy?: 'flex' | 'smart' | 'secure';
  store_lat?: number;
  store_lng?: number;
  store_address?: string;
  store_city?: string;
  store_province?: string;
  store_country?: string;
  auto_print?: boolean;
}
