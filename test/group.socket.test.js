const io = require('socket.io-client');
const { expect } = require('chai');
const http = require('http');
const { initializeSocket } = require('../src/core/socket');
const config = require('../src/core/config');

describe('Group Socket Handlers', function() {
  let server, clientSocket, port;

  before(function(done) {
    const app = http.createServer();
    server = initializeSocket(app);
    app.listen(() => {
      port = app.address().port;
      clientSocket = io(`http://localhost:${port}`, {
        auth: {
          token: 'test-token' // You may need to mock JWT verification or adjust accordingly
        }
      });
      clientSocket.on('connect', done);
    });
  });

  after(function(done) {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    server.close(done);
  });

  it('should receive public keys for get_public_keys event', function(done) {
    const testUserIds = [1, 2];
    clientSocket.emit('get_public_keys', testUserIds, (response) => {
      expect(response).to.have.property('success', true);
      expect(response).to.have.property('publicKeys');
      done();
    });
  });

  it('should receive group public keys on create_group event', function(done) {
    const groupId = 1;
    const participantIds = [1, 2];
    clientSocket.emit('create_group', { groupId, participantIds });
    clientSocket.on('group_public_keys', (data) => {
      expect(data).to.have.property('groupId', groupId);
      expect(data).to.have.property('publicKeys');
      done();
    });
  });

  it('should receive encrypted group key on send_group-key event', function(done) {
    const groupId = 1;
    const username = 'testuser';
    const encryptedGroupKey = 'encryptedKey123';

    clientSocket.emit('send_group-key', { groupId, username, encryptedGroupKey });

    clientSocket.on('receive_group_key', (data) => {
      expect(data).to.have.property('groupId', groupId);
      expect(data).to.have.property('encryptedGroupKey', encryptedGroupKey);
      done();
    });
  });
});
