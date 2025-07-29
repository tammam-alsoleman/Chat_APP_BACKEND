const encryptionService = require('./encryption.service');
const logger = require('../../logger');

class KeyManager {
    constructor() {
        this.encryptionService = encryptionService;
    }

    /**
     * Generate a new symmetric key for a group
     * @param {number} groupId - Group ID
     * @returns {string} Base64 encoded symmetric key
     */
    generateGroupKey(groupId) {
        try {
            logger.info(`Generating new symmetric key for group ${groupId}`);
            const symmetricKey = this.encryptionService.generateSymmetricKey();
            
            // Validate the generated key
            if (!this.encryptionService.isValidBase64Key(symmetricKey)) {
                throw new Error('Generated key validation failed');
            }
            
            logger.info(`Successfully generated symmetric key for group ${groupId}`);
            return symmetricKey;
        } catch (error) {
            logger.error(`Error generating group key for group ${groupId}:`, error);
            throw new Error('Failed to generate group key');
        }
    }

    /**
     * Encrypt a group's symmetric key with each participant's public key
     * @param {string} groupSymmetricKey - Base64 encoded group key
     * @param {Array} participants - Array of participant objects with user_id and public_key
     * @returns {Array} Array of encrypted keys for each participant
     */
    encryptGroupKeyForParticipants(groupSymmetricKey, participants) {
        try {
            logger.info(`Encrypting group key for ${participants.length} participants`);
            
            const encryptedKeys = participants.map(participant => {
                if (!participant.public_key) {
                    logger.warn(`Participant ${participant.user_id} has no public key`);
                    return null;
                }
                
                try {
                    const encryptedKey = this.encryptionService.encryptSymmetricKeyWithPublicKey(
                        groupSymmetricKey, 
                        participant.public_key
                    );
                    
                    return {
                        user_id: participant.user_id,
                        encrypted_symmetric_key: encryptedKey,
                        key_version: 1
                    };
                } catch (error) {
                    logger.error(`Error encrypting key for participant ${participant.user_id}:`, error);
                    return null;
                }
            }).filter(key => key !== null); // Remove failed encryptions
            
            logger.info(`Successfully encrypted group key for ${encryptedKeys.length} participants`);
            return encryptedKeys;
        } catch (error) {
            logger.error('Error encrypting group key for participants:', error);
            throw new Error('Failed to encrypt group key for participants');
        }
    }

    /**
     * Create a complete key package for group creation
     * @param {number} groupId - Group ID
     * @param {Array} participants - Array of participant objects
     * @returns {object} Complete key package
     */
    createGroupKeyPackage(groupId, participants) {
        try {
            logger.info(`Creating key package for group ${groupId}`);
            
            // Generate the group's symmetric key
            const groupSymmetricKey = this.generateGroupKey(groupId);
            
            // 1. Encrypt group key with master key (for server access)
            const serverEncryptedKey = this.encryptionService.encryptGroupKeyWithMasterKey(groupSymmetricKey);
            
            // 2. Encrypt the key for each participant (for client distribution)
            const encryptedKeys = this.encryptGroupKeyForParticipants(groupSymmetricKey, participants);
            
            // Create the key package
            const keyPackage = {
                group_id: groupId,
                group_symmetric_key: groupSymmetricKey, // Plain key for immediate use
                server_encrypted_key: serverEncryptedKey, // Encrypted with master key
                encrypted_keys: encryptedKeys, // Encrypted with user public keys
                key_version: 1,
                created_at: new Date(),
                total_participants: participants.length,
                successful_encryptions: encryptedKeys.length
            };
            
            logger.info(`Successfully created key package for group ${groupId}`);
            return keyPackage;
        } catch (error) {
            logger.error(`Error creating key package for group ${groupId}:`, error);
            throw new Error('Failed to create group key package');
        }
    }

