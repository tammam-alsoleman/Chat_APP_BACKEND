const sql = require('mssql');
const { getPool } = require('../../db');
const logger = require('../../logger');
const { encryptionService } = require('./index');

class EncryptionRepository {
    /**
     * Store group encryption key in group_info table (encrypted with master key)
     * @param {number} groupId - Group ID
     * @param {string} groupSymmetricKey - Plain group symmetric key (will be encrypted)
     * @param {number} keyVersion - Key version
     * @returns {Promise<void>}
     */
    async storeGroupKey(groupId, groupSymmetricKey, keyVersion = 1) {
        try {
            // Encrypt the group key with master key before storing
            const encryptedKey = encryptionService.encryptGroupKeyWithMasterKey(groupSymmetricKey);
            
            const pool = await getPool();
            await pool.request()
                .input('group_id', sql.Int, groupId)
                .input('encrypted_key', sql.NVarChar(sql.MAX), encryptedKey)
                .input('key_version', sql.Int, keyVersion)
                .query(`
                    UPDATE group_info 
                    SET encrypted_key = @encrypted_key, key_version = @key_version 
                    WHERE group_id = @group_id
                `);
            
            logger.info(`Stored encrypted group key for group ${groupId}, version ${keyVersion}`);
        } catch (error) {
            logger.error(`Error storing group key for group ${groupId}:`, error);
            throw new Error('Failed to store group key');
        }
    }

    /**
     * Store both server and client encrypted keys for a group
     * @param {number} groupId - Group ID
     * @param {object} keyPackage - Complete key package with both encryptions
     * @returns {Promise<void>}
     */
    async storeCompleteGroupKeys(groupId, keyPackage) {
        try {
            // 1. Store group key encrypted with master key (for server access)
            await this.storeGroupKey(groupId, keyPackage.group_symmetric_key, keyPackage.key_version);
            
            // 2. Store individual keys encrypted with user public keys (for client distribution)
            for (const encryptedKey of keyPackage.encrypted_keys) {
                await this.storeUserGroupKey(
                    encryptedKey.user_id,
                    groupId,
                    encryptedKey.encrypted_symmetric_key,
                    keyPackage.key_version
                );
            }
            
            logger.info(`Stored complete key package for group ${groupId}, version ${keyPackage.key_version}`);
        } catch (error) {
            logger.error(`Error storing complete key package for group ${groupId}:`, error);
            throw new Error('Failed to store complete key package');
        }
    }

    /**
     * Store encrypted symmetric key for a specific user in a group
     * @param {number} userId - User ID
     * @param {number} groupId - Group ID
     * @param {string} encryptedSymmetricKey - Encrypted symmetric key
     * @param {number} keyVersion - Key version
     * @returns {Promise<void>}
     */
    async storeUserGroupKey(userId, groupId, encryptedSymmetricKey, keyVersion = 1) {
        try {
            const pool = await getPool();
            await pool.request()
                .input('user_id', sql.Int, userId)
                .input('group_id', sql.Int, groupId)
                .input('encrypted_symmetric_key', sql.NVarChar(sql.MAX), encryptedSymmetricKey)
                .input('key_version', sql.Int, keyVersion)
                .query(`
                    UPDATE group_participant 
                    SET encrypted_symmetric_key = @encrypted_symmetric_key, key_version = @key_version 
                    WHERE user_id = @user_id AND group_id = @group_id
                `);
            
            logger.info(`Stored user group key for user ${userId} in group ${groupId}, version ${keyVersion}`);
        } catch (error) {
            logger.error(`Error storing user group key for user ${userId} in group ${groupId}:`, error);
            throw new Error('Failed to store user group key');
        }
    }

