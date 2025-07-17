const logger = require('../core/logger');

class PresenceService {
  constructor() {
    this.onlineUsersByUserId = new Map();
    this.socketIdToUserId = new Map();
    this.io = null;
    this.heartbeatInterval = null;
  }

  start(io) {
    this.io = io;
    this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), 7000);
    logger.info('[Presence] Service started with heartbeat checks.');
  }

  registerUser(socket, { userId, username }) {
    if (!userId) {
      logger.warn(`[Presence] Register attempt from ${socket.id} without userId.`);
      return { success: false, message: 'User ID is required.' };
    }
    if (this.onlineUsersByUserId.has(userId)) {
      logger.warn(`[Presence] User ${userId} is already registered.`);
      return { success: false, message: 'User ID is already in use.' };
    }
    const userSessionData = {
      socketId: socket.id,
      username: username || userId,
      lastHeartbeat: Date.now(),
    };
    this.onlineUsersByUserId.set(userId, userSessionData);
    this.socketIdToUserId.set(socket.id, userId);
    socket.userId = userId;
    this.broadcastOnlineUsersList(`User ${username} joined`);
    return { success: true, message: 'Registered successfully.' };
  }

  handleHeartbeat(socketId, ack) {
    const userId = this.socketIdToUserId.get(socketId);
    if (userId && this.onlineUsersByUserId.has(userId)) {
      this.onlineUsersByUserId.get(userId).lastHeartbeat = Date.now();
      if(typeof ack === 'function') ack({ status: 'received' });
    } else {
      if(typeof ack === 'function') ack({ status: 'error', message: 'Not registered.' });
    }
  }

  removeUser(socketId) {
    const userId = this.socketIdToUserId.get(socketId);
    if (userId && this.onlineUsersByUserId.has(userId)) {
      const userInfo = this.onlineUsersByUserId.get(userId);
      if (userInfo.socketId === socketId) {
        this.onlineUsersByUserId.delete(userId);
        this.broadcastOnlineUsersList(`User ${userInfo.username} left`);
      }
    }
    this.socketIdToUserId.delete(socketId);
  }

  getOnlineUsersList() {
    return Array.from(this.onlineUsersByUserId.values()).map(data => ({
      userId: this.socketIdToUserId.get(data.socketId),
      username: data.username,
    }));
  }
  
  getUserSocketId(userId) {
    const session = this.onlineUsersByUserId.get(userId);
    return session ? session.socketId : null;
  }

  getUserSocketIdByUsername(username) {
    for (const [userId, userData] of this.onlineUsersByUserId.entries()) {
      if (userData.username === username) return userData.socketId;
    }
    return null;
  }

  broadcastOnlineUsersList(reason = "User list updated") {
    logger.info(`[Presence] ${reason}.`);
    this.io.emit('online_users_update', this.getOnlineUsersList());
  }

  checkHeartbeats() {
    const now = Date.now();
    const HEARTBEAT_TIMEOUT_SERVER = 15 * 1000;
    this.onlineUsersByUserId.forEach((userInfo, userId) => {
      if (now - userInfo.lastHeartbeat > HEARTBEAT_TIMEOUT_SERVER) {
        logger.warn(`[Presence] User ${userId} timed out. Removing.`);
        const timedOutSocket = this.io.sockets.sockets.get(userInfo.socketId);
        if (timedOutSocket) {
          timedOutSocket.emit('session_terminated', { message: 'Your session timed out.' });
          timedOutSocket.disconnect(true);
        } else {
            this.removeUser(userInfo.socketId);
        }
      }
    });
  }
}

module.exports = new PresenceService();