const { Server } = require('socket.io');
const logger = require('./logger');
const { presenceService } = require('../presence');
const registerPresenceHandlers = require('../presence/presence.handler');
const registerSignalingHandlers = require('../signaling/signaling.handler');

const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  presenceService.start(io);

  const onConnection = (socket) => {
    registerPresenceHandlers(io, socket);
    registerSignalingHandlers(io, socket);
  };

  io.on('connection', onConnection);
  logger.info('Socket.IO initialized.');
  return io;
};

module.exports = { initializeSocket };