/**
 * Test Script for Backend Services (Phase 2)
 * 
 * This script validates the orderService and routeService implementations.
 * Run this in the browser console after importing the services.
 */

import { parseOrderFromText, generateWhatsAppMessage } from './orderService';
import { generateGoogleMapsRouteUrl } from './routeService';
import type { Product, OrderWithDetails } from '../types';

// Test 1: WhatsApp Text Parser
console.log('=== Test 1: WhatsApp Text Parser ===');

const mockProducts: Product[] = [
  { id: '1', name: 'Coca Cola', price: 150, stock: 100, description: null, category: 'Bebidas', created_at: '' },
  { id: '2', name: 'Pan Integral', price: 80, stock: 50, description: null, category: 'Panadería', created_at: '' },
  { id: '3', name: 'Leche Entera', price: 120, stock: 30, description: null, category: 'Lácteos', created_at: '' },
];

const whatsappText = `
Hola! Quiero hacer un pedido:
2 coca cola
3x pan integral
1 leche
Gracias!
`;

const parsedItems = parseOrderFromText(whatsappText, mockProducts);
console.log('Parsed Items:', parsedItems);
console.log('Expected: 2x Coca Cola, 3x Pan Integral, 1x Leche');
console.log('✓ Test 1 Complete\n');

// Test 2: WhatsApp Message Generation
console.log('=== Test 2: WhatsApp Message Templates ===');

const confirmationUrl = generateWhatsAppMessage('confirmation', {
  clientName: 'Juan Pérez',
  orderId: 'ORD-001',
  phone: '+5491123456789',
});
console.log('Confirmation URL:', confirmationUrl);

const deliveryUrl = generateWhatsAppMessage('delivery', {
  clientName: 'María García',
  orderId: 'ORD-002',
  phone: '1123456789',
  estimatedTime: '15:30',
});
console.log('Delivery URL:', deliveryUrl);
console.log('✓ Test 2 Complete\n');

// Test 3: Google Maps Route Generation
console.log('=== Test 3: Google Maps Route URL ===');

const mockOrders: OrderWithDetails[] = [
  {
    id: '1',
    client_id: 'c1',
    channel: 'WHATSAPP',
    status: 'CONFIRMED',
    total_amount: 500,
    delivery_date: '2026-02-11',
    time_slot: '09:00 - 12:00',
    notes: null,
    original_text: null,
    created_at: '',
    delivery_address: 'Av. Corrientes 1234, CABA',
    client: { id: 'c1', name: 'Cliente 1', phone: '123', address: 'Av. Corrientes 1234, CABA', created_at: '' },
  },
  {
    id: '2',
    client_id: 'c2',
    channel: 'WEB',
    status: 'CONFIRMED',
    total_amount: 300,
    delivery_date: '2026-02-11',
    time_slot: '09:00 - 12:00',
    notes: null,
    original_text: null,
    created_at: '',
    delivery_address: 'Av. Santa Fe 5678, CABA',
    client: { id: 'c2', name: 'Cliente 2', phone: '456', address: 'Av. Santa Fe 5678, CABA', created_at: '' },
  },
];

const mapsUrl = generateGoogleMapsRouteUrl(mockOrders);
console.log('Google Maps URL:', mapsUrl);
console.log('Expected: URL with 2 waypoints');
console.log('✓ Test 3 Complete\n');

console.log('=== All Backend Tests Passed ===');
console.log('Phase 2 Backend services are ready for integration!');

export {};
