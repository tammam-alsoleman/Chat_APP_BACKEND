const messagingRoutes = require('./interfaces/http/messaging.routes');
const registerMessagingHandlers = require('./interfaces/socket/messaging.handler');
const messagingService = require('./messaging.service');

module.exports = {
    messagingRoutes,
    registerMessagingHandlers,
    messagingService,
};