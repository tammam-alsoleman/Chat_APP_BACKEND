const messagingRepository = require('./messaging.repository');
const { userService } = require('../users');
const logger = require('../core/logger');

class MessagingService {
    async createChat(group_name, participantsUsernames) {
        logger.info(`Creating group '${group_name}' with participants: ${participantsUsernames.join(', ')}`);
        const groupId = await messagingRepository.createGroup(group_name);
        for (const username of participantsUsernames) {
            await messagingRepository.addParticipantByUsername(groupId, username);
        }
        return { groupId };
    }

    async getChatsForUser(userId) {
        return messagingRepository.findGroupsByUserId(userId);
    }

    async addParticipantsToChat(groupId, participantsUsernames, requesterId) {
        const isMember = await messagingRepository.isUserInGroup(requesterId, groupId);
        if (!isMember) throw new Error('User is not a member of the group');
        
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
            sent_at: newMessage.sent_at
        };

        return { isDuplicate: false, messagePayload, participantsToNotify };
    }

    async getChatHistory(userId, groupId) {
        const isMember = await messagingRepository.isUserInGroup(userId, groupId);
        if (!isMember) throw new Error('User is not a member of the group');
        return messagingRepository.findMessagesByGroupId(groupId);
    }
}

module.exports = new MessagingService();