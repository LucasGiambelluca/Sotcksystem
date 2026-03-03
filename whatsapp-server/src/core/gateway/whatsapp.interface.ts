import { ConnectionState, WASocket } from '@whiskeysockets/baileys';

export interface IWhatsAppMessage {
    id?: string;
    text?: string;
    image?: { url: string } | Buffer;
    [key: string]: any;
}

export interface IWhatsAppGateway {
    /**
     * Initializes the connection to the WhatsApp provider.
     */
    initialize(externalEventHandler?: (update: Partial<ConnectionState>) => void): Promise<any>;

    /**
     * Sends a message to a specific number.
     * Implementations should handle rate limits and formatting.
     */
    sendMessage(to: string, content: IWhatsAppMessage): Promise<void>;

    /**
     * Closes the active session safely.
     */
    logout(): Promise<void>;

    /**
     * Completely removes authentication data (e.g. for re-linking).
     */
    clearAuth(): Promise<void>;

    /**
     * Retrieve the underlying client, mainly for internal / advanced event binding.
     * Can return null or any client type.
     */
    getSocket(): any;
}
