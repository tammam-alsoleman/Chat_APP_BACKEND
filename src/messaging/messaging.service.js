const messagingRepository = require('./messaging.repository');
const { userService, userRepository } = require('../users'); // We need userRepository for direct checks
const { encryption } = require('../core/services');
const { keyManager, encryptionRepository } = encryption;
const logger = require('../core/logger');

class MessagingService {
    async createChat(group_name, participantsUsernames) {
        logger.info(`Creating group '${group_name}' with participants: ${participantsUsernames.join(', ')}`);
        
        // Step 1: Create the group
        const groupId = await messagingRepository.createGroup(group_name);
        
        // Step 2: Get participants with their public keys
        const participants = [];
        for (const username of participantsUsernames) {
            const user = await userRepository.findByUsername(username);
            if (!user) {
                throw new Error(`User '${username}' not found`);
            }
            if (!user.public_key) {
                throw new Error(`User '${username}' has no public key`);
            }
            participants.push({
                user_id: user.user_id,
                public_key: user.public_key
            });
        }
        
        // Step 3: Generate and store encryption keys
        try {
            const keyPackage = keyManager.createGroupKeyPackage(groupId, participants);
            await encryptionRepository.storeCompleteGroupKeys(groupId, keyPackage);
            
            logger.info(`Successfully created group ${groupId} with encryption keys for ${participants.length} participants`);
        } catch (error) {
            logger.error(`Failed to create encryption keys for group ${groupId}:`, error);
            // Clean up the group if key creation fails
            await messagingRepository.deleteGroup(groupId);
            throw new Error('Failed to create group encryption keys');
        }
        
        // Step 4: Add participants to the group
        for (const username of participantsUsernames) {
            await messagingRepository.addParticipantByUsername(groupId, username);
        }
        
        return { groupId };
    }

    async getChatsForUser(userId) {
        // This function is already correct
        return messagingRepository.findGroupsByUserId(userId);
    }

    async addParticipantsToChat(groupId, participantsUsernames, requesterId) {
        // Step 1: Check if the person making the request is a member
        const isMember = await messagingRepository.isUserInGroup(requesterId, groupId);
        if (!isMember) {
            throw new Error('User is not a member of the group');
        }

        // Step 2: Validate that all users to be added actually exist and have public keys
        const validationPromises = participantsUsernames.map(username => 
            userRepository.findByUsername(username)
        );

        const foundUsers = await Promise.all(validationPromises);

        // Check if any of the results were null/undefined, meaning the user was not found.
        for (let i = 0; i < foundUsers.length; i++) {
            if (!foundUsers[i]) {
                const err = new Error(`User with username '${participantsUsernames[i]}' does not exist.`);
                err.name = 'UserNotFoundError';
                throw err;
            }
            if (!foundUsers[i].public_key) {
                const err = new Error(`User with username '${participantsUsernames[i]}' has no public key.`);
                err.name = 'NoPublicKeyError';
                throw err;
            }
        }

        // Step 3: Get current group key for new participants
        const groupKey = await encryptionRepository.getGroupKey(groupId);
        if (!groupKey) {
            throw new Error('Group encryption key not found');
        }

        // Step 4: Add participants and their encrypted keys
        for (let i = 0; i < participantsUsernames.length; i++) {
            const username = participantsUsernames[i];
            const user = foundUsers[i];
            
            // Add participant to group
            await messagingRepository.addParticipantByUsername(groupId, username);
            
            // Encrypt group key for new participant
            const participantKey = keyManager.addParticipantToGroup(groupId, groupKey, {
                user_id: user.user_id,
                public_key: user.public_key
            });
            
            // Store encrypted key for new participant
            await encryptionRepository.storeUserGroupKey(
                user.user_id,
                groupId,
                participantKey.encrypted_symmetric_key,
                participantKey.key_version
            );
        }
        
        logger.info(`Successfully added ${participantsUsernames.length} participants to group ${groupId} with encryption keys`);
    }

