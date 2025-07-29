const crypto = require('crypto');
const config = require('../../config');
const logger = require('../../logger');

class EncryptionService {
    constructor() {
        // AES encryption algorithm and key size
        this.algorithm = 'aes-256-cbc';
        this.keySize = 32; // 256 bits
        this.ivSize = 16; // 128 bits for CBC
        
        // Master key for encrypting group keys
        this.masterKey = config.MASTER_ENCRYPTION_KEY;
        if (!this.masterKey) {
            throw new Error('MASTER_ENCRYPTION_KEY is required in environment variables');
        }
    }

    /**
     * Generate a random AES-256 key for group encryption
     * @returns {string} Base64 encoded key
     */
    generateSymmetricKey() {
        try {
            const key = crypto.randomBytes(this.keySize);
            return key.toString('base64');
        } catch (error) {
            logger.error('Error generating symmetric key:', error);
            throw new Error('Failed to generate symmetric key');
        }
    }

    // Note: Message encryption/decryption is handled by the client
    // Server only manages keys and stores encrypted messages

    /**
     * Encrypt a symmetric key with a user's public key (RSA-OAEP)
     * @param {string} symmetricKey - Base64 encoded symmetric key
     * @param {string} publicKey - User's RSA public key (PEM format)
     * @returns {string} Encrypted symmetric key (base64 encoded)
     */
    encryptSymmetricKeyWithPublicKey(symmetricKey, publicKey) {
        try {
            const keyBuffer = Buffer.from(symmetricKey, 'base64');
            
            // Validate public key format (basic check)
            if (!publicKey.includes('-----BEGIN') && !publicKey.includes('-----END')) {
                throw new Error('Invalid public key format - must be PEM format');
            }
            
            // Use proper RSA-OAEP encryption
            const encrypted = crypto.publicEncrypt({
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            }, keyBuffer);
            
            return encrypted.toString('base64');
        } catch (error) {
            logger.error('Error encrypting symmetric key with public key:', error);
            if (error.message.includes('error:04075070')) {
                throw new Error('Invalid public key format');
            }
            throw new Error('Failed to encrypt symmetric key: ' + error.message);
        }
    }

    /**
     * Decrypt a symmetric key with a user's private key (RSA-OAEP)
     * @param {string} encryptedKey - Base64 encoded encrypted symmetric key
     * @param {string} privateKey - User's RSA private key (PEM format)
     * @returns {string} Decrypted symmetric key (base64 encoded)
     */
    decryptSymmetricKeyWithPrivateKey(encryptedKey, privateKey) {
        try {
            const encryptedBuffer = Buffer.from(encryptedKey, 'base64');
            
            // Validate private key format (basic check)
            if (!privateKey.includes('-----BEGIN') && !privateKey.includes('-----END')) {
                throw new Error('Invalid private key format - must be PEM format');
            }
            
            // Use proper RSA-OAEP decryption
            const decrypted = crypto.privateDecrypt({
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            }, encryptedBuffer);
            
            return decrypted.toString('base64');
        } catch (error) {
            logger.error('Error decrypting symmetric key with private key:', error);
            if (error.message.includes('error:04075070')) {
                throw new Error('Invalid private key format');
            }
            throw new Error('Failed to decrypt symmetric key: ' + error.message);
        }
    }

    /**
     * Encrypt a message with AES-256-GCM
     * @param {string} message - Plain text message
     * @param {string} symmetricKey - Base64 encoded symmetric key
     * @returns {object} Encrypted message with IV and auth tag
     */
    encryptWithAES(message, symmetricKey) {
        try {
            const keyBuffer = Buffer.from(symmetricKey, 'base64');
            const iv = crypto.randomBytes(12); // 12 bytes for GCM (96-bit)
            
            const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
            cipher.setAAD(Buffer.from('chat-app')); // Additional authenticated data
            
            let encrypted = cipher.update(message, 'utf8', 'base64');
            encrypted += cipher.final('base64');
            
            const authTag = cipher.getAuthTag();
            
            return {
                encryptedData: encrypted,
                iv: iv.toString('base64'),
                authTag: authTag.toString('base64')
            };
        } catch (error) {
            logger.error('Error encrypting message with AES:', error);
            throw new Error('Failed to encrypt message');
        }
    }

