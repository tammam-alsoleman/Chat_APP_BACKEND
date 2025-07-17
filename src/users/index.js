const { authRouter, userRouter } = require('./user.routes');
const userService = require('./user.service');

module.exports = {
  authRouter,
  userRouter,
  userService,
};