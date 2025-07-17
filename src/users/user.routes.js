const express = require('express');
const userController = require('./user.controller');
const authenticateToken = require('./middleware/auth');

const authRouter = express.Router();
const userRouter = express.Router();

authRouter.post('/sign_up', userController.signUp);
authRouter.post('/log_in', userController.logIn);

userRouter.use(authenticateToken);
userRouter.get('/search', userController.searchUsers);
userRouter.get('/me', userController.getMe);

module.exports = { authRouter, userRouter };
