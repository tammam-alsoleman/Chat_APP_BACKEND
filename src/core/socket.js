const { Server } = require('socket.io');
const logger = require('./logger');
const { presenceService } = require('../presence');
const registerPresenceHandlers = require('../presence/presence.handler');
const registerSignalingHandlers = require('../signaling/signaling.handler');
const { registerMessagingHandlers } = require('../messaging');
const jwt = require('jsonwebtoken');
const config = require('./config');

const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    }
  });

  presenceService.start(io);

  // JWT authentication middleware for socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      logger.warn(`[Socket.IO Auth] No token provided for socket ${socket.id}`);
      return next(new Error('Authentication error: No token provided'));
    }
    jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
      if (err) {
        logger.warn(`[Socket.IO Auth] Invalid token for socket ${socket.id}: ${err.message}`);
        return next(new Error('Authentication error: Invalid token'));
      }
      socket.userId = decoded.user_id; // Attach userId to socket
      next();
    });
  });

  const onConnection = (socket) => {
    registerPresenceHandlers(io, socket);
    registerSignalingHandlers(io, socket);
    registerMessagingHandlers(io, socket);
    logger.info(`Socket.IO connection established with ID: ${socket.id}, userId: ${socket.userId}`);
    socket.on('disconnect', (reason) => {
      logger.info(`[Socket] Connection disconnected: ${socket.id}. Reason: ${reason}`);
    });
  };

  io.on('connection', onConnection);
  logger.info('Socket.IO initialized.');
  return io;
};

module.exports = { initializeSocket };