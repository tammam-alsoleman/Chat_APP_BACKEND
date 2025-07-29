const signalingService = require('./signaling.service');
const logger = require('../core/logger');

module.exports = function registerSignalingHandlers(io, socket) {
  const relayEvent = (eventName, data) => {
    const fromUserId = socket.userId;
    if (!fromUserId) {
      logger.warn(`[Signaling] Event '${eventName}' from unregistered socket ${socket.id}`);
      return;
    }

    const { toUserId, payload } = data;
    if (!toUserId || !payload) return;

    const targetSocketId = signalingService.getTargetSocketId(toUserId);

    if (targetSocketId) {
      // Check if payload is encrypted
      const isEncrypted = signalingService.validateEncryptedSignalingPackage(payload);
      
      // Log the signaling event
      signalingService.logSignalingEvent(eventName, fromUserId, toUserId, isEncrypted);
      
      // Forward the payload (encrypted or not) to the target
      io.to(targetSocketId).emit(eventName, { 
        fromUserId, 
        payload,
        isEncrypted 
      });
    } else {
      logger.warn(`[Signaling] Target user ${toUserId} for '${eventName}' is not online.`);
      socket.emit('call_error', { targetUserId: toUserId, message: 'Target user is not online.' });
    }
  };

  // Handle outgoing signaling (client -> server -> target)
  socket.on('offer', (data) => relayEvent('getOffer', data));
  socket.on('answer', (data) => relayEvent('getAnswer', data));
  socket.on('candidate', (data) => relayEvent('getCandidate', data));

  // Handle incoming signaling (server -> client)
  socket.on('getOffer', (data) => {
    const { fromUserId, payload, isEncrypted } = data;
    // Forward to client - client will handle decryption
    socket.emit('offer', { fromUserId, payload, isEncrypted });
  });

  socket.on('getAnswer', (data) => {
    const { fromUserId, payload, isEncrypted } = data;
    // Forward to client - client will handle decryption
    socket.emit('answer', { fromUserId, payload, isEncrypted });
  });

  socket.on('getCandidate', (data) => {
    const { fromUserId, payload, isEncrypted } = data;
    // Forward to client - client will handle decryption
    socket.emit('candidate', { fromUserId, payload, isEncrypted });
  });

  // New endpoint: Get recipient's public key for signaling encryption
  socket.on('getSignalingPublicKey', async (data, callback) => {
    try {
      const { recipientUserId } = data;
      
      if (!recipientUserId) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Recipient user ID is required' });
        }
        return;
      }

      const publicKey = await signalingService.getRecipientPublicKey(recipientUserId);
      
      if (typeof callback === 'function') {
        callback({ 
          success: true, 
          publicKey,
          encryptionType: 'RSA_PUBLIC'
        });
      }
    } catch (error) {
      logger.error(`Error getting signaling public key:`, error);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });
};