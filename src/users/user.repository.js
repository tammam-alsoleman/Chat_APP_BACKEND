const sql = require('mssql');
const { getPool } = require('../core/db');

class UserRepository {
    async findByUsername(userName) {
        const pool = await getPool();
        const result = await pool.request()
            .input('user_name', sql.NVarChar(50), userName)
            .query('SELECT * FROM user_account WHERE user_name = @user_name');
        return result.recordset[0];
    }

    async findById(userId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('user_id', sql.Int, userId)
            .query('SELECT user_id, user_name, display_name FROM user_account WHERE user_id = @user_id');
        return result.recordset[0];
    }

    async create({ user_name, password, display_name }) {
        const pool = await getPool();
        const result = await pool.request()
            .input('user_name', sql.NVarChar(50), user_name)
            .input('password', sql.NVarChar(255), password)
            .input('display_name', sql.NVarChar(50), display_name)
            .query('INSERT INTO user_account (user_name, password, display_name) OUTPUT INSERTED.user_id VALUES (@user_name, @password, @display_name)');
        return result.recordset[0];
    }

    async searchByDisplayName(query) {
        const pool = await getPool();
        const result = await pool.request()
            .input('display_name', sql.NVarChar(50), `%${query}%`)
            .query('SELECT user_name, user_id, display_name FROM user_account WHERE display_name LIKE @display_name');
        return result.recordset;
    }
}

module.exports = new UserRepository();