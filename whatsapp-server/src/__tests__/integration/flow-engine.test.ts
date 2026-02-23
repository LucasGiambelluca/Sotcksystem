import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { FlowEngine } from '../../core/engine/flow.engine';
import { OrderService } from '../../services/OrderService';
import { DeliverySlotService } from '../../services/DeliverySlotService';
import { testSupabase, cleanDatabase, closeConnections } from '../setup';

describe('FlowEngine Integration', () => {
    let flowEngine: FlowEngine;
    let orderService: OrderService;
    let slotService: DeliverySlotService;

    beforeEach(async () => {
        slotService = new DeliverySlotService(testSupabase);
        orderService = new OrderService(testSupabase, slotService);
        flowEngine = new FlowEngine(testSupabase, orderService, slotService);
        
        await cleanDatabase();

        // Seed a basic flow
        const flowData = {
            name: "Test Flow",
            trigger_word: "hola",
            is_active: true,
            nodes: [
                { id: "start", type: "input", data: { label: "Inicio" } },
                { id: "msg_1", type: "messageNode", data: { text: "¡Hola! ¿Cómo estás?" } },
                { id: "q_name", type: "questionNode", data: { question: "¿Cuál es tu nombre?", variable: "nombre" } },
                { id: "cat_1", type: "catalogNode", data: {} }
            ],
            edges: [
                { id: "e1", source: "start", target: "msg_1" },
                { id: "e2", source: "msg_1", target: "q_name" },
                { id: "e3", source: "q_name", target: "cat_1" }
            ]
        };

        await testSupabase.from('flows').insert(flowData);
        
        // Seed products for catalogNode
        await testSupabase.from('products').insert([
            { name: 'Hamburguesa', price: 1000, stock: 10, category: 'Comida' },
            { name: 'Agua', price: 500, stock: 20, category: 'Bebida' }
        ]);
    });

    afterAll(async () => {
        await closeConnections();
    });

    it('debe iniciar un flujo y responder con el primer mensaje y la primera pregunta', async () => {
        const phone = '1234567890';
        const response = await flowEngine.processMessage(phone, 'hola');
        
        expect(response).toBeDefined();
        const template = response.currentStateDefinition.message_template;
        
        expect(template).toContain('¡Hola! ¿Cómo estás?');
        expect(template).toContain('¿Cuál es tu nombre?');
    });

    it('debe capturar la respuesta de una pregunta y continuar al siguiente nodo', async () => {
        const phone = '1234567891';
        
        // 1. Iniciar flujo
        await flowEngine.processMessage(phone, 'hola');
        
        // 2. Responder a la pregunta de nombre
        const response = await flowEngine.processMessage(phone, 'Lucas');
        
        const template = response.currentStateDefinition.message_template;
        
        // Debería mostrar el catálogo (catalogNode)
        expect(template).toContain('NUESTRO MENÚ');
        expect(template).toContain('Hamburguesa');
        expect(template).toContain('Agua');

        // Verificar que el nombre se guardó en el contexto
        const { data: execution } = await testSupabase
            .from('flow_executions')
            .select('context')
            .eq('phone', phone)
            .single();
        
        expect(execution?.context.nombre).toBe('Lucas');
    });
});
