import * as crypto from 'crypto';

/**
 * Utility class for encrypting and decrypting sensitive data
 * Uses AES-256-GCM encryption
 */
export class EncryptionUtil {
    private static readonly ALGORITHM = 'aes-256-gcm';
    private static readonly IV_LENGTH = 16;
    private static readonly AUTH_TAG_LENGTH = 16;
    private static readonly SALT_LENGTH = 64;

    /**
     * Get encryption key from environment variable
     */
    private static getEncryptionKey(): Buffer {
        const key = process.env.ENCRYPTION_KEY;

        if (!key) {
            throw new Error('ENCRYPTION_KEY environment variable is not set');
        }

        // Derive a 32-byte key from the environment variable
        return crypto.scryptSync(key, 'salt', 32);
    }

    /**
     * Encrypts a string using AES-256-GCM
     * @param text - Plain text to encrypt
     * @returns Encrypted text in format: iv:authTag:encryptedData (hex encoded)
     */
    static encrypt(text: string): string {
        if (!text) {
            throw new Error('Text to encrypt cannot be empty');
        }

        try {
            const key = this.getEncryptionKey();
            const iv = crypto.randomBytes(this.IV_LENGTH);

            const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            const authTag = cipher.getAuthTag();

            // Return format: iv:authTag:encryptedData
            return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
        } catch (error: any) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypts a string encrypted with AES-256-GCM
     * @param encryptedText - Encrypted text in format: iv:authTag:encryptedData
     * @returns Decrypted plain text
     */
    static decrypt(encryptedText: string): string {
        if (!encryptedText) {
            throw new Error('Encrypted text cannot be empty');
        }

        try {
            const key = this.getEncryptionKey();
            const parts = encryptedText.split(':');

            if (parts.length !== 3) {
                throw new Error('Invalid encrypted text format');
            }

            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];

            const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error: any) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Checks if a string is encrypted (has the correct format)
     * @param text - Text to check
     * @returns True if text appears to be encrypted
     */
    static isEncrypted(text: string): boolean {
        if (!text) return false;
        const parts = text.split(':');
        return parts.length === 3 && parts.every(part => /^[0-9a-f]+$/i.test(part));
    }
}
