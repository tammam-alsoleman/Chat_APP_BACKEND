// src/group/index.js

const { registerGroupHandlers } = require('./group.handler');
const groupService = require('./group.service');

// We are not using the on-connection handler in our final architecture,
// so we don't need to import or export handleGroupConnection.
// If you were using it, the line would be here.

/**
 * This file acts as the public interface for the 'group' module.
 * Any other part of the application that needs to interact with the group
 * functionality should import it from here, not from the individual files.
 */
module.exports = {
  registerGroupHandlers,
  groupService,
};