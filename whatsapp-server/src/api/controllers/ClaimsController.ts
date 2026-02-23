
import { Request, Response } from 'express';
import { supabase } from '../../config/database';

export class ClaimsController {
    
    // List claims (with filtering)
    async list(req: Request, res: Response) {
        try {
            const { status, type } = req.query;
            let query = supabase
                .from('claims')
                .select(`
                    *,
                    client:clients (name, phone)
                `)
                .order('created_at', { ascending: false });

            if (status && status !== 'all') {
                query = query.eq('status', status);
            }
            if (type && type !== 'all') {
                query = query.eq('type', type);
            }

            const { data, error } = await query;
            if (error) throw error;

            res.json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Get single claim
    async get(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { data, error } = await supabase
                .from('claims')
                .select(`
                    *,
                    client:clients (name, phone)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            res.json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Create claim (Manual or from API)
    async create(req: Request, res: Response) {
        try {
            const { client_id, type, description, priority, metadata } = req.body;
            
            const { data, error } = await supabase
                .from('claims')
                .insert({
                    client_id,
                    type,
                    description,
                    priority,
                    metadata: metadata || {},
                    status: 'open'
                })
                .select()
                .single();

            if (error) throw error;
            res.status(201).json({ success: true, data });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }

    // Update claim status/notes
    async update(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const updates = req.body; // status, priority, metadata, description?
            
            const { data, error } = await supabase
                .from('claims')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            res.json({ success: true, data });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
}
