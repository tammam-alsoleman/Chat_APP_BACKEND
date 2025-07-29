const userService = require('./user.service');
const { userSignInSchema, userLogInSchema } = require('./user.model');

class UserController {
    async signUp(req, res) {
        try {
            const { error, value } = userSignInSchema.validate(req.body);
            if (error) return res.status(400).json({ error: error.details[0].message });
            const result = await userService.signUp(value);
            res.status(201).json({ message: 'User created successfully', ...result });
        } catch (error) {
            const statusCode = error.message.includes('already exists') ? 409 : 500;
            res.status(statusCode).json({ error: error.message });
        }
    }

    async logIn(req, res) {
        try {
            const { error, value } = userLogInSchema.validate(req.body);
            if (error) return res.status(400).json({ error: error.details[0].message });
            const result = await userService.logIn(value);
            res.status(200).json({ message: 'Successfully logged in', ...result });
        } catch (error) {
            const statusCode = error.message.includes('not found') ? 404 : (error.message.includes('Password not true') ? 401 : 500);
            res.status(statusCode).json({ error: error.message });
        }
    }

    async searchUsers(req, res) {
        try {
            const { query } = req.query;
            if (!query) return res.status(400).json({ error: 'query parameter is required' });
            const users = await userService.searchUsers(query);
            res.status(200).json(users);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    async getMe(req, res) {
        try {
            const userId = req.user.user_id;
            const userInfo = await userService.getUserInfo(userId);
            res.status(200).json(userInfo);
        } catch (error) {
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json({ error: error.message });
        }
    }

    async getPublicKey(req, res) {
        try {
            const userId = req.user.user_id;
            const publicKey = await userService.getPublicKey(userId);
            res.status(200).json(publicKey);
        } catch (error) {
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json({ error: error.message });
        }
    }
}
module.exports = new UserController();
