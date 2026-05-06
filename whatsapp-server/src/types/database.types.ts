/**
 * Central Database Types for StockSystem
 * These types mirror the Supabase/Postgres schema.
 */

// ─── Enums ───────────────────────────────────────────────

export type OrderStatus = 
    | 'PENDING' 
    | 'CONFIRMED' 
    | 'PREPARING' 
    | 'READY' 
    | 'IN_DELIVERY' 
    | 'DELIVERED' 
    | 'CANCELLED'
    | 'ASSEMBLED';

export type OrderChannel = 'WEB' | 'WHATSAPP' | 'PHONE' | 'OTHER' | 'TABLET';

export type MovementType = 'DEBT' | 'PAYMENT';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export type RouteStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';

export type UserRole = 'ADMIN' | 'PREPARER' | 'CADETE' | 'CASHIER';

export type UserStatus = 'ONLINE' | 'OFFLINE' | 'BUSY';

// ─── Core Entities ───────────────────────────────────────

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
    category: string | null;
    image_url: string | null;
    is_active: boolean;
    created_at: string;
}

export interface Order {
    id: string;
    client_id: string | null;
    channel: OrderChannel;
    status: OrderStatus;
    total_amount: number;
    delivery_date: string | null;
    time_slot: string | null;
    notes: string | null;
    original_text: string | null;
    shipping_zone_id: number | null;
    shipping_cost: number;
    delivery_slot_id: number | null;
    is_assembled: boolean;
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

export interface Movement {
    id: string;
    client_id: string;
    type: MovementType;
    amount: number;
    description: string | null;
    created_at: string;
}

// ─── WhatsApp Entities ───────────────────────────────────

export interface WhatsAppConversation {
    id: string;
    client_id: string | null;
    phone: string;
    contact_name: string | null;
    last_message: string | null;
    last_message_at: string | null;
    unread_count: number;
    created_at: string;
    updated_at: string;
}

export interface WhatsAppMessage {
    id: string;
    conversation_id: string;
    direction: MessageDirection;
    content: string | null;
    media_url: string | null;
    message_type: string;
    wa_message_id: string | null;
    is_read: boolean;
    timestamp: string;
    created_at: string;
}

// ─── Bot / Flow Entities ─────────────────────────────────

export interface FlowNode {
    id: string;
    type: string;
    data: Record<string, unknown>;
    position: { x: number; y: number };
}

export interface FlowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

export interface Flow {
    id: string;
    name: string;
    trigger_word: string;
    is_active: boolean;
    nodes: FlowNode[];
    edges: FlowEdge[];
    created_at: string;
}

export interface ChatSession {
    phone: string;
    step: string;
    temp_data: Record<string, unknown>;
    updated_at: string;
}

// ─── Logistics ───────────────────────────────────────────

export interface Route {
    id: string;
    name: string;
    date: string;
    status: RouteStatus;
    driver_name: string | null;
    vehicle_id: string | null;
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

export interface DeliverySlot {
    id: number;
    label: string;
    is_active: boolean;
    created_at: string;
}

export interface ShippingZone {
    id: number;
    name: string;
    cost: number;
    is_active: boolean;
    polygon?: Record<string, unknown>;
    created_at: string;
}

// ─── Staff ───────────────────────────────────────────────

export interface User {
    id: string;
    name: string;
    role: UserRole;
    is_active: boolean;
    current_status: UserStatus;
    assigned_queue_id: string | null;
    pin?: string;
    phone?: string;
    created_at: string;
}

export interface PreparationQueue {
    id: string;
    name: string;
    max_concurrent: number;
}

// ─── Configuration ──────────────────────────────────────

export interface WhatsAppConfig {
    id: number;
    welcome_message: string;
    is_active: boolean;
    business_name?: string;
    business_hours?: Record<string, unknown>;
    created_at: string;
}

// ─── API Response helpers ────────────────────────────────

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
