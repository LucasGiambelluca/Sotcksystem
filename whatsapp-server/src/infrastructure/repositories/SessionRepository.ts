import { supabase } from '../../config/database';
import { Session, SessionContext } from '../../core/domain/Session';

export class SessionRepository {
  private readonly TABLE = 'flow_executions';
  private readonly HISTORY_TABLE = 'flow_executions_history';

  /**
   * Get or create session - ATOMIC
   */
  async getOrCreate(
    sessionId: string, 
    userPhone: string, 
    flowId: string,
    initialContext?: Partial<SessionContext>,
    startNodeId: string = 'start'
  ): Promise<Session> {
    const finalSessionId = sessionId.replace('@s.whatsapp.net', '').replace('@c.us', '');

    // 1. Try to find existing active session
    const { data: existingData } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('session_id', finalSessionId)
      .in('status', ['active', 'waiting_input'])
      .order('updated_at', { ascending: false })
      .limit(1);
    
    const existing = existingData && existingData.length > 0 ? existingData[0] : null;

    if (existing) {
      const session = Session.fromJSON(existing);
      
      // Check expiration (optional, 30 min in the plan)
      const expirationMs = 30 * 60 * 1000;
      if (Date.now() - session.lastActivity.getTime() > expirationMs) {
        console.log(`[SessionRepo] Archiving expired session: ${finalSessionId}`);
        await this.archive(finalSessionId, 'expired');
        return this.createNew(finalSessionId, userPhone, flowId, initialContext, startNodeId);
      }
      
      return session;
    }

    return this.createNew(finalSessionId, userPhone, flowId, initialContext, startNodeId);
  }

  /**
   * Create new session with clean context
   */
  private async createNew(
    sessionId: string,
    userPhone: string,
    flowId: string,
    initialContext?: Partial<SessionContext>,
    startNodeId: string = 'start'
  ): Promise<Session> {
    const context: SessionContext = {
      variables: {
        global: {
          phoneNumber: userPhone,
          chatJid: sessionId.includes(':') ? sessionId.split(':')[1] : userPhone,
          startedAt: new Date().toISOString(),
          ...(initialContext?.variables?.global || {})
        },
        [flowId]: initialContext?.variables?.[flowId] || {}
      },
      interactionLog: [],
      metadata: {
        flowId,
        flowVersion: 1,
        entryPoint: (initialContext?.metadata?.entryPoint as any) || 'trigger',
        expiresAt: initialContext?.metadata?.expiresAt || (() => {
            const date = new Date();
            date.setHours(date.getHours() + 2); // Default 2h
            return date;
        })()
      }
    };

    const session = new Session(
      sessionId,
      userPhone,
      userPhone, // chatJid usage is simplified
      context,
      startNodeId, // Use the provided start node
      'active',
      new Date(),
      0 // initial version
    );

    const { data: created, error } = await supabase
      .from(this.TABLE)
      .insert(session.toJSON())
      .select()
      .single();

    if (error) {
      // Race condition: if session was created between lookup and insert
      if (error.code === '23505') {
          console.warn(`[SessionRepo] Race condition detected during create for ${sessionId}. Retrying getOrCreate.`);
          return this.getOrCreate(sessionId, userPhone, flowId, initialContext);
      }
      console.error('[SessionRepo] Error creating session:', error);
      throw error;
    }

    return Session.fromJSON(created);
  }

  /**
   * Atomic update with Optimistic Locking
   */
  async update(session: Session): Promise<void> {
    const currentVersion = session.version;
    const nextVersion = currentVersion + 1;
    
    // Normalize: ensure we don't have suffix in session_id if it's 1to1
    const finalSessionId = session.id.replace('@s.whatsapp.net', '').replace('@c.us', '');

    const updateData = {
        ...session.toJSON(),
        session_id: finalSessionId,
        version: nextVersion,
        updated_at: new Date().toISOString()
    };

    // Use primary key UUID if we have it, otherwise fallback to session_id (ambiguous)
    const query = supabase
      .from(this.TABLE)
      .update(updateData)
      .eq('version', currentVersion);

    if (session.uuid) {
      query.eq('id', session.uuid);
    } else {
      query.eq('session_id', finalSessionId);
    }

    const { data, error } = await query.select();

    if (error) {
        console.error('[SessionRepo] Error updating session:', error);
        throw error;
    }
    
    if (!data || data.length === 0) {
      throw new Error(`CONCURRENCY_CONFLICT: Session ${session.id} was modified by another process (version mismatch).`);
    }
    
    // Update local version if needed (instance usually discarded after turn)
  }

  /**
   * Archive session by ID - Efficient
   */
  async archive(sessionId: string, reason: string): Promise<void> {
    const finalSessionId = sessionId.replace('@s.whatsapp.net', '').replace('@c.us', '');
    const { data: sessions } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('session_id', finalSessionId)
      .in('status', ['active', 'waiting_input']);

    if (!sessions || sessions.length === 0) return;
    await this.archiveAll(sessions, reason);
  }

  /**
   * Bulk archive for performance
   */
  private async archiveAll(sessions: any[], reason: string): Promise<void> {
    if (sessions.length === 0) return;

    const historyRows = sessions.map(s => ({
      original_id: s.id,
      flow_id: s.flow_id,
      phone: s.phone,
      session_id: s.session_id,
      current_node_id: s.current_node_id,
      status: s.status,
      context: s.context,
      started_at: s.started_at,
      last_activity: s.last_activity,
      completed_at: new Date().toISOString(),
      archived_reason: reason,
      version: s.version
    }));

    // Batch insert into history
    const { error: histError } = await supabase.from(this.HISTORY_TABLE).insert(historyRows);
    if (histError) console.error('[SessionRepo] Error inserting batch history:', histError);

    // Batch update main table
    const ids = sessions.map(s => s.id);
    const { error: updError } = await supabase
      .from(this.TABLE)
      .update({ status: 'archived', archived_reason: reason })
      .in('id', ids);
    if (updError) console.error('[SessionRepo] Error updating batch status:', updError);
  }

  /**
   * Force reset for a specific user - Now extremely fast
   */
  async forceReset(phoneNumber: string): Promise<number> {
    const { data: sessions, error } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('phone', phoneNumber)
      .in('status', ['active', 'waiting_input']);

    if (error || !sessions || sessions.length === 0) return 0;

    await this.archiveAll(sessions, 'user_reset');
    return sessions.length;
  }

  /**
   * Update session context by merging new variables
   */
  async updateContext(sessionId: string, newVariables: any): Promise<void> {
    const finalSessionId = sessionId.replace('@s.whatsapp.net', '').replace('@c.us', '');
    
    // 1. Get current session
    const { data: existing } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('session_id', finalSessionId)
      .in('status', ['active', 'waiting_input'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!existing) return;

    // 2. Merge context
    const currentContext = existing.context || { variables: { global: {} } };
    const updatedContext = {
      ...currentContext,
      variables: {
        ...currentContext.variables,
        global: {
          ...currentContext.variables?.global,
          ...newVariables
        }
      }
    };

    // 3. Update
    await supabase
      .from(this.TABLE)
      .update({ 
        context: updatedContext,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  }
}
