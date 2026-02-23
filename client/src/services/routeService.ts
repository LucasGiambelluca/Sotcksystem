import { supabase } from '../supabaseClient';
import { mapOrder } from '../services/orderService';
import type { Route, RouteWithOrders, OrderWithDetails } from '../types';

// CRUD Operations for Routes
export async function createRoute(routeData: {
  name: string;
  date: string;
  driver_name?: string;
  vehicle_id?: string;
  start_address?: string;
}) {
  try {
    const { data, error } = await supabase
      .from('routes')
      .insert({
        name: routeData.name,
        date: routeData.date,
        driver_name: routeData.driver_name || null,
        vehicle_id: routeData.vehicle_id || null,
        start_address: routeData.start_address || null,
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error creating route:', error);
    return { data: null, error };
  }
}

export async function getRoutes(filters?: {
  status?: Route['status'];
  date_from?: string;
  date_to?: string;
}) {
  try {
    let query = supabase
      .from('routes')
      .select('*')
      .order('date', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.date_from) {
      query = query.gte('date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('date', filters.date_to);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching routes:', error);
    return { data: null, error };
  }
}

export async function getRouteById(routeId: string) {
  try {
    const { data, error } = await supabase
      .from('routes')
      .select(`
        *,
        route_orders (
          *,
          orders (
            *,
            clients (id, name, phone, address),
            order_items (
              *,
              products (id, name, price)
            )
          )
        )
      `)
      .eq('id', routeId)
      .single();

    if (error) throw error;

    const mappedData = {
      ...data,
      route_orders: (data.route_orders || []).map((ro: any) => ({
        ...ro,
        orders: ro.orders ? mapOrder(ro.orders) : null
      }))
    };

    return { data: mappedData as RouteWithOrders, error: null };
  } catch (error) {
    console.error('Error fetching route:', error);
    return { data: null, error };
  }
}

export async function updateRouteStatus(routeId: string, status: Route['status']) {
  try {
    const { data, error } = await supabase
      .from('routes')
      .update({ status })
      .eq('id', routeId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error updating route status:', error);
    return { data: null, error };
  }
}

export async function updateRoute(routeId: string, updates: {
  name?: string;
  date?: string;
  driver_name?: string | null;
  vehicle_id?: string | null;
  start_address?: string | null;
}) {
  try {
    const { data, error } = await supabase
      .from('routes')
      .update(updates)
      .eq('id', routeId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error updating route:', error);
    return { data: null, error };
  }
}

export async function deleteRoute(routeId: string) {
  try {
    const { error } = await supabase.from('routes').delete().eq('id', routeId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error deleting route:', error);
    return { error };
  }
}

// Route Order Management
export async function addOrderToRoute(
  routeId: string,
  orderId: string,
  sequenceNumber: number,
  estimatedArrival?: string
) {
  try {
    const { data, error } = await supabase
      .from('route_orders')
      .insert({
        route_id: routeId,
        order_id: orderId,
        sequence_number: sequenceNumber,
        estimated_arrival: estimatedArrival || null,
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error adding order to route:', error);
    return { data: null, error };
  }
}

export async function removeOrderFromRoute(routeId: string, orderId: string) {
  try {
    const { error } = await supabase
      .from('route_orders')
      .delete()
      .eq('route_id', routeId)
      .eq('order_id', orderId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error removing order from route:', error);
    return { error };
  }
}

export async function updateRouteOrderSequence(
  routeOrderId: string,
  sequenceNumber: number
) {
  try {
    const { data, error } = await supabase
      .from('route_orders')
      .update({ sequence_number: sequenceNumber })
      .eq('id', routeOrderId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error updating route order sequence:', error);
    return { data: null, error };
  }
}

// Google Maps Integration
// Google Maps Integration
export function generateGoogleMapsRouteUrl(orders: OrderWithDetails[], startAddress?: string | null): string {
  if (orders.length === 0 && !startAddress) return '';

  const defaultRegion = localStorage.getItem('stock_app_default_region') || '';
  
  // Helper to append region if not present
  const formatAddress = (addr: string) => {
      if (!addr) return '';
      if (defaultRegion && !addr.toLowerCase().includes(defaultRegion.split(',')[0].trim().toLowerCase())) {
          return `${addr}, ${defaultRegion}`;
      }
      return addr;
  };

  const addresses = orders
    .map((order) => order.client?.address)
    .filter((address): address is string => !!address && address.trim().length > 0)
    .map(formatAddress);

  if (addresses.length === 0 && !startAddress) return '';

  const baseUrl = 'https://www.google.com/maps/dir/?api=1';
  
  let origin = '';
  let destination = '';
  let waypoints: string[] = [];

  if (startAddress && startAddress.trim().length > 0) {
    origin = encodeURIComponent(formatAddress(startAddress));
    
    if (addresses.length > 0) {
       // Start Address -> Last Order
       // All orders except the last one are waypoints
       destination = encodeURIComponent(addresses[addresses.length - 1]);
       if (addresses.length > 1) {
           waypoints = addresses.slice(0, -1).map(addr => encodeURIComponent(addr));
       }
    } else {
       // Only start address, just show it
       return `https://www.google.com/maps/search/?api=1&query=${origin}`;
    }
  } else {
     // No start address
     if (addresses.length === 1) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addresses[0])}`;
     }
     
     origin = encodeURIComponent(addresses[0]);
     destination = encodeURIComponent(addresses[addresses.length - 1]);
     
     if (addresses.length > 2) {
         waypoints = addresses.slice(1, -1).map(addr => encodeURIComponent(addr));
     }
  }
  
  let url = `${baseUrl}&origin=${origin}&destination=${destination}`;

  if (waypoints.length > 0) {
    url += `&waypoints=${waypoints.join('|')}`;
  }

  url += '&travelmode=driving';

  return url;
}

export function generateOptimizedGoogleMapsUrl(orders: OrderWithDetails[]): string {
  if (orders.length === 0) return '';

  const baseUrl = 'https://www.google.com/maps/dir/?api=1';
  
  const addresses = orders
    .map((order) => order.client?.address)
    .filter((address): address is string => !!address);

  if (addresses.length === 0) return '';

  // Use first as origin, last as destination, rest as waypoints
  const origin = encodeURIComponent(addresses[0]);
  const destination = encodeURIComponent(addresses[length - 1] || addresses[0]);
  
  const waypoints = addresses
    .slice(1, -1)
    .map((addr) => encodeURIComponent(addr))
    .join('|');

  let url = `${baseUrl}&origin=${origin}&destination=${destination}`;
  
  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }
  
  // Add optimize parameter to let Google optimize the route
  url += '&travelmode=driving';

  return url;
}

// Export route data for Excel
export interface RouteExportData {
  routeName: string;
  date: string;
  driver: string;
  stops: Array<{
    sequence: number;
    clientName: string;
    address: string;
    phone: string;
    orderTotal: number;
    items: Array<{
      productName: string;
      quantity: number;
      price: number;
    }>;
  }>;
}

export function prepareRouteForExport(route: RouteWithOrders): RouteExportData {
  const stops = (route.route_orders || [])
    .sort((a, b) => a.sequence_number - b.sequence_number)
    .map((ro) => {
      const order = ro.orders;
      if (!order) return null;

      return {
        sequence: ro.sequence_number,
        clientName: order.client?.name || 'N/A',
        address: order.client?.address || 'N/A',
        phone: order.client?.phone || 'N/A',
        orderTotal: order.total_amount,
        items: (order.items || []).map((item) => ({
          productName: item.product?.name || 'N/A',
          quantity: item.quantity,
          price: item.unit_price,
        })),
      };
    })
    .filter((stop): stop is NonNullable<typeof stop> => stop !== null);

  return {
    routeName: route.name,
    date: route.date,
    driver: route.driver_name || 'No asignado',
    stops,
  };
}
