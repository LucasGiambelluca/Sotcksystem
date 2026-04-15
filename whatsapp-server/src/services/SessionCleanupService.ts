import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { SessionRepository } from '../infrastructure/repositories/SessionRepository';

/**
 * SessionCleanupService
 * Automatically archives inactive sessions to prevent user blockages.
 */
export class SessionCleanupService {
    private static instance: SessionCleanupService;
    private isRunning = false;
    private readonly sessionRepository = new SessionRepository();
    private readonly INACTIVITY_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
    private readonly CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

    private constructor() {}

    public static getInstance(): SessionCleanupService {
        if (!SessionCleanupService.instance) {
            SessionCleanupService.instance = new SessionCleanupService();
        }
        return SessionCleanupService.instance;
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;

        logger.info('📅 [SessionCleanup] Starting automated session cleanup worker...');
        
        // Initial check
        this.cleanup();

        // Periodic check
        setInterval(() => {
            this.cleanup();
        }, this.CHECK_INTERVAL_MS);
    }

    private async cleanup() {
        try {
            const thresholdDate = new Date(Date.now() - this.INACTIVITY_THRESHOLD_MS).toISOString();
            
            // Find active/waiting sessions that haven't been updated recently
            const { data: expiredSessions, error } = await supabase
                .from('flow_executions')
                .select('session_id')
                .in('status', ['active', 'waiting_input'])
                .lt('updated_at', thresholdDate);

            if (error) throw error;

            if (expiredSessions && expiredSessions.length > 0) {
                logger.info(`🧹 [SessionCleanup] Found ${expiredSessions.length} inactive sessions. Archiving...`);
                
                for (const sess of expiredSessions) {
                    await this.sessionRepository.archive(sess.session_id, 'inactivity_cleanup');
                }
                
                logger.info(`✅ [SessionCleanup] Archived ${expiredSessions.length} sessions.`);
            }
        } catch (err) {
            logger.error('❌ [SessionCleanup] Error during session cleanup:', err);
        }
    }
}

export const sessionCleanupService = SessionCleanupService.getInstance();
