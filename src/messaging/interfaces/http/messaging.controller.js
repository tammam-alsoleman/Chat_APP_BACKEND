const messagingService = require('../../messaging.service');
const logger = require('../../../core/logger');
const { createChatSchema, addParticipantsSchema } = require('../../messaging.model');

class MessagingController {
    async createChat(req, res) {
        try {
            const { error, value } = createChatSchema.validate(req.body);
            if (error) return res.status(400).json({ error: error.details[0].message });
            const { groupId } = await messagingService.createChat(value.group_name, value.participants);
            // Fetch the encrypted group key for the creator
            const userId = req.user.user_id;
            const keyInfo = await messagingService.getGroupEncryptionKey(userId, groupId);
            res.status(201).json({ message: 'Group created successfully', group_id: groupId, ...keyInfo });
        } catch (error) {
            logger.error('Error creating group:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getMyChats(req, res) {
        try {
            const userId = req.user.user_id;
            const groups = await messagingService.getChatsForUser(userId);
            // For each group, fetch the encrypted group key for this user
            const groupsWithKeys = await Promise.all(groups.map(async (group) => {
                try {
                    const keyInfo = await messagingService.getGroupEncryptionKey(userId, group.group_id);
                    return { ...group, ...keyInfo };
                } catch (e) {
                    return { ...group, encrypted_symmetric_key: null, key_version: null };
                }
            }));
            res.status(200).json(groupsWithKeys);
        } catch (error) {
            logger.error('Error retrieving groups:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

     async addParticipants(req, res) {
        try {
            const { error, value } = addParticipantsSchema.validate(req.body);
            if (error) return res.status(400).json({ error: error.details[0].message });
            
            const groupId = parseInt(req.params.chatId, 10);
            const requesterId = req.user.user_id;

            await messagingService.addParticipantsToChat(groupId, value.participants, requesterId);
            res.status(201).json({ message: 'Users added to group successfully' });
        } catch (error) {
            let statusCode = 500;
            if (error.name === 'UserNotFoundError') {
                statusCode = 404; // 404 Not Found is a good status for a missing user
            } else if (error.message.includes('not a member')) {
                statusCode = 403; // 403 Forbidden is correct for permission errors
            }
            
            logger.error('Error adding users to group:', error);
            res.status(statusCode).json({ error: error.message });
        }
    }

    async getMessages(req, res) {
        try {
            const groupId = parseInt(req.params.chatId, 10);
            if (isNaN(groupId)) return res.status(400).json({ error: 'Invalid chat ID' });
            
            // Extract Pagination parameters from the query string
            // If not provided, their values will be undefined
            const beforeMessageId = req.query.beforeMessageId ? parseInt(req.query.beforeMessageId, 10) : undefined;
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30; 
            // --------------------

            const userId = req.user.user_id;
            
            // Pass the new parameters to the service
            const messages = await messagingService.getChatHistory(userId, groupId, { beforeMessageId, limit });

            res.status(200).json(messages);
        } catch (error) {
            const statusCode = error.message.includes('not a member') ? 403 : 500;
            logger.error('Error fetching chat history:', error);
            res.status(statusCode).json({ error: error.message });
        }
    }

    async getGroupKey(req, res) {
        try {
            const groupId = parseInt(req.params.chatId, 10);
            if (isNaN(groupId)) return res.status(400).json({ error: 'Invalid chat ID' });
            const userId = req.user.user_id;
            const keyInfo = await messagingService.getGroupEncryptionKey(userId, groupId);
            res.status(200).json(keyInfo);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
module.exports = new MessagingController();
