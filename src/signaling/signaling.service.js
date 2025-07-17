const { presenceService } = require('../presence');

class SignalingService {
  getTargetSocketId(targetUserId) {
    return presenceService.getUserSocketId(targetUserId);
  }
}

module.exports = new SignalingService();