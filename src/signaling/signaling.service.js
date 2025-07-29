const { presenceService } = require('../presence');
const { userRepository } = require('../users');
const logger = require('../core/logger');

class SignalingService {
  getTargetSocketId(targetUserId) {
    return presenceService.getUserSocketId(targetUserId);
  }

  /**
   * Get recipient's public key for signaling encryption
   * @param {number} recipientUserId - The recipient's user ID
   * @returns {Promise<string>} Recipient's public key
   */
  async getRecipientPublicKey(recipientUserId) {
    try {
      const user = await userRepository.findById(recipientUserId);
      if (!user) {
        throw new Error('Recipient user not found');
      }
      
      if (!user.public_key) {
        throw new Error('Recipient has no public key');
      }
      
      logger.info(`Retrieved public key for user ${recipientUserId}`);
      return user.public_key;
    } catch (error) {
      logger.error(`Error getting public key for user ${recipientUserId}:`, error);
      throw new Error('Failed to get recipient public key');
    }
  }

  /**
   * Validate encrypted signaling packet format
   * @param {object} encryptedPackage - The encrypted signaling package
   * @returns {boolean} True if valid format
   */
  validateEncryptedSignalingPackage(encryptedPackage) {
    try {
      return (
        encryptedPackage &&
        encryptedPackage.encryptedData &&
        encryptedPackage.encryptionType === 'RSA_PUBLIC' &&
        typeof encryptedPackage.encryptedData === 'string' &&
        encryptedPackage.encryptedData.length > 0
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Log signaling encryption status for monitoring
   * @param {string} eventName - The signaling event name
   * @param {number} fromUserId - Sender user ID
   * @param {number} toUserId - Recipient user ID
   * @param {boolean} isEncrypted - Whether the packet is encrypted
   */
  logSignalingEvent(eventName, fromUserId, toUserId, isEncrypted) {
    logger.info(`[Signaling] ${eventName} from ${fromUserId} to ${toUserId} (encrypted: ${isEncrypted})`);
  }
}

module.exports = new SignalingService();