    /**
     * Get group encryption key (decrypted from master key encryption)
     * @param {number} groupId - Group ID
     * @returns {Promise<object>} Group key information with decrypted key
     */
    async getGroupKey(groupId) {
        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('group_id', sql.Int, groupId)
                .query(`
                    SELECT encrypted_key, key_version 
                    FROM group_info 
                    WHERE group_id = @group_id
                `);
            
            if (result.recordset.length === 0) {
                return null;
            }
            
            const record = result.recordset[0];
            
            // Decrypt the group key (no IV needed - deterministic)
            const decryptedKey = encryptionService.decryptGroupKeyWithMasterKey(record.encrypted_key);
            
            return {
                encrypted_key: record.encrypted_key,
                decrypted_key: decryptedKey,
                key_version: record.key_version
            };
        } catch (error) {
            logger.error(`Error getting group key for group ${groupId}:`, error);
            throw new Error('Failed to get group key');
        }
    }

    /**
     * Get user's encrypted symmetric key for a specific group
     * @param {number} userId - User ID
     * @param {number} groupId - Group ID
     * @returns {Promise<object>} User group key information
     */
    async getUserGroupKey(userId, groupId) {
        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('user_id', sql.Int, userId)
                .input('group_id', sql.Int, groupId)
                .query(`
                    SELECT encrypted_symmetric_key, key_version 
                    FROM group_participant 
                    WHERE user_id = @user_id AND group_id = @group_id
                `);
            
            if (result.recordset.length === 0) {
                return null;
            }
            
            return result.recordset[0];
        } catch (error) {
            logger.error(`Error getting user group key for user ${userId} in group ${groupId}:`, error);
            throw new Error('Failed to get user group key');
        }
    }

    /**
     * Get all participants with their public keys for a group
     * @param {number} groupId - Group ID
     * @returns {Promise<Array>} Array of participants with public keys
     */
    async getGroupParticipantsWithKeys(groupId) {
        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('group_id', sql.Int, groupId)
                .query(`
                    SELECT 
                        ua.user_id,
                        ua.user_name,
                        ua.public_key,
                        ua.key_created_at,
                        gp.encrypted_symmetric_key,
                        gp.key_version
                    FROM group_participant gp
                    JOIN user_account ua ON gp.user_id = ua.user_id
                    WHERE gp.group_id = @group_id
                `);
            
            return result.recordset;
        } catch (error) {
            logger.error(`Error getting group participants with keys for group ${groupId}:`, error);
            throw new Error('Failed to get group participants with keys');
        }
    }

    /**
     * Get all participants without their keys (for key generation)
     * @param {number} groupId - Group ID
     * @returns {Promise<Array>} Array of participants
     */
    async getGroupParticipants(groupId) {
        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('group_id', sql.Int, groupId)
                .query(`
                    SELECT 
                        ua.user_id,
                        ua.user_name,
                        ua.public_key,
                        ua.key_created_at
                    FROM group_participant gp
                    JOIN user_account ua ON gp.user_id = ua.user_id
                    WHERE gp.group_id = @group_id
                `);
            
            return result.recordset;
        } catch (error) {
            logger.error(`Error getting group participants for group ${groupId}:`, error);
            throw new Error('Failed to get group participants');
        }
    }

    /**
     * Store encrypted message
     * @param {number} groupId - Group ID
     * @param {number} senderId - Sender ID
     * @param {string} encryptedContent - Encrypted message content
     * @param {string} clientMessageId - Client message ID
     * @returns {Promise<object>} Created message
     */
    async storeEncryptedMessage(groupId, senderId, encryptedContent, clientMessageId) {
        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('group_id', sql.Int, groupId)
                .input('sender_id', sql.Int, senderId)
                .input('encrypted_content', sql.NVarChar(sql.MAX), encryptedContent)
                .input('client_message_id', sql.NVarChar(sql.MAX), clientMessageId)
                .query(`
                    INSERT INTO message (group_id, sender_id, sent_at, encrypted_content, client_message_id) 
                    OUTPUT INSERTED.message_id, INSERTED.sent_at 
                    VALUES (@group_id, @sender_id, GETDATE(), @encrypted_content, @client_message_id)
                `);
            
            return result.recordset[0];
        } catch (error) {
            logger.error(`Error storing encrypted message for group ${groupId}:`, error);
            throw new Error('Failed to store encrypted message');
        }
    }

    /**
     * Get encrypted messages for a group
     * @param {number} groupId - Group ID
     * @param {object} options - Query options
     * @returns {Promise<Array>} Array of encrypted messages
     */
    async getEncryptedMessages(groupId, options = {}) {
        try {
            const { beforeMessageId, limit = 30 } = options;
            const pool = await getPool();
            const request = pool.request();
            
            let whereClause = `WHERE m.group_id = @group_id`;
            request.input('group_id', sql.Int, groupId);

            if (beforeMessageId) {
                whereClause += ` AND m.message_id < @beforeMessageId`;
                request.input('beforeMessageId', sql.Int, beforeMessageId);
            }
            
            const query = `
                SELECT TOP ${limit}
                    m.message_id, 
                    m.sender_id, 
                    u.user_name, 
                    m.sent_at, 
                    m.encrypted_content,
                    m.client_message_id
                FROM message m 
                JOIN user_account u ON m.sender_id = u.user_id 
                ${whereClause}
                ORDER BY m.message_id DESC
            `;

            const result = await request.query(query);
            return result.recordset;
        } catch (error) {
            logger.error(`Error getting encrypted messages for group ${groupId}:`, error);
            throw new Error('Failed to get encrypted messages');
        }
    }

    /**
     * Update user's public key
     * @param {number} userId - User ID
     * @param {string} publicKey - User's public key
     * @returns {Promise<void>}
     */
    async updateUserPublicKey(userId, publicKey) {
        try {
            const pool = await getPool();
            await pool.request()
                .input('user_id', sql.Int, userId)
                .input('public_key', sql.NVarChar(sql.MAX), publicKey)
                .input('key_created_at', sql.DateTime, new Date())
                .query(`
                    UPDATE user_account 
                    SET public_key = @public_key, key_created_at = @key_created_at 
                    WHERE user_id = @user_id
                `);
            
            logger.info(`Updated public key for user ${userId}`);
        } catch (error) {
            logger.error(`Error updating public key for user ${userId}:`, error);
            throw new Error('Failed to update user public key');
        }
    }

    /**
     * Get user's public key
     * @param {number} userId - User ID
     * @returns {Promise<string>} User's public key
     */
    async getUserPublicKey(userId) {
        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('user_id', sql.Int, userId)
                .query(`
                    SELECT public_key, key_created_at 
                    FROM user_account 
                    WHERE user_id = @user_id
                `);
            
            if (result.recordset.length === 0) {
                return null;
            }
            
            return result.recordset[0];
        } catch (error) {
            logger.error(`Error getting public key for user ${userId}:`, error);
            throw new Error('Failed to get user public key');
        }
    }

    /**
     * Check if user has a public key
     * @param {number} userId - User ID
     * @returns {Promise<boolean>} True if user has public key
     */
    async userHasPublicKey(userId) {
        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('user_id', sql.Int, userId)
                .query(`
                    SELECT COUNT(*) as count 
                    FROM user_account 
                    WHERE user_id = @user_id AND public_key IS NOT NULL
                `);
            
            return result.recordset[0].count > 0;
        } catch (error) {
            logger.error(`Error checking if user ${userId} has public key:`, error);
            return false;
        }
    }
}

module.exports = new EncryptionRepository(); 