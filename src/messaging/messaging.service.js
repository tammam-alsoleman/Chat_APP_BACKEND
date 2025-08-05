const messagingRepository = require('./messaging.repository');
const { userService, userRepository } = require('../users'); // We need userRepository for direct checks
const logger = require('../core/logger');

class MessagingService {
    async createChat(group_name, participantsUsernames) {
        // This function is already correct
        logger.info(`Creating group '${group_name}' with participants: ${participantsUsernames.join(', ')}`);
        const groupId = await messagingRepository.createGroup(group_name);
        for (const username of participantsUsernames) {
            await messagingRepository.addParticipantByUsername(groupId, username);
        }
        return { groupId };
    }

    async getChatsForUser(userId) {
        // This function is already correct
        return messagingRepository.findGroupsByUserId(userId);
    }

    // =================================================================
    // THIS FUNCTION HAS BEEN EDITED
    // =================================================================
    async addParticipantsToChat(groupId, participantsUsernames, requesterId) {
        // Step 1: Check if the person making the request is a member (no change)
        const isMember = await messagingRepository.isUserInGroup(requesterId, groupId);
        if (!isMember) {
            throw new Error('User is not a member of the group');
        }

        // Step 2 (NEW): Validate that all users to be added actually exist.
        // We use Promise.all to run all database checks in parallel for better performance.
        const validationPromises = participantsUsernames.map(username => 
            userRepository.findByUsername(username)
        );

        const foundUsers = await Promise.all(validationPromises);

        // Check if any of the results were null/undefined, meaning the user was not found.
        for (let i = 0; i < foundUsers.length; i++) {
            if (!foundUsers[i]) {
                // If a user was not found, create and throw a specific, identifiable error.
                const err = new Error(`User with username '${participantsUsernames[i]}' does not exist.`);
                err.name = 'UserNotFoundError'; // Give the error a name to identify it in the controller
                throw err;
            }
        }
        // End of new validation logic.

        // Step 3: If all users are valid, proceed to add them (no change)
        for (const username of participantsUsernames) {
            await messagingRepository.addParticipantByUsername(groupId, username);
        }
    }

    async saveAndBroadcastMessage({ sender_id, group_id, text_message, clientMessageId }) {
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
                    text_message: existingMessage.text_message,
                    sent_at: existingMessage.sent_at,
                    client_message_id: existingMessage.client_message_id // <-- ensure this is present
                }
            };
        }
        
        const senderInfo = await userService.getUserInfo(sender_id);
        if (!senderInfo) throw new Error('Sender not found');
        
        const newMessage = await messagingRepository.createMessage({ group_id, sender_id, text_message, clientMessageId });
        const participantsToNotify = await messagingRepository.findGroupParticipantUsernames(group_id);
        
        logger.info(`Message saved and ready to broadcast to group ${group_id}.`);
        
        const messagePayload = {
            message_id: newMessage.message_id,
            group_id,
            sender_id,
            user_name: senderInfo.user_name,
            text_message,
            sent_at: newMessage.sent_at,
            client_message_id: clientMessageId // <-- ensure this is present
        };

        return { isDuplicate: false, messagePayload, participantsToNotify };
    }

    async getChatHistory(userId, groupId, options = {}) {
        const { beforeMessageId, limit } = options;

        const isMember = await messagingRepository.isUserInGroup(userId, groupId);
        if (!isMember) throw new Error('User is not a member of the group');

        return messagingRepository.findMessagesByGroupId(groupId, { beforeMessageId, limit });
    }

    async getEncryptedKeyForUser(userId, groupId) {
        return messagingRepository.findEncryptedKey(userId, groupId);
    }
}

module.exports = new MessagingService();