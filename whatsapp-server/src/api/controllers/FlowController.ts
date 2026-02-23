import { Request, Response } from 'express';
import { supabase } from '../../config/database'; // We need to ensure this is exported or import directly from @supabase/supabase-js if using direct client
// Wait, database.js exports { supabase }. We should check if it's TS compatible if we import it.
// database.js is JS. We can import it using require in TS or allowJS.
// Let's assume we can import it.

export class FlowController {
    async list(req: Request, res: Response) {
        const { data, error } = await supabase
            .from('flows')
            .select('id, name, trigger_word, is_active, is_default, created_at')
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ success: false, error: error.message });
        res.json({ success: true, data });
    }

    async get(req: Request, res: Response) {
        const { data, error } = await supabase
            .from('flows')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) return res.status(404).json({ success: false, error: 'Flow not found' });
        res.json({ success: true, data });
    }

    async create(req: Request, res: Response) {
        const { name, description, trigger_word, trigger_type, nodes, edges, viewport } = req.body;
        
        const { data, error } = await supabase
            .from('flows')
            .insert({
                name,
                description,
                trigger_word,
                trigger_type,
                nodes: nodes || [],
                edges: edges || [],
                viewport: viewport || {}
            })
            .select()
            .single();

        if (error) return res.status(400).json({ success: false, error: error.message });
        res.status(201).json({ success: true, data });
    }

    async update(req: Request, res: Response) {
        const { id } = req.params;
        const updates = req.body;
        
        const { data, error } = await supabase
            .from('flows')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(400).json({ success: false, error: error.message });
        res.json({ success: true, data });
    }

    async delete(req: Request, res: Response) {
        const { error } = await supabase
            .from('flows')
            .delete()
            .eq('id', req.params.id);

        if (error) return res.status(500).json({ success: false, error: error.message });
        res.json({ success: true });
    }

    async toggleActive(req: Request, res: Response) {
        const { id } = req.params;
        const { is_active } = req.body;

        const { data, error } = await supabase
            .from('flows')
            .update({ is_active })
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(400).json({ success: false, error: error.message });
        res.json({ success: true, data });
    }
}