    /**
     * Rotate a group's symmetric key (for when participants leave)
     * @param {number} groupId - Group ID
     * @param {Array} remainingParticipants - Array of remaining participant objects
     * @returns {object} New key package
     */
    rotateGroupKey(groupId, remainingParticipants) {
        try {
            logger.info(`Rotating key for group ${groupId}`);
            
            // Generate new symmetric key
            const newGroupSymmetricKey = this.generateGroupKey(groupId);
            
            // 1. Encrypt new key with master key (for server access)
            const serverEncryptedKey = this.encryptionService.encryptGroupKeyWithMasterKey(newGroupSymmetricKey);
            
            // 2. Encrypt new key for remaining participants
            const encryptedKeys = this.encryptGroupKeyForParticipants(newGroupSymmetricKey, remainingParticipants);
            
            const keyPackage = {
                group_id: groupId,
                group_symmetric_key: newGroupSymmetricKey, // Plain key for immediate use
                server_encrypted_key: serverEncryptedKey, // Encrypted with master key
                encrypted_keys: encryptedKeys, // Encrypted with user public keys
                key_version: 2, // Increment version
                created_at: new Date(),
                is_rotation: true,
                total_participants: remainingParticipants.length,
                successful_encryptions: encryptedKeys.length
            };
            
            logger.info(`Successfully rotated key for group ${groupId}`);
            return keyPackage;
        } catch (error) {
            logger.error(`Error rotating key for group ${groupId}:`, error);
            throw new Error('Failed to rotate group key');
        }
    }

    /**
     * Add new participant to existing group
     * @param {number} groupId - Group ID
     * @param {string} groupSymmetricKey - Current group symmetric key
     * @param {object} newParticipant - New participant object with user_id and public_key
     * @returns {object} Encrypted key for new participant
     */
    addParticipantToGroup(groupId, groupSymmetricKey, newParticipant) {
        try {
            logger.info(`Adding participant ${newParticipant.user_id} to group ${groupId}`);
            
            if (!newParticipant.public_key) {
                throw new Error('New participant has no public key');
            }
            
            const encryptedKey = this.encryptionService.encryptSymmetricKeyWithPublicKey(
                groupSymmetricKey,
                newParticipant.public_key
            );
            
            const participantKey = {
                user_id: newParticipant.user_id,
                encrypted_symmetric_key: encryptedKey,
                key_version: 1
            };
            
            logger.info(`Successfully added participant ${newParticipant.user_id} to group ${groupId}`);
            return participantKey;
        } catch (error) {
            logger.error(`Error adding participant ${newParticipant.user_id} to group ${groupId}:`, error);
            throw new Error('Failed to add participant to group');
        }
    }

    /**
     * Validate a key package
     * @param {object} keyPackage - Key package to validate
     * @returns {boolean} True if valid
     */
    validateKeyPackage(keyPackage) {
        try {
            // Check required fields
            if (!keyPackage.group_id || !keyPackage.group_symmetric_key || !keyPackage.encrypted_keys) {
                return false;
            }
            
            // Validate group symmetric key
            if (!this.encryptionService.isValidBase64Key(keyPackage.group_symmetric_key)) {
                return false;
            }
            
            // Validate encrypted keys
            if (!Array.isArray(keyPackage.encrypted_keys) || keyPackage.encrypted_keys.length === 0) {
                return false;
            }
            
            // Validate each encrypted key
            for (const encryptedKey of keyPackage.encrypted_keys) {
                if (!encryptedKey.user_id || !encryptedKey.encrypted_symmetric_key) {
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            logger.error('Error validating key package:', error);
            return false;
        }
    }

    /**
     * Get key statistics for monitoring
     * @param {object} keyPackage - Key package to analyze
     * @returns {object} Key statistics
     */
    getKeyStatistics(keyPackage) {
        try {
            return {
                group_id: keyPackage.group_id,
                key_version: keyPackage.key_version,
                total_participants: keyPackage.total_participants || keyPackage.encrypted_keys.length,
                successful_encryptions: keyPackage.successful_encryptions || keyPackage.encrypted_keys.length,
                key_size_bits: 256,
                algorithm: 'AES-256-GCM',
                created_at: keyPackage.created_at,
                is_rotation: keyPackage.is_rotation || false
            };
        } catch (error) {
            logger.error('Error getting key statistics:', error);
            return null;
        }
    }
}

// Export a singleton instance
module.exports = new KeyManager(); 