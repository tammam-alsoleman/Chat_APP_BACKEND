const { authRouter, userRouter } = require('./user.routes');
const userService = require('./user.service');
const userRepository = require('./user.repository'); 

module.exports = {
  authRouter,
  userRouter,
  userService,
  userRepository, 
};