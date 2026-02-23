
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ error: 'Missing authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        
        // Verify token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.error('[Auth] Token verification failed:', error?.message);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        console.error('[Auth] Middleware error:', error);
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
};
