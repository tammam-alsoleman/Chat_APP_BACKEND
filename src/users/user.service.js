const jwt = require('jsonwebtoken');
const config = require('../core/config');
const userRepository = require('./user.repository');
const logger = require('../core/logger');

class UserService {
async signUp({ user_name, password, display_name }) {
    const existingUser = await userRepository.findByUsername(user_name);
    if (existingUser) throw new Error('User with the same username already exists');

    const newUser = await userRepository.create({ user_name, password, display_name });
    const token = jwt.sign({ user_id: newUser.user_id }, config.JWT_SECRET, { expiresIn: '1h' });
    
    logger.info('User created successfully:', { userId: newUser.user_id });
    return { user_id: newUser.user_id, token };
}

    async logIn({ user_name, password }) {
        const user = await userRepository.findByUsername(user_name);
        if (!user) throw new Error('User not found');

        if (user.password !== password) throw new Error('Password not true');

        const token = jwt.sign({ user_id: user.user_id }, config.JWT_SECRET, { expiresIn: '1h' });
        logger.info('User logged in successfully:', { userId: user.user_id });
        return { user_id: user.user_id, display_name: user.display_name, token };
    }

    async searchUsers(query) {
        return userRepository.searchByDisplayName(query);
    }
    
    async getUserInfo(userId) {
        const user = await userRepository.findById(userId);
        if (!user) throw new Error('User not found');
        return user;
    }
}

module.exports = new UserService();
