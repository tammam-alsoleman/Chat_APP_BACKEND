const messagingService = require('../../messaging.service');
const { presenceService } = require('../../../presence');
const logger = require('../../../core/logger');
const { registerGroupHandlers } = require('../../../group/group.handler');

const registerMessagingHandlers = (io, socket) => {
    const onSendMessage = async (data, callback) => {
        try {
            const { chatId, text, clientMessageId } = data || {};
            if (!chatId || !clientMessageId) {
                // Text can be null for file messages etc., but chatId and clientMessageId are essential
                if (typeof callback === 'function') callback({ success: false, error: 'Missing required data: chatId and clientMessageId' });
                return;
            }

            const senderId = socket.userId;
            if (!senderId) {
                if (typeof callback === 'function') callback({ success: false, error: 'User is not authenticated' });
                return;
            }
            
            const result = await messagingService.saveAndBroadcastMessage({
                sender_id: senderId,
                group_id: chatId,
                text_message: text,
                clientMessageId: clientMessageId,
            });
            
            if (!result.isDuplicate) {
                let { messagePayload, participantsToNotify } = result;
                // Ensure sender is included in participantsToNotify
                const senderUsername = socket.userId;
                if (!participantsToNotify.includes(senderUsername)) {
                    participantsToNotify.push(senderUsername);
                }
                if (typeof messagePayload === 'object' && messagePayload !== null) {
                    participantsToNotify.forEach(username => {
                        const recipientSocketId = presenceService.getUserSocketIdByUsername(username);
                        if (recipientSocketId) {
                            logger.info(`Broadcasting 'newMessage' to ${username} (${recipientSocketId})`);
                            io.to(recipientSocketId).emit('newMessage', messagePayload); 
                        }
                    });
                } else {
                    logger.error("Attempted to broadcast invalid messagePayload:", messagePayload);
                }
            }

            if (typeof callback === 'function') {
                callback({ success: true, data: result.messagePayload });
            }

        } catch (error) {
            logger.error(`Error in sendMessage handler for socket ${socket.id}:`, error);
            if (typeof callback === 'function') callback({ success: false, error: error.message || 'Internal error' });
        }
    };

    socket.on('sendMessage', onSendMessage);

};

module.exports = registerMessagingHandlers;
