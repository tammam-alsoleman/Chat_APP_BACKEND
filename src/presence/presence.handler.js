const presenceService = require('./presence.service');
const logger = require('../core/logger');

module.exports = function registerPresenceHandlers(io, socket) {
  socket.on('register_presence', (data, callback) => {
    logger.info(`[Socket] Event 'register_presence' from ${socket.id}`);
    const result = presenceService.registerUser(socket, data || {});
    if (typeof callback === 'function') callback(result);
  });

  socket.on('heartbeat', (ack) => {
    presenceService.handleHeartbeat(socket.id, ack);
  });
  
  socket.on('get_initial_online_users', (callback) => {
    const users = presenceService.getOnlineUsersList();
    if(typeof callback === 'function') callback(users);
  });

  socket.on('disconnect', () => {
    presenceService.removeUser(socket.id);
  });
};