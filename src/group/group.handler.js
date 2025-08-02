// src/group/group.handler.js

const groupService = require('./group.service');
const { presenceService } = require('../presence');
const logger = require('../core/logger');

const registerGroupHandlers = (io, socket) => {

  /**
   * STEP 1: Initiate group creation and get public keys.
   * The client (creator) sends a list of participant user IDs.
   * The server finds and returns the public keys for all those users.
   */
  socket.on('initiate_group_creation', async (data, callback) => {

    logger.info(`[Group] Received 'initiate_group_creation' from user ${socket.userId}. Data: ${JSON.stringify(data)}`);

    try {
      const { participantUserIds } = data;
      if (!participantUserIds || !Array.isArray(participantUserIds)) {
        if (typeof callback === 'function') callback({ success: false, error: 'participantUserIds array is required.' });
        return;
      }

      const creatorId = socket.userId;
      if (!participantUserIds.includes(creatorId)) {
        participantUserIds.push(creatorId);
      }

      logger.info(`[Group] Fetching public keys for users: ${participantUserIds.join(', ')}`);


      const publicKeys = await groupService.getPublicKeysForUsers(participantUserIds);
      logger.info(`[Group] Successfully fetched public keys. Sending ack back to client.`);
      logger.info(`[Group] Creator ${creatorId} is initiating a group. Returning public keys.`);
      if (typeof callback === 'function') {
        callback({ success: true, publicKeys });
      }
    } catch (error) {
      logger.error(`Error in initiate_group_creation handler: ${error.message}`);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to retrieve public keys.' });
      }
    }
  });

  /**
   * STEP 2: Distribute and Store the encrypted keys.
   * After the creator encrypts the group key for each user, they send the
   * entire batch to the server. The server then (1) permanently stores each key
   * in the database, and (2) relays the key to any corresponding online user.
   */
  socket.on('distribute_encrypted_keys', async (data) => {
    const { groupId, encryptedKeys } = data;
    const creatorId = socket.userId;

    if (!groupId || !encryptedKeys) {
      logger.warn(`[Group] Invalid 'distribute_encrypted_keys' event from creator ${creatorId}`);
      return;
    }

    try {
      const participantUserIds = Object.keys(encryptedKeys).map(id => parseInt(id, 10));
      const groupName = `Group with ${participantUserIds.length} members`;

      // Use the groupId provided by the client to create the records.
      await groupService.createGroup(groupId, groupName);
      await groupService.addGroupParticipants(groupId, participantUserIds);
      await groupService.storeEncryptedGroupKeys(groupId, encryptedKeys);
      
      logger.info(`[Group] Successfully created group ${groupId} and stored keys.`);

      // Distribute keys to online users.
      for (const [userId, encryptedKey] of Object.entries(encryptedKeys)) {
        const targetSocketId = presenceService.getUserSocketId(parseInt(userId, 10));
        if (targetSocketId) {
          io.to(targetSocketId).emit('receive_group_key', {
            groupId: groupId,
            encryptedKey,
            fromUserId: creatorId
          });
        }
      }
    } catch (error) {
        logger.error(`[Group] Failed to distribute/store keys for group ${groupId}:`, error);
        // Optionally, emit an error back to the creator
        socket.emit('group_error', { groupId, message: 'Failed to save or distribute keys.' });
    }
  });


};

module.exports = { registerGroupHandlers };