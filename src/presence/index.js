const registerPresenceHandlers = require('./presence.handler');
const presenceService = require('./presence.service');

module.exports = registerPresenceHandlers;
module.exports.presenceService = presenceService;