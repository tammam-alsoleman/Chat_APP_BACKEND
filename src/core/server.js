const express = require('express');
const http = require('http');
const cors = require('cors');
const logger = require('./logger');

const { authRouter, userRouter } = require('../users/user.routes');
const messagingRoutes = require('../messaging/interfaces/http/messaging.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter); // Use authRouter directly
app.use('/api/users', userRouter); // Use userRouter directly
app.use('/api/chats', messagingRoutes);

app.get('/', (req, res) => res.send('Chat Server is running !'));

const startServer = (port) => {
  const server = http.createServer(app);
  server.listen(port,'0.0.0.0', () => logger.info(`HTTP Server running on port ${port}`));
  server.app = app;
  return server;
};

module.exports = { startServer };
