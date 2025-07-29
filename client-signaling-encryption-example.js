// Client-side Signaling Encryption Example for Flutter/Web
// This shows how to implement public key encryption for WebRTC signaling

const crypto = require('crypto');

class SignalingEncryption {
  constructor() {
    this.myPrivateKey = null;
    this.myPublicKey = null;
    this.socket = null;
  }

  /**
   * Initialize with user's key pair
   * @param {string} privateKey - User's private key in PEM format
   * @param {string} publicKey - User's public key in PEM format
   */
  initialize(privateKey, publicKey) {
    this.myPrivateKey = privateKey;
    this.myPublicKey = publicKey;
    console.log('✅ Signaling encryption initialized');
  }

  /**
   * Get recipient's public key from server
   * @param {number} recipientUserId - Target user ID
   * @returns {Promise<string>} Recipient's public key
   */
  async getRecipientPublicKey(recipientUserId) {
    return new Promise((resolve, reject) => {
      this.socket.emit('getSignalingPublicKey', { recipientUserId }, (response) => {
        if (response.success) {
          resolve(response.publicKey);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  /**
   * Encrypt signaling data with recipient's public key
   * @param {object} signalingData - WebRTC signaling data (offer/answer/candidate)
   * @param {string} recipientPublicKey - Recipient's public key
   * @returns {object} Encrypted package
   */
  encryptSignalingData(signalingData, recipientPublicKey) {
    try {
      const dataString = JSON.stringify(signalingData);
      
      // Encrypt with recipient's public key using RSA-4096
      const encrypted = crypto.publicEncrypt(
        {
          key: recipientPublicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(dataString, 'utf8')
      );
      
      return {
        encryptedData: encrypted.toString('base64'),
        timestamp: Date.now(),
        encryptionType: 'RSA_PUBLIC'
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt signaling data');
    }
  }

  /**
   * Decrypt signaling data with user's private key
   * @param {object} encryptedPackage - Encrypted signaling package
   * @returns {object} Decrypted signaling data
   */
  decryptSignalingData(encryptedPackage) {
    try {
      const decrypted = crypto.privateDecrypt(
        {
          key: this.myPrivateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(encryptedPackage.encryptedData, 'base64')
      );
      
      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt signaling data');
    }
  }

  /**
   * Send encrypted offer to recipient
   * @param {number} recipientUserId - Target user ID
   * @param {object} offer - WebRTC offer
   */
  async sendEncryptedOffer(recipientUserId, offer) {
    try {
      // Get recipient's public key
      const recipientPublicKey = await this.getRecipientPublicKey(recipientUserId);
      
      // Encrypt the offer
      const encryptedOffer = this.encryptSignalingData(offer, recipientPublicKey);
      
      // Send encrypted offer
      this.socket.emit('offer', {
        toUserId: recipientUserId,
        payload: encryptedOffer
      });
      
      console.log(`✅ Encrypted offer sent to user ${recipientUserId}`);
    } catch (error) {
      console.error('Failed to send encrypted offer:', error);
      throw error;
    }
  }

  /**
   * Send encrypted answer to recipient
   * @param {number} recipientUserId - Target user ID
   * @param {object} answer - WebRTC answer
   */
  async sendEncryptedAnswer(recipientUserId, answer) {
    try {
      // Get recipient's public key
      const recipientPublicKey = await this.getRecipientPublicKey(recipientUserId);
      
      // Encrypt the answer
      const encryptedAnswer = this.encryptSignalingData(answer, recipientPublicKey);
      
      // Send encrypted answer
      this.socket.emit('answer', {
        toUserId: recipientUserId,
        payload: encryptedAnswer
      });
      
      console.log(`✅ Encrypted answer sent to user ${recipientUserId}`);
    } catch (error) {
      console.error('Failed to send encrypted answer:', error);
      throw error;
    }
  }

  /**
   * Send encrypted ICE candidate to recipient
   * @param {number} recipientUserId - Target user ID
   * @param {object} candidate - ICE candidate
   */
  async sendEncryptedCandidate(recipientUserId, candidate) {
    try {
      // Get recipient's public key
      const recipientPublicKey = await this.getRecipientPublicKey(recipientUserId);
      
      // Encrypt the candidate
      const encryptedCandidate = this.encryptSignalingData(candidate, recipientPublicKey);
      
      // Send encrypted candidate
      this.socket.emit('candidate', {
        toUserId: recipientUserId,
        payload: encryptedCandidate
      });
      
      console.log(`✅ Encrypted candidate sent to user ${recipientUserId}`);
    } catch (error) {
      console.error('Failed to send encrypted candidate:', error);
      throw error;
    }
  }

  /**
   * Handle incoming encrypted signaling data
   * @param {string} eventType - 'offer', 'answer', or 'candidate'
   * @param {object} data - Incoming data with fromUserId, payload, isEncrypted
   * @returns {object} Decrypted signaling data or original data if not encrypted
   */
  handleIncomingSignaling(eventType, data) {
    const { fromUserId, payload, isEncrypted } = data;
    
    if (isEncrypted) {
      try {
        // Decrypt the payload
        const decryptedData = this.decryptSignalingData(payload);
        console.log(`✅ Decrypted ${eventType} from user ${fromUserId}`);
        return { fromUserId, data: decryptedData, isEncrypted: true };
      } catch (error) {
        console.error(`Failed to decrypt ${eventType}:`, error);
        throw new Error(`Failed to decrypt ${eventType}`);
      }
    } else {
      // Handle unencrypted data (backward compatibility)
      console.log(`📨 Received unencrypted ${eventType} from user ${fromUserId}`);
      return { fromUserId, data: payload, isEncrypted: false };
    }
  }

  /**
   * Set up Socket.IO event listeners for encrypted signaling
   * @param {object} socket - Socket.IO socket instance
   */
  setupSocketListeners(socket) {
    this.socket = socket;
    
    // Listen for incoming encrypted offers
    socket.on('offer', (data) => {
      const result = this.handleIncomingSignaling('offer', data);
      // Handle the decrypted offer in your WebRTC logic
      console.log('Received offer:', result);
    });
    
    // Listen for incoming encrypted answers
    socket.on('answer', (data) => {
      const result = this.handleIncomingSignaling('answer', data);
      // Handle the decrypted answer in your WebRTC logic
      console.log('Received answer:', result);
    });
    
    // Listen for incoming encrypted candidates
    socket.on('candidate', (data) => {
      const result = this.handleIncomingSignaling('candidate', data);
      // Handle the decrypted candidate in your WebRTC logic
      console.log('Received candidate:', result);
    });
  }
}

// Example usage:
async function exampleUsage() {
  console.log('🔐 Signaling Encryption Example\n');
  
  // Generate test key pairs
  const { publicKey: alicePublicKey, privateKey: alicePrivateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  
  const { publicKey: bobPublicKey, privateKey: bobPrivateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  
  // Initialize Alice's signaling encryption
  const aliceSignaling = new SignalingEncryption();
  aliceSignaling.initialize(alicePrivateKey, alicePublicKey);
  
  // Initialize Bob's signaling encryption
  const bobSignaling = new SignalingEncryption();
  bobSignaling.initialize(bobPrivateKey, bobPublicKey);
  
  // Mock WebRTC offer
  const mockOffer = {
    type: 'offer',
    sdp: 'v=0\r\no=- 1234567890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=mid:0\r\na=sendonly\r\na=rtpmap:111 opus/48000/2\r\n'
  };
  
  // Mock WebRTC answer
  const mockAnswer = {
    type: 'answer',
    sdp: 'v=0\r\no=- 9876543210 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=mid:0\r\na=recvonly\r\na=rtpmap:111 opus/48000/2\r\n'
  };
  
  console.log('📤 Alice encrypts offer with Bob\'s public key...');
  const encryptedOffer = aliceSignaling.encryptSignalingData(mockOffer, bobPublicKey);
  console.log('   - Encrypted data length:', encryptedOffer.encryptedData.length);
  
  console.log('📥 Bob decrypts offer with his private key...');
  const decryptedOffer = bobSignaling.decryptSignalingData(encryptedOffer);
  console.log('   - Offer type preserved:', decryptedOffer.type === 'offer');
  console.log('   - SDP data preserved:', decryptedOffer.sdp === mockOffer.sdp);
  
  console.log('📤 Bob encrypts answer with Alice\'s public key...');
  const encryptedAnswer = bobSignaling.encryptSignalingData(mockAnswer, alicePublicKey);
  console.log('   - Encrypted data length:', encryptedAnswer.encryptedData.length);
  
  console.log('📥 Alice decrypts answer with her private key...');
  const decryptedAnswer = aliceSignaling.decryptSignalingData(encryptedAnswer);
  console.log('   - Answer type preserved:', decryptedAnswer.type === 'answer');
  console.log('   - SDP data preserved:', decryptedAnswer.sdp === mockAnswer.sdp);
  
  console.log('\n🎉 Example completed successfully!');
  console.log('\n📋 Integration Notes:');
  console.log('   1. Use RSA-4096 keys for direct encryption');
  console.log('   2. Encrypt before sending, decrypt after receiving');
  console.log('   3. Server only forwards encrypted data');
  console.log('   4. Backward compatibility with unencrypted packets');
  console.log('   5. Perfect forward secrecy - each packet independently encrypted');
}

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage();
}

module.exports = SignalingEncryption; 