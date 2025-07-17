const messagingService = require('../../messaging.service');
const { presenceService } = require('../../../presence');
const logger = require('../../../core/logger');

const registerMessagingHandlers = (io, socket) => {
    const onSendMessage = async (data, callback) => {
        try {
            const { chatId, text, clientMessageId } = data || {};
            if (!chatId || !text || !clientMessageId) {
                if (typeof callback === 'function') callback({ success: false, error: 'Missing required data' });
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
                const { messagePayload, participantsToNotify } = result;
                participantsToNotify.forEach(username => {
                    const recipientSocketId = presenceService.getUserSocketIdByUsername(username);
                    if (recipientSocketId) {
                        io.to(recipientSocketId).emit('newMessage', messagePayload);
                    }
                });
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