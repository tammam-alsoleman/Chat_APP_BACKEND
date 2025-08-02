// src/group/group.repository.js

const sql = require('mssql');
const { getPool } = require('../core/db');

class GroupRepository {
  /**
   * Fetches public keys for a given list of user IDs from the database.
   * @param {number[]} userIds - An array of user IDs.
   * @returns {Promise<{[userId: string]: string}>} A map of user IDs to their public keys.
   */
  async getPublicKeysByUserIds(userIds) {
    if (!userIds || userIds.length === 0) return {};
    const pool = await getPool();
    const query = `
      SELECT user_id, public_key
      FROM user_account
      WHERE user_id IN (${userIds.map((_, i) => `@id${i}`).join(',')})
    `;
    const request = pool.request();
    userIds.forEach((id, index) => {
      request.input(`id${index}`, sql.Int, id);
    });
    const result = await request.query(query);
    const publicKeys = {};
    result.recordset.forEach(row => {
      publicKeys[row.user_id] = row.public_key;
    });
    return publicKeys;
  }

  /**
   * Stores a user's specific encrypted group key in the group_participant table.
   * This key is stored permanently as a secure backup for the user.
   * @param {number} groupId - The ID of the group.
   * @param {number} userId - The ID of the user.
   * @param {string} encryptedGroupKey - The group's symmetric key, encrypted with this user's public key.
   */
  async updateGroupKey(groupId, userId, encryptedGroupKey) {
    const pool = await getPool();
    const request = pool.request();
    request.input('groupKey', sql.NVarChar(sql.MAX), encryptedGroupKey);
    request.input('groupId', sql.BigInt, groupId);
    request.input('userId', sql.Int, userId);
    await request.query(`
      UPDATE group_participant
      SET group_key = @groupKey
      WHERE group_id = @groupId AND user_id = @userId
    `);
  }

  
  async createGroup(groupId, groupName) {
      const pool = await getPool();
      const request = pool.request();
      // ===== THE FIX IS HERE =====
      request.input('groupId', sql.BigInt, groupId);
      // ===========================
      request.input('groupName', sql.NVarChar(255), groupName);
    
      await request.query(`
        INSERT INTO group_info (group_id, group_name, created_at)
        VALUES (@groupId, @groupName, GETDATE())
      `);
  }

/**
 * Adds multiple participants to the group_participant table in a single operation.
 * @param {number} groupId - The ID of the group.
 * @param {number[]} userIds - An array of user IDs to add as participants.
 */
async addGroupParticipants(groupId, userIds) {
  if (!userIds || userIds.length === 0) return;

  const pool = await getPool();
  // Using a Table-Valued Parameter or a bulk insert is most efficient for MSSQL.
  const table = new sql.Table('group_participant');
  table.columns.add('group_id', sql.BigInt, { nullable: false });
  table.columns.add('user_id', sql.Int, { nullable: false });
  
  userIds.forEach(userId => {
    table.rows.add(groupId, userId);
  });

  const request = pool.request();
  await request.bulk(table);
}

}

module.exports = new GroupRepository();