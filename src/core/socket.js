const { Server } = require('socket.io');
const logger = require('./logger');
const { presenceService } = require('../presence');
const registerPresenceHandlers = require('../presence/presence.handler');
const registerSignalingHandlers = require('../signaling/signaling.handler');
const { registerMessagingHandlers } = require('../messaging'); 

const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    }
  });

  presenceService.start(io);

  const onConnection = (socket) => {
    registerPresenceHandlers(io, socket);
    registerSignalingHandlers(io, socket);
    registerMessagingHandlers(io, socket);
    logger.info(`Socket.IO connection established with ID: ${socket.id}`);
    socket.on('disconnect', (reason) => {
      logger.info(`[Socket] Connection disconnected: ${socket.id}. Reason: ${reason}`);
    });
  };

  io.on('connection', onConnection);
  logger.info('Socket.IO initialized.');
  return io;
};

module.exports = { initializeSocket };