    async saveAndBroadcastMessage({ sender_id, group_id, encrypted_content, clientMessageId, is_encrypted = true }) {
        const isMember = await messagingRepository.isUserInGroup(sender_id, group_id);
        if (!isMember) throw new Error('User is not a member of the group');

        const existingMessage = await messagingRepository.findMessageByClientId(clientMessageId);
        if (existingMessage) {
            logger.warn(`Duplicate message received with client ID: ${clientMessageId}. Acknowledging success without saving.`);
            const senderInfo = await userService.getUserInfo(existingMessage.sender_id);
            return {
                isDuplicate: true,
                messagePayload: {
                    message_id: existingMessage.message_id,
                    group_id: existingMessage.group_id,
                    sender_id: existingMessage.sender_id,
                    user_name: senderInfo.user_name,
                    encrypted_content: existingMessage.encrypted_content || existingMessage.text_message,
                    is_encrypted: existingMessage.is_encrypted !== false,
                    sent_at: existingMessage.sent_at,
                    client_message_id: existingMessage.client_message_id
                }
            };
        }
        
        const senderInfo = await userService.getUserInfo(sender_id);
        if (!senderInfo) throw new Error('Sender not found');
        
        // Store encrypted message
        const newMessage = await messagingRepository.createEncryptedMessage({ 
            group_id, 
            sender_id, 
            encrypted_content, 
            clientMessageId,
            is_encrypted 
        });
        
        const participantsToNotify = await messagingRepository.findGroupParticipantUsernames(group_id);
        
        logger.info(`Encrypted message saved and ready to broadcast to group ${group_id}.`);
        
        const messagePayload = {
            message_id: newMessage.message_id,
            group_id,
            sender_id,
            user_name: senderInfo.user_name,
            encrypted_content,
            is_encrypted,
            sent_at: newMessage.sent_at,
            client_message_id: clientMessageId
        };

        return { isDuplicate: false, messagePayload, participantsToNotify };
    }

    async getChatHistory(userId, groupId, options = {}) {
        const { beforeMessageId, limit } = options;

        const isMember = await messagingRepository.isUserInGroup(userId, groupId);
        if (!isMember) throw new Error('User is not a member of the group');

        return messagingRepository.findMessagesByGroupId(groupId, { beforeMessageId, limit });
    }

    async getGroupEncryptionKey(userId, groupId) {
        const isMember = await messagingRepository.isUserInGroup(userId, groupId);
        if (!isMember) throw new Error('User is not a member of the group');

        const encryptedKey = await encryptionRepository.getUserGroupKey(userId, groupId);
        if (!encryptedKey) {
            throw new Error('Group encryption key not found for user');
        }

        return {
            encrypted_symmetric_key: encryptedKey.encrypted_symmetric_key,
            key_version: encryptedKey.key_version
        };
    }

    async removeParticipantFromChat(groupId, participantUsername, requesterId) {
        // Check if the person making the request is a member
        const isMember = await messagingRepository.isUserInGroup(requesterId, groupId);
        if (!isMember) {
            throw new Error('User is not a member of the group');
        }

        // Get participant user ID
        const participant = await userRepository.findByUsername(participantUsername);
        if (!participant) {
            throw new Error(`User '${participantUsername}' not found`);
        }

        // Check if participant is in the group
        const isParticipantInGroup = await messagingRepository.isUserInGroup(participant.user_id, groupId);
        if (!isParticipantInGroup) {
            throw new Error(`User '${participantUsername}' is not a member of the group`);
        }

        // Remove participant from group
        await messagingRepository.removeParticipantByUsername(groupId, participantUsername);

        // Get remaining participants for key rotation
        const remainingParticipants = await this.getGroupParticipantsWithKeys(groupId);

        // Rotate group key for remaining participants
        if (remainingParticipants.length > 0) {
            const rotatedKeyPackage = keyManager.rotateGroupKey(groupId, remainingParticipants);
            await encryptionRepository.storeCompleteGroupKeys(groupId, rotatedKeyPackage);
            
            logger.info(`Successfully rotated encryption key for group ${groupId} after removing participant ${participantUsername}`);
        }

        return { success: true, message: `Participant ${participantUsername} removed from group` };
    }

    async getGroupParticipantsWithKeys(groupId) {
        const participants = await encryptionRepository.getGroupParticipantsWithKeys(groupId);
        return participants.map(p => ({
            user_id: p.user_id,
            public_key: p.public_key
        }));
    }
}

module.exports = new MessagingService();