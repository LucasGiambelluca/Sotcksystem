import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

class EncryptionService {
    private key: Buffer;

    constructor() {
        // ENCRYPTION_KEY must be 256 bits (32 bytes / 64 hex characters)
        const keyHex = process.env.ENCRYPTION_KEY || '';
        if (keyHex.length !== 64) {
            console.warn('⚠️ [EncryptionService] ENCRYPTION_KEY is missing or invalid length. Using fallback (NOT SECURE FOR PRODUCTION)');
            // Create a pseudo-random key if missing to avoid crashing, but log loudly
            this.key = crypto.scryptSync(process.env.JWT_SECRET || 'fallback-secret', 'salt', 32);
        } else {
            this.key = Buffer.from(keyHex, 'hex');
        }
    }

    /**
     * Encrypts plaintext using AES-256-GCM.
     * Returns a string in the format: iv:authTag:ciphertext (all in hex)
     */
    encrypt(text: string): string {
        try {
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
        } catch (error: any) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypts a string in the format: iv:authTag:ciphertext
     */
    decrypt(encryptedData: string): string {
        try {
            const parts = encryptedData.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }

            const [ivHex, authTagHex, encryptedText] = parts;
            
            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
            
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error: any) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }
}

export const encryptionService = new EncryptionService();
