// src/group/group.service.js

const groupRepository = require('./group.repository');
const userRepository = require('../users/user.repository'); // Assuming it's accessible

class GroupService {
  /**
   * Service method to fetch public keys for a list of users.
   * @param {number[]} userIds - An array of user IDs.
   */
  async getPublicKeysForUsers(userIds) {
    return groupRepository.getPublicKeysByUserIds(userIds);
  }

  /**
   * Service method to permanently store the encrypted group keys for all participants.
   * @param {number} groupId - The ID of the group.
   * @param {{[userId: string]: string}} encryptedKeys - A map of user IDs to their encrypted group key.
   */
  async storeEncryptedGroupKeys(groupId, encryptedKeys) {
    const storagePromises = [];
    for (const [userId, encryptedKey] of Object.entries(encryptedKeys)) {
      const promise = groupRepository.updateGroupKey(groupId, parseInt(userId, 10), encryptedKey);
      storagePromises.push(promise);
    }
    await Promise.all(storagePromises);
  }
 
  
  async createGroup(groupId, groupName) {
      return groupRepository.createGroup(groupId, groupName);
  }

  // And also add the new addGroupParticipants function
  /**
  * Service method for adding a list of participants to a group.
  * @param {number} groupId - The ID of the group.
  * @param {number[]} userIds - An array of user IDs to add.
  */

  async addGroupParticipants(groupId, userIds) {
    return groupRepository.addGroupParticipants(groupId, userIds);
  }

}

module.exports = new GroupService();