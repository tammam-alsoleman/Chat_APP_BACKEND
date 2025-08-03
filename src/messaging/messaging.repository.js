const sql = require('mssql');
const { getPool } = require('../core/db');

class MessagingRepository {
    async createGroup(groupName) {
        const pool = await getPool();
        const result = await pool.request()
            .input('group_name', sql.NVarChar(255), groupName)
            .query('INSERT INTO group_info (group_name, created_at) OUTPUT INSERTED.group_id VALUES (@group_name, GETDATE())');
        return result.recordset[0].group_id;
    }

    async addParticipantByUsername(groupId, username) {
        const pool = await getPool();
        await pool.request()
            .input('group_id', sql.BigInt, groupId)
            .input('user_name', sql.NVarChar(50), username)
            .query('INSERT INTO group_participant (group_id, user_id) SELECT @group_id, user_id FROM user_account WHERE user_name = @user_name');
    }

    async findGroupsByUserId(userId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('user_id', sql.Int, userId)
            .query(`
                SELECT 
                    gi.group_id, 
                    gi.group_name, 
                    gi.created_at,
                    gp.group_key AS encrypted_group_key -- <-- Include the permanent key
                FROM 
                    group_info gi 
                JOIN 
                    group_participant gp ON gi.group_id = gp.group_id 
                WHERE 
                    gp.user_id = @user_id
            `);
        return result.recordset;
    }

    async isUserInGroup(userId, groupId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('group_id', sql.BigInt, groupId)
            .input('user_id', sql.Int, userId)
            .query('SELECT COUNT(*) AS count FROM group_participant WHERE group_id = @group_id AND user_id = @user_id');
        return result.recordset[0].count > 0;
    }

    async createMessage({ group_id, sender_id, text_message, clientMessageId }) {
        const pool = await getPool();
        const result = await pool.request()
            .input('group_id', sql.BigInt, group_id)
            .input('sender_id', sql.Int, sender_id)
            .input('text_message', sql.NVarChar(sql.MAX), text_message)
            .input('client_message_id', sql.NVarChar(sql.MAX), clientMessageId)
            .query('INSERT INTO message (group_id, sender_id, sent_at, text_message, client_message_id) OUTPUT INSERTED.message_id, INSERTED.sent_at VALUES (@group_id, @sender_id, GETDATE(), @text_message, @client_message_id)');
        return result.recordset[0];
    }

    async findMessageByClientId(clientMessageId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('client_message_id', sql.NVarChar(sql.MAX), clientMessageId)
            .query('SELECT * FROM message WHERE client_message_id = @client_message_id');
        return result.recordset[0];
    }
    
    async findMessagesByGroupId(groupId, options = {}) {
        const { beforeMessageId, limit = 30 } = options; 
        const pool = await getPool();
        const request = await pool.request();
        
        let whereClause = `WHERE m.group_id = @group_id`;
        request.input('group_id', sql.BigInt, groupId);

        if (beforeMessageId) {
            whereClause += ` AND m.message_id < @beforeMessageId`;
            request.input('beforeMessageId', sql.Int, beforeMessageId);
        }
        
        // بناء الاستعلام النهائي
        // نستخدم TOP لجلب عدد محدد من الرسائل (limit)
        // ونرتب تنازلياً لجلب الأحدث أولاً، ثم نعكس الترتيب في التطبيق إذا لزم الأمر
        const query = `
            SELECT TOP ${limit}
                m.message_id, 
                m.sender_id, 
                u.user_name, 
                m.sent_at, 
                m.text_message 
            FROM 
                message m 
            JOIN 
                user_account u ON m.sender_id = u.user_id 
            ${whereClause}
            ORDER BY 
                m.message_id DESC
        `;

        const result = await request.query(query);

        // النتيجة الآن مرتبة من الأحدث إلى الأقدم، قد تحتاج إلى عكسها في العميل
        // .reverse()
        return result.recordset;
    }

    async findGroupParticipantUsernames(groupId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('group_id', sql.BigInt, groupId)
            .query('SELECT ua.user_name FROM user_account ua JOIN group_participant gp ON ua.user_id = gp.user_id WHERE gp.group_id = @group_id');
        return result.recordset.map(user => user.user_name);
    }
}

module.exports = new MessagingRepository();