    /**
     * Decrypt a message with AES-256-GCM
     * @param {string} encryptedData - Base64 encoded encrypted data
     * @param {string} symmetricKey - Base64 encoded symmetric key
     * @param {string} iv - Base64 encoded initialization vector
     * @param {string} authTag - Base64 encoded authentication tag
     * @returns {string} Decrypted plain text message
     */
    decryptWithAES(encryptedData, symmetricKey, iv, authTag) {
        try {
            const keyBuffer = Buffer.from(symmetricKey, 'base64');
            const ivBuffer = Buffer.from(iv, 'base64');
            const authTagBuffer = Buffer.from(authTag, 'base64');
            
            const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
            decipher.setAAD(Buffer.from('chat-app')); // Same AAD as encryption
            decipher.setAuthTag(authTagBuffer);
            
            let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            logger.error('Error decrypting message with AES:', error);
            throw new Error('Failed to decrypt message - invalid key or corrupted data');
        }
    }

    /**
     * Create an encrypted message package with metadata
     * @param {string} message - Plain text message
     * @param {string} symmetricKey - Base64 encoded symmetric key
     * @returns {object} Complete encrypted message package
     */
    createEncryptedMessage(message, symmetricKey) {
        try {
            const encrypted = this.encryptWithAES(message, symmetricKey);
            
            return {
                encryptedContent: encrypted.encryptedData,
                iv: encrypted.iv,
                authTag: encrypted.authTag,
                timestamp: new Date().toISOString(),
                algorithm: 'aes-256-gcm'
            };
        } catch (error) {
            logger.error('Error creating encrypted message package:', error);
            throw new Error('Failed to create encrypted message package');
        }
    }

    /**
     * Decrypt an encrypted message package
     * @param {object} messagePackage - Encrypted message package
     * @param {string} symmetricKey - Base64 encoded symmetric key
     * @returns {string} Decrypted plain text message
     */
    decryptMessage(messagePackage, symmetricKey) {
        try {
            if (!messagePackage.encryptedContent || !messagePackage.iv || !messagePackage.authTag) {
                throw new Error('Invalid message package format');
            }
            
            return this.decryptWithAES(
                messagePackage.encryptedContent,
                symmetricKey,
                messagePackage.iv,
                messagePackage.authTag
            );
        } catch (error) {
            logger.error('Error decrypting message package:', error);
            throw new Error('Failed to decrypt message package');
        }
    }

    /**
     * Generate a random string for key IDs or nonces
     * @param {number} length - Length of the string
     * @returns {string} Random string
     */
    generateRandomString(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Validate if a string is a valid base64 encoded key
     * @param {string} key - Key to validate
     * @returns {boolean} True if valid
     */
    isValidBase64Key(key) {
        try {
            if (!key || typeof key !== 'string') return false;
            const buffer = Buffer.from(key, 'base64');
            return buffer.length === this.keySize;
        } catch (error) {
            return false;
        }
    }

    /**
     * Encrypt a group symmetric key with the master key for storage (deterministic)
     * @param {string} groupSymmetricKey - Base64 encoded group key
     * @returns {string} Encrypted key (no IV needed)
     */
    encryptGroupKeyWithMasterKey(groupSymmetricKey) {
        try {
            const keyBuffer = Buffer.from(groupSymmetricKey, 'base64');
            const masterKeyBuffer = Buffer.from(this.masterKey, 'base64');
            
            // Use a fixed IV derived from the master key (deterministic)
            const iv = crypto.createHash('sha256').update(masterKeyBuffer).digest().slice(0, this.ivSize);
            
            const cipher = crypto.createCipheriv(this.algorithm, masterKeyBuffer, iv);
            
            let encrypted = cipher.update(keyBuffer, 'binary', 'base64');
            encrypted += cipher.final('base64');
            
            return encrypted;
        } catch (error) {
            logger.error('Error encrypting group key with master key:', error);
            throw new Error('Failed to encrypt group key with master key');
        }
    }

    /**
     * Decrypt a group symmetric key with the master key from storage (deterministic)
     * @param {string} encryptedGroupKey - Base64 encoded encrypted group key
     * @returns {string} Decrypted group symmetric key (base64)
     */
    decryptGroupKeyWithMasterKey(encryptedGroupKey) {
        try {
            const masterKeyBuffer = Buffer.from(this.masterKey, 'base64');
            
            // Use the same fixed IV derived from the master key
            const iv = crypto.createHash('sha256').update(masterKeyBuffer).digest().slice(0, this.ivSize);
            
            const decipher = crypto.createDecipheriv(this.algorithm, masterKeyBuffer, iv);
            
            let decrypted = decipher.update(encryptedGroupKey, 'base64', 'binary');
            decrypted += decipher.final('binary');
            
            return Buffer.from(decrypted, 'binary').toString('base64');
        } catch (error) {
            logger.error('Error decrypting group key with master key:', error);
            throw new Error('Failed to decrypt group key with master key');
        }
    }
}

// Export a singleton instance
module.exports = new EncryptionService(); 