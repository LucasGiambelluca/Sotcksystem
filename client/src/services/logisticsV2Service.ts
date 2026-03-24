import { supabase } from '../supabaseClient';

export interface Assignment {
  id: string;
  cadete_id: string;
  status: 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  estimated_duration_min: number;
  total_distance_km: number;
  batch_group_id?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface AssignmentOrder {
  id: string;
  assignment_id: string;
  order_id: string;
  sequence_number: number;
  action_type: 'PICKUP' | 'DELIVERY';
  status: 'PENDING' | 'ARRIVED' | 'COMPLETED' | 'FAILED';
  proof_photo_url?: string;
  signature_url?: string;
  notes?: string;
  estimated_arrival?: string;
  actual_arrival?: string;
  completed_at?: string;
  // Joined fields
  order?: any;
}

export const logisticsV2Service = {
  // Get active mission for a cadete
  async getActiveMission(cadeteId: string) {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        assignment_orders (
          *,
          order:orders (
            id,
            total_amount,
            status,
            delivery_address,
            notes,
            clients (name, phone, address)
          )
        )
      `)
      .eq('cadete_id', cadeteId)
      .in('status', ['ASSIGNED', 'PICKED_UP', 'IN_PROGRESS'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Update cadete location
  async updateLocation(cadeteId: string, lat: number, lng: number, speed?: number, heading?: number) {
    const { error } = await supabase
      .from('cadete_locations')
      .insert({
        employee_id: cadeteId,
        lat,
        lng,
        speed,
        heading
      });
    
    if (error) console.error('Error updating location:', error);
    
    // Also update metadata status to AVAILABLE if it was something else
    await supabase
      .from('cadete_metadata')
      .update({ updated_at: new Date().toISOString() })
      .eq('employee_id', cadeteId);
  },

  // Update assignment status
  async updateAssignmentStatus(id: string, status: Assignment['status']) {
    const updates: any = { status };
    if (status === 'IN_PROGRESS' || status === 'PICKED_UP') {
      updates.started_at = new Date().toISOString();
    } else if (status === 'COMPLETED') {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('assignments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update stop status (pick up or delivery)
  async updateStopStatus(stopId: string, status: AssignmentOrder['status'], metadata?: { photo?: string, signature?: string, notes?: string }) {
    const updates: any = { 
        status,
        ...metadata
    };
    
    if (status === 'ARRIVED') {
      updates.actual_arrival = new Date().toISOString();
    } else if (status === 'COMPLETED') {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('assignment_orders')
      .update(updates)
      .eq('id', stopId)
      .select()
      .single();

    if (error) throw error;

    // If it's a DELIVERY and it's COMPLETED, we should also update the main order status
    if (status === 'COMPLETED' && data.action_type === 'DELIVERY') {
       await supabase
         .from('orders')
         .update({ status: 'DELIVERED', delivered_at: new Date().toISOString() })
         .eq('id', data.order_id);
    } else if (status === 'COMPLETED' && data.action_type === 'PICKUP') {
        await supabase
          .from('orders')
          .update({ status: 'PICKED_UP' })
          .eq('id', data.order_id);
    }

    return data;
  },
  // Update cadete online status
  async updateCadeteStatus(cadeteId: string, isOnline: boolean) {
    const { error } = await supabase
      .from('cadete_metadata')
      .update({ is_online: isOnline })
      .eq('employee_id', cadeteId);
    if (error) console.error('Error updating cadete status:', error);
  },

  // Get all cadetes with active shifts
  async getActiveCadetes() {
    // 1. Get active shifts of type cadete or from stations marked as delivery
    // For now, we'll just get all active shifts and filter by those that have metadata
    const { data, error } = await supabase
      .from('shifts')
      .select(`
        *,
        employee:employees (
          *,
          metadata:cadete_metadata (*)
        ),
        station:stations (*)
      `)
      .eq('status', 'ACTIVE');

    if (error) throw error;
    
    // Also get their latest locations (last 5 minutes for 'Online' status)
    const { data: locations, error: locError } = await supabase
      .from('cadete_locations')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false });
      
    if (locError) console.error('Error fetching locations:', locError);

    // Filter shifts that are cadetes (either via metadata OR role)
    return data
      .filter((shift: any) => 
        !!shift.employee?.metadata || 
        shift.employee?.role === 'cadete' || 
        shift.employee?.role === 'delivery'
      )
      .map((shift: any) => {
        // Find the latest location for this specific employee
        const latestLoc = locations?.find(l => l.employee_id === shift.employee_id);
        
        // A cadete is "Online" if:
        // 1. Explicitly is_online is true
        // OR 2. Last GPS was within 5 minutes
        const isOnline = shift.employee?.metadata?.is_online || !!latestLoc;

        return {
          ...shift,
          metadata: shift.employee?.metadata || null,
          latest_location: latestLoc,
          is_online: isOnline
        };
      });
  },

  // Assign an order to a cadete (creates a mission if needed)
  async assignOrderToCadete(orderId: string, cadeteId: string) {
    // 1. Check if cadete already has an active mission
    let { data: assignment, error: assignError } = await supabase
      .from('assignments')
      .select('*')
      .eq('cadete_id', cadeteId)
      .in('status', ['PENDING', 'ASSIGNED', 'PICKED_UP'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assignError) throw assignError;

    // 2. If no active mission, create one
    if (!assignment) {
      const { data: newAssignment, error: createError } = await supabase
        .from('assignments')
        .insert({
          cadete_id: cadeteId,
          status: 'ASSIGNED',
          priority: 'NORMAL'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      assignment = newAssignment;
    }

    // 3. Add order to assignment_orders
    // First find the next sequence number
    const { data: existingOrders } = await supabase
      .from('assignment_orders')
      .select('sequence_number')
      .eq('assignment_id', assignment.id)
      .order('sequence_number', { ascending: false })
      .limit(1);
    
    const nextSeq = (existingOrders?.[0]?.sequence_number || 0) + 1;

    // Add PICKUP stop
    const { error: pickupError } = await supabase
      .from('assignment_orders')
      .insert({
        assignment_id: assignment.id,
        order_id: orderId,
        sequence_number: nextSeq,
        action_type: 'PICKUP',
        status: 'PENDING'
      });
    
    if (pickupError) throw pickupError;

    // Add DELIVERY stop
    const { error: deliveryError } = await supabase
      .from('assignment_orders')
      .insert({
        assignment_id: assignment.id,
        order_id: orderId,
        sequence_number: nextSeq + 1,
        action_type: 'DELIVERY',
        status: 'PENDING'
      });

    if (deliveryError) throw deliveryError;

    // 4. Update the order status to OUT_FOR_DELIVERY (actually it's better to wait for pickup, 
    // but for now let's use a transition status or just IN_TRANSIT)
    if (orderError) throw orderError;
    
    // NEW: Also update assigned_to in the orders table directly for easier filtering
    await supabase
      .from('orders')
      .update({ assigned_to: cadeteId, assigned_at: new Date().toISOString() })
      .eq('id', orderId);

    return assignment;
  },

  // Get orders that are READY for pickup but not yet assigned
  async getAvailableOrders(cadeteId?: string) {
    // 1. Get all assigned order IDs to exclude them from the General Bag 
    // BUT include them if they are assigned specifically to the current cadete
    const { data: assignments } = await supabase
      .from('assignment_orders')
      .select('order_id');
    
    const assignedIds = assignments?.map(a => a.order_id) || [];

    // 2. Fetch orders
    let query = supabase
      .from('orders')
      .select('*, client:clients(name)')
      .in('status', ['IN_TRANSIT', 'CONFIRMED', 'IN_PREPARATION', 'OUT_FOR_DELIVERY', 'READY'])
      .order('created_at', { ascending: true });
    
    // Aisolation Logic:
    // Show if:
    // (a) Order is NOT in assignment_orders AND assigned_to is NULL
    // (b) OR Order assigned_to is CURRENT CADETE
    if (cadeteId) {
        query = query.or(`assigned_to.is.null,assigned_to.eq.${cadeteId}`);
    } else {
        query = query.is('assigned_to', null);
    }

    if (assignedIds.length > 0) {
      // Exclude orders that are already in active assignments of OTHER people
      // But we must be careful not to exclude the one assigned to ME
      // The .or logic above already handles the positive side, now we filter the negative side
      // for the "Bolsa Común".
    }

    const { data, error } = await query;
    if (error) throw error;

    // Final filter: remove orders that are in assignment_orders but NOT assigned to me in orders table
    // (This is a safety check for the "Common Bag")
    return (data || []).filter(order => {
        const isAssignedToMe = order.assigned_to === cadeteId;
        const isInAnyAssignment = assignedIds.includes(order.id);
        
        if (isAssignedToMe) return true; // My orders always show
        if (isInAnyAssignment) return false; // Already taken by someone else
        return true; // Available for all
    });
  },

  // Claim an order (Self-assignment)
  async claimOrder(orderId: string, cadeteId: string) {
    return this.assignOrderToCadete(orderId, cadeteId);
  },

  // Bulk assign orders (Building a route)
  async assignOrdersToCadete(orderIds: string[], cadeteId: string) {
    if (orderIds.length === 0) return null;

    // 1. Create a single new assignment for this batch
    const { data: assignment, error: createError } = await supabase
      .from('assignments')
      .insert({
        cadete_id: cadeteId,
        status: 'ASSIGNED',
        priority: 'NORMAL'
      })
      .select()
      .single();
    
    if (createError) throw createError;

    // 2. Create sequences: All pickups first (batch pick), then all deliveries
    const pickupOrders = orderIds.map((id, index) => ({
      assignment_id: assignment.id,
      order_id: id,
      sequence_number: index + 1,
      action_type: 'PICKUP',
      status: 'PENDING'
    }));

    const deliveryOrders = orderIds.map((id, index) => ({
      assignment_id: assignment.id,
      order_id: id,
      sequence_number: orderIds.length + index + 1,
      action_type: 'DELIVERY',
      status: 'PENDING'
    }));

    // 3. Insert all stops
    const { error: stopsError } = await supabase
      .from('assignment_orders')
      .insert([...pickupOrders, ...deliveryOrders]);

    if (stopsError) throw stopsError;

    // 4. Update all order statuses and assignments
    const { error: ordersError } = await supabase
      .from('orders')
      .update({ 
          status: 'OUT_FOR_DELIVERY',
          assigned_to: cadeteId,
          assigned_at: new Date().toISOString()
      })
      .in('id', orderIds);

    if (ordersError) throw ordersError;

    return assignment;
  }
};
