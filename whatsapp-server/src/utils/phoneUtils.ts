import { logger } from './logger';

/**
 * Centralized utility for handling WhatsApp identifiers (JIDs),
 * phone numbers, and Linked Identities (LID).
 */
export class PhoneUtils {
    /**
     * Normalizes a phone number or JID to a "clean" format.
     * - Preserves @lid if present.
     * - Strips suffixes like @s.whatsapp.net, @c.us, @g.us.
     * - Strips all non-digit characters unless it's a LID.
     */
    static normalize(phone: string): string {
        if (!phone) return '';
        
        // If it's a LID, preserve it as is (after trimming)
        if (phone.includes('@lid')) {
            return phone.trim();
        }

        // Strip known suffixes
        let clean = phone
            .replace('@s.whatsapp.net', '')
            .replace('@c.us', '')
            .replace('@g.us', '')
            .trim();

        // If it still has an '@' but not '@lid', it might be a weird JID or group
        if (clean.includes('@')) {
            return clean;
        }

        // Standard phone number: strip everything except digits
        return clean.replace(/[^0-9]/g, '');
    }

    /**
     * Builds a full JID from a normalized phone string.
     */
    static toJid(phone: string): string {
        if (!phone) return '';
        if (phone.includes('@')) return phone; // Already a JID
        
        // If it looks like a group ID (digits-digits)
        if (phone.includes('-')) {
            return `${phone}@g.us`;
        }

        return `${phone}@s.whatsapp.net`;
    }

    /**
     * Checks if a string is a LID.
     */
    static isLid(phone: string): boolean {
        return phone.includes('@lid');
    }
}
