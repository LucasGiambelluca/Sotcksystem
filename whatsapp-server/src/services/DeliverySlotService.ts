import { supabase } from '../config/database';
import { addMinutes, format, isBefore, startOfDay, addDays, parse } from 'date-fns';
import { es } from 'date-fns/locale';

export interface DeliverySlot {
    id: string;
    date: string;
    time_start: string;
    time_end: string;
    max_orders: number;
    orders_count: number;
    is_available: boolean;
    remaining?: number;
    display?: string;
    version?: number;
}

export class DeliverySlotService {
    private readonly DEFAULT_SLOT_DURATION = 30; // minutos
    private readonly DEFAULT_CUTOFF = 30; // minutos antes del inicio del slot para permitir pedidos
    private db: any;

    constructor(dbClient?: any) {
        this.db = dbClient || supabase;
    }

    /**
     * Genera franjas horarias para los próximos días según la configuración.
     */
    async generateSlots(daysAhead: number = 2): Promise<void> {
        const today = startOfDay(new Date());

        for (let i = 0; i < daysAhead; i++) {
            const date = addDays(today, i);
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayOfWeek = date.getDay(); // 0 = domingo en JS

            const operatingHours = this.getOperatingHours(dayOfWeek);

            for (const { start, end, capacity } of operatingHours) {
                let currentStartTime = parse(start, 'HH:mm', date);
                const limitEndTime = parse(end, 'HH:mm', date);

                while (isBefore(currentStartTime, limitEndTime)) {
                    const slotEnd = addMinutes(currentStartTime, this.DEFAULT_SLOT_DURATION);
                    const timeStartStr = format(currentStartTime, 'HH:mm:ss');
                    const timeEndStr = format(slotEnd, 'HH:mm:ss');

                    // Verificar si ya existe para no duplicar
                    const { data: existing } = await this.db
                        .from('delivery_slots')
                        .select('id')
                        .eq('date', dateStr)
                        .eq('time_start', timeStartStr)
                        .maybeSingle();

                    if (!existing) {
                        await this.db.from('delivery_slots').insert({
                            date: dateStr,
                            time_start: timeStartStr,
                            time_end: timeEndStr,
                            max_orders: capacity,
                            cut_off_minutes: this.DEFAULT_CUTOFF
                        });
                    }

                    currentStartTime = slotEnd;
                }
            }
        }
    }

    /**
     * Obtiene los slots disponibles para mostrar al cliente.
     */
    async getAvailableSlots(maxResults: number = 6): Promise<DeliverySlot[]> {
        const now = new Date();
        const dateStr = format(now, 'yyyy-MM-dd');
        const timeLimit = format(addMinutes(now, this.DEFAULT_CUTOFF), 'HH:mm:ss');

        const { data, error } = await this.db
            .from('delivery_slots')
            .select('*')
            .or(`date.gt.${dateStr},and(date.eq.${dateStr},time_start.gt.${timeLimit})`)
            .eq('is_available', true)
            .order('date', { ascending: true })
            .order('time_start', { ascending: true })
            .limit(maxResults);

        if (error) {
            console.error('[DeliverySlotService] Error fetching slots:', error);
            return [];
        }

        return (data || []).map(slot => ({
            ...slot,
            remaining: slot.max_orders - slot.orders_count,
            display: this.formatSlotDisplay(new Date(slot.date + 'T00:00:00'), slot.time_start, slot.time_end)
        })).filter(s => (s.remaining || 0) > 0);
    }

    /**
     * Reserva un slot (incrementa el contador de pedidos).
     * Nota: En una implementación ideal, esto debería ser parte de una transacción RPC 
     * en Supabase para asegurar atomicidad. Para esta versión, lo hacemos directo.
     */
    /**
     * Reserva un slot usando Locking Optimista.
     * Intenta incrementar el contador solo si la versión coincide.
     */
    async reserveSlot(slotId: string): Promise<boolean> {
        const MAX_RETRIES = 3;
        let attempt = 0;

        while (attempt < MAX_RETRIES) {
            // 1. Fetch current state
            const { data: slot, error: fetchError } = await this.db
                .from('delivery_slots')
                .select('id, orders_count, max_orders, version')
                .eq('id', slotId)
                .single();

            if (fetchError || !slot) {
                console.error("Error fetching slot:", fetchError);
                return false;
            }

            // 2. Validate capacity
            if (slot.orders_count >= slot.max_orders) {
                console.log(`[SlotService] Slot ${slotId} is full.`);
                return false;
            }

            // 3. Attempt Atomic Update with Version Check
            const nextVersion = (slot.version || 0) + 1;
            const { data: updated, error: updateError } = await this.db
                .from('delivery_slots')
                .update({ 
                    orders_count: slot.orders_count + 1,
                    version: nextVersion
                })
                .eq('id', slotId)
                .eq('version', slot.version || 0) // OPTIMISTIC LOCK
                .select(); // Return data to confirm update

            if (!updateError && updated && updated.length > 0) {
                console.log(`[SlotService] Slot ${slotId} reserved successfully (v${nextVersion}).`);
                return true;
            }

            // If we get here, the update failed due to version mismatch (concurrency)
            console.warn(`[SlotService] Optimistic lock collision on slot ${slotId}. Retrying...`);
            attempt++;
            
            // Random jitter delay before retry
            await new Promise(r => setTimeout(r, Math.random() * 200 + 100));
        }

        console.error(`[SlotService] Failed to reserve slot ${slotId} after ${MAX_RETRIES} attempts.`);
        return false;
    }

    /**
     * Libera un cupo en un slot (ej: cancelación).
     */
    async releaseSlot(slotId: string): Promise<void> {
        const { data: slot } = await this.db
            .from('delivery_slots')
            .select('orders_count')
            .eq('id', slotId)
            .single();

        if (slot && slot.orders_count > 0) {
            await this.db
                .from('delivery_slots')
                .update({ orders_count: slot.orders_count - 1 })
                .eq('id', slotId);
        }
    }

    private formatSlotDisplay(date: Date, start: string, end: string): string {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const targetStr = format(date, 'yyyy-MM-dd');
        const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

        let dayLabel = format(date, 'EEEE d', { locale: es });
        if (targetStr === todayStr) dayLabel = 'Hoy';
        else if (targetStr === tomorrowStr) dayLabel = 'Mañana';

        return `${dayLabel}, ${start.substring(0, 5)} - ${end.substring(0, 5)}`;
    }

    private getOperatingHours(dayOfWeek: number) {
        // 0 = Domingo, 6 = Sábado
        const defaultHours = [
            { start: '11:00', end: '15:00', capacity: 5 }, // Almuerzo
            { start: '19:00', end: '23:30', capacity: 10 } // Cena
        ];

        // Fines de semana con más capacidad
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return [
                { start: '11:00', end: '16:00', capacity: 8 },
                { start: '19:00', end: '00:30', capacity: 15 }
            ];
        }

        return defaultHours;
    }
}

export default new DeliverySlotService();
