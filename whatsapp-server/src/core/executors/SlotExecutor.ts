import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class SlotExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
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
}
