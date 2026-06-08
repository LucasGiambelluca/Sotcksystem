import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class SlotExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        if (!engine?.slotService) {
            return { messages: ["⚠️ El servicio de horarios no está disponible ahora."], wait_for_input: false };
        }
        const slots = await engine.slotService.getAvailableSlots();
        if (!slots || slots.length === 0) {
            return { 
                messages: ["⚠️ No tenemos horarios de entrega disponibles por el momento."],
                wait_for_input: true // Pause to let user read? Or maybe go to error handler?
            };
        }

        let msg = "⏰ *Elegí tu horario de entrega:*\n\n";
        slots.forEach((s: any, i: number) => {
            msg += `${i + 1}. ${s.time_start.slice(0,5)} a ${s.time_end.slice(0,5)}\n`;
        });
        msg += "\n*Responde con el número de tu opción.*";

        return {
            messages: [msg],
            wait_for_input: true,
            updatedContext: { _temp_slots: slots }
        };
    }

    async handleInput(input: string, _data: any, context: ExecutionContext): Promise<{ updatedContext?: Partial<ExecutionContext>; messages?: string[]; isValidInput?: boolean; }> {
        const slots = (context as any)._temp_slots;
        if (!Array.isArray(slots) || slots.length === 0) {
            return { isValidInput: false, messages: ["⚠️ No hay horarios para elegir. Escribí de nuevo para ver las opciones."] };
        }
        const trimmed = String(input).trim();
        const choice = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : NaN;
        if (isNaN(choice) || choice < 1 || choice > slots.length) {
            return { isValidInput: false, messages: [`⚠️ Opción inválida. Respondé con un número del 1 al ${slots.length}.`] };
        }
        const selected = slots[choice - 1];
        return {
            isValidInput: true,
            updatedContext: {
                selected_slot_id: selected.id,
                selected_slot_label: `${(selected.time_start || '').slice(0, 5)} a ${(selected.time_end || '').slice(0, 5)}`,
                _temp_slots: null,
            },
        };
    }
}
