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
      logger.info(`[Signaling] Relaying '${eventName}' from ${fromUserId} to ${toUserId}`);
      io.to(targetSocketId).emit(eventName, { fromUserId, payload });
    } else {
      logger.warn(`[Signaling] Target user ${toUserId} for '${eventName}' is not online.`);
      socket.emit('call_error', { targetUserId: toUserId, message: 'Target user is not online.' });
    }
  };

  socket.on('offer', (data) => relayEvent('getOffer', data));
  socket.on('answer', (data) => relayEvent('getAnswer', data));
  socket.on('candidate', (data) => relayEvent('getCandidate', data));
};