const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const config = require('../core/config');
const userRepository = require('./user.repository');
const logger = require('../core/logger');

class UserService {
async signUp({ user_name, password, display_name, public_key }) {
    const existingUser = await userRepository.findByUsername(user_name);
    if (existingUser) throw new Error('User with the same username already exists');

    // Validate public key format (basic check)
    if (!public_key || public_key.length < 100) {
        throw new Error('Invalid public key format');
    }

    // Hash the password before storing
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await userRepository.create({ user_name, password: hashedPassword, display_name, public_key });
    const token = jwt.sign({ user_id: newUser.user_id }, config.JWT_SECRET, { expiresIn: '1h' });
    
    logger.info('User created successfully with public key:', { userId: newUser.user_id });
    return { user_id: newUser.user_id, token };
}

    async logIn({ user_name, password }) {
        const user = await userRepository.findByUsername(user_name);
        if (!user) throw new Error('User not found');

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) throw new Error('Invalid password');

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

    async getPublicKey(userId) {
        const publicKey = await userRepository.getPublicKey(userId);
        if (!publicKey) throw new Error('User public key not found');
        return { public_key: publicKey };
    }
}

module.exports = new UserService();
