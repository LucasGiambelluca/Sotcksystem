import { NodeExecutor, ExecutionContext } from './types';
import { supabase } from '../../config/database';

function parseTime(timeStr: string): { hours: number; minutes: number } {
    const [h, m] = timeStr.split(':').map(Number);
    return { hours: h, minutes: m };
}

function toMinutes(hours: number, minutes: number): number {
    return hours * 60 + minutes;
}

export class BusinessHoursExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<any> {
        console.log('[BusinessHoursExecutor] ⏰ Checking business hours...');
        try {
            // 1. Load global business hours from whatsapp_config
            const { data: config, error: dbError } = await supabase
                .from('whatsapp_config')
                .select('business_hours')
                .single();

            if (dbError) {
                console.error('[BusinessHoursExecutor] ❌ DB Error:', dbError.message);
                console.error('[BusinessHoursExecutor] ⚠️  Run this SQL in Supabase SQL Editor:');
                console.error(`ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"isActive":false,"days":[1,2,3,4,5],"startTime":"09:00","endTime":"18:00","timezone":"America/Argentina/Buenos_Aires"}'::jsonb;`);
                // Fail open: if we can't read config, assume open
                return { messages: [], wait_for_input: false, conditionResult: true };
            }

            const businessHours = config?.business_hours;
            console.log('[BusinessHoursExecutor] Config:', JSON.stringify(businessHours));

            // If isActive is false/missing, treat as always open (no restriction)
            if (!businessHours || !businessHours.isActive) {
                console.log('[BusinessHoursExecutor] isActive=false → conditionResult: true (always open)');
                return { messages: [], wait_for_input: false, conditionResult: true };
            }

            const { days, startTime, endTime, timezone } = businessHours;

            // 2. Get current local time using the configured timezone
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone || 'America/Argentina/Buenos_Aires',
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            });

            const parts = formatter.formatToParts(now);
            const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
            const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? '';
            const hourStr   = parts.find(p => p.type === 'hour')?.value ?? '0';
            const minuteStr = parts.find(p => p.type === 'minute')?.value ?? '0';

            const currentDay = weekdayMap[weekdayStr] ?? now.getDay();
            const currentMinutes = toMinutes(parseInt(hourStr, 10), parseInt(minuteStr, 10));

            const start = parseTime(startTime || '09:00');
            const end   = parseTime(endTime   || '18:00');
            const startMinutes = toMinutes(start.hours, start.minutes);
            const endMinutes   = toMinutes(end.hours,   end.minutes);

            const isDayOpen  = (days as number[]).includes(currentDay);
            const isTimeOpen = currentMinutes >= startMinutes && currentMinutes < endMinutes;
            const isOpen     = isDayOpen && isTimeOpen;

            console.log(`[BusinessHoursExecutor] 📅 day=${weekdayStr}(${currentDay}) time=${hourStr}:${minuteStr}(${currentMinutes}min)`);
            console.log(`[BusinessHoursExecutor] 🕐 window=${startTime}(${startMinutes})-${endTime}(${endMinutes}) openDays=[${days}]`);
            console.log(`[BusinessHoursExecutor] 🏪 isDayOpen=${isDayOpen} isTimeOpen=${isTimeOpen} → ${isOpen ? '✅ OPEN' : '❌ CLOSED'}`);

            return {
                messages: [],
                wait_for_input: false,
                conditionResult: isOpen,
            };
        } catch (err: any) {
            console.error('[BusinessHoursExecutor] ❌ Unexpected error:', err?.message || err);
            return { messages: [], wait_for_input: false, conditionResult: true };
        }
    }
}
