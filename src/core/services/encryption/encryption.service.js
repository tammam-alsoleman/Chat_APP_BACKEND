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
     * Encrypt a symmetric key with a user's public key (RSA)
     * @param {string} symmetricKey - Base64 encoded symmetric key
     * @param {string} publicKey - User's RSA public key (PEM format)
     * @returns {string} Encrypted symmetric key
     */
    encryptSymmetricKeyWithPublicKey(symmetricKey, publicKey) {
        try {
            const keyBuffer = Buffer.from(symmetricKey, 'base64');
            
            // Ensure the public key is in the correct format
            let formattedPublicKey = publicKey;
            if (!publicKey.includes('-----BEGIN PUBLIC KEY-----')) {
                formattedPublicKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
            }
            
            // Use RSA public encryption
            const encrypted = crypto.publicEncrypt(
                {
                    key: formattedPublicKey,
                    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                    oaepHash: 'sha256'
                },
                keyBuffer
            );
            
            return encrypted.toString('base64');
        } catch (error) {
            logger.error('Error encrypting symmetric key with public key:', error);
            throw new Error('Failed to encrypt symmetric key with RSA');
        }
    }

    // Note: Message encryption/decryption packages are handled by the client
    // Server only stores and distributes encrypted messages

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
     * Encrypt a group symmetric key with the master key for storage
     * @param {string} groupSymmetricKey - Base64 encoded group key
     * @returns {object} Encrypted key with IV
     */
    encryptGroupKeyWithMasterKey(groupSymmetricKey) {
        try {
            const keyBuffer = Buffer.from(groupSymmetricKey, 'base64');
            const masterKeyBuffer = Buffer.from(this.masterKey, 'base64');
            
            // Generate random IV for each encryption
            const iv = crypto.randomBytes(this.ivSize);
            
            const cipher = crypto.createCipheriv(this.algorithm, masterKeyBuffer, iv);
            
            let encrypted = cipher.update(keyBuffer, 'binary', 'base64');
            encrypted += cipher.final('base64');
            
            // Return both encrypted data and IV
            return {
                encryptedData: encrypted,
                iv: iv.toString('base64')
            };
        } catch (error) {
            logger.error('Error encrypting group key with master key:', error);
            throw new Error('Failed to encrypt group key with master key');
        }
    }

    /**
     * Decrypt a group symmetric key with the master key from storage
     * @param {string} encryptedGroupKey - Base64 encoded encrypted group key
     * @param {string} iv - Base64 encoded IV used for encryption
     * @returns {string} Decrypted group symmetric key (base64)
     */
    decryptGroupKeyWithMasterKey(encryptedGroupKey, iv) {
        try {
            const masterKeyBuffer = Buffer.from(this.masterKey, 'base64');
            const ivBuffer = Buffer.from(iv, 'base64');
            
            const decipher = crypto.createDecipheriv(this.algorithm, masterKeyBuffer, ivBuffer);
            
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