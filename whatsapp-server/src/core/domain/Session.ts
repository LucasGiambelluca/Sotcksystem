export interface SessionContext {
  // Strict namespace by flow
  variables: {
    [flowId: string]: {
      [key: string]: any;
    };
    global: {
      userName?: string;
      phoneNumber: string;
      chatJid: string;
      startedAt: string;
      [key: string]: any;
    };
    // Shared variables across all flows (Phase 3)
    shared?: {
      [key: string]: any;
    };
  };
  
  // Interaction history (for debugging)
  interactionLog: Array<{
    nodeId: string;
    input?: string;
    output?: string;
    timestamp: string;
    executionTimeMs: number;
    jobId?: string;
  }>;
  
  // Flow metadata
  metadata: {
    flowId: string;
    flowVersion: number;
    entryPoint: 'trigger' | 'handover' | 'catalog' | 'manual';
    parentSessionId?: string;
    expiresAt?: Date;
    conversationalState?: string;
  };
}

export class Session {
  constructor(
    public readonly id: string, // This is the business session_id (e.g. 1to1:...)
    public readonly userPhone: string,
    public readonly chatJid: string,
    private context: SessionContext,
    public currentNodeId: string,
    public status: 'active' | 'waiting_input' | 'paused' | 'completed' | 'error' | 'archived',
    public lastActivity: Date,
    public readonly version: number = 0,
    public readonly createdAt: Date = new Date(),
    public readonly uuid?: string // DB Primary Key
  ) {}

  // Safe access to variables (prevents leakage between flows)
  getVariable(key: string, namespace?: string): any {
    const ns = namespace || this.context.metadata.flowId;
    return this.context.variables[ns]?.[key] ?? 
           this.context.variables['global']?.[key];
  }

  setVariable(key: string, value: any, namespace?: string): void {
    const ns = namespace || this.context.metadata.flowId;
    if (!this.context.variables[ns]) {
      this.context.variables[ns] = {};
    }
    this.context.variables[ns][key] = value;
    this.touch();
  }

  setGlobalVariable(key: string, value: any): void {
    if (!this.context.variables.shared) {
      this.context.variables.shared = {};
    }
    this.context.variables.shared[key] = value;
    this.touch();
  }

  // Prevent context leakage
  getAllVariablesForCurrentFlow(): Record<string, any> {
    return {
      ...this.context.variables['global'],
      ...this.context.variables.shared || {},
      ...this.context.variables[this.context.metadata.flowId] || {}
    };
  }

  logInteraction(nodeId: string, input?: string, output?: string, execTime?: number, jobId?: string): void {
    this.context.interactionLog.push({
      nodeId,
      input: input?.substring(0, 500),
      output: output?.substring(0, 500),
      timestamp: new Date().toISOString(),
      executionTimeMs: execTime || 0,
      jobId
    });
    this.touch();
  }

  public getContext(): SessionContext {
      return this.context;
  }

  private touch(): void {
    this.lastActivity = new Date();
  }

  toJSON(): any {
    return {
      session_id: this.id,
      phone: this.userPhone,
      current_node_id: this.currentNodeId,
      status: this.status,
      context: this.context,
      last_activity: this.lastActivity.toISOString(),
      version: this.version,
      flow_id: this.context.metadata.flowId,
      expires_at: this.context.metadata.expiresAt instanceof Date 
        ? this.context.metadata.expiresAt.toISOString() 
        : (typeof this.context.metadata.expiresAt === 'string' ? this.context.metadata.expiresAt : null),
      global_variables: this.context.variables.shared || {}
    };
  }

  static fromJSON(data: any): Session {
    if (!data) throw new Error('Cannot create Session from null/undefined data');
    const context = data.context || { 
      variables: { 
        global: {}, 
        [data.flow_id || 'unknown']: {},
        shared: data.global_variables || {}
      }, 
      interactionLog: [], 
      metadata: { 
        flowId: data.flow_id || 'unknown', 
        flowVersion: 1, 
        entryPoint: 'trigger',
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined
      } 
    };

    // 2. Ensure Date objects
    if (context.metadata.expiresAt && typeof context.metadata.expiresAt === 'string') {
        context.metadata.expiresAt = new Date(context.metadata.expiresAt);
    }

    // Ensure shared exists if it came from data.global_variables separately
    if (data.global_variables && !context.variables.shared) {
        context.variables.shared = data.global_variables;
    }

    return new Session(
      data.session_id,
      data.phone || data.user_phone,
      data.phone || data.chat_jid,
      context,
      data.current_node_id,
      data.status,
      new Date(data.last_activity || data.updated_at || Date.now()),
      data.version || 0,
      new Date(data.created_at || Date.now()),
      data.id // The UUID primary key
    );
  }

  getConversationalState(): string {
    return this.context.metadata.conversationalState || 'IDLE';
  }

  setConversationalState(state: string): void {
    this.context.metadata.conversationalState = state;
    this.touch();
  }
}
