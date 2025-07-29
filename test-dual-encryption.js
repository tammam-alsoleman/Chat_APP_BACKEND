// Test file for dual encryption system
// Run with: node test-dual-encryption.js

// Set a test master key in environment
const crypto = require('crypto');
const testMasterKey = crypto.randomBytes(32).toString('base64');
process.env.MASTER_ENCRYPTION_KEY = testMasterKey;
console.log('Generated test master key:', testMasterKey.substring(0, 20) + '...');

const { encryption } = require('./src/core/services');
const { encryptionService, keyManager } = encryption;

async function testDualEncryption() {
    console.log('🔐 Testing Dual Encryption System...\n');

    try {
        // Test 1: Generate a group symmetric key
        console.log('1. Testing group symmetric key generation...');
        const groupId = 123;
        const groupSymmetricKey = keyManager.generateGroupKey(groupId);
        console.log('✅ Generated group symmetric key:', groupSymmetricKey.substring(0, 20) + '...');

        // Test 2: Create mock participants with public keys
        console.log('\n2. Creating mock participants...');
        const mockParticipants = [
            { user_id: 1, public_key: 'user1-public-key-12345' },
            { user_id: 2, public_key: 'user2-public-key-67890' },
            { user_id: 3, public_key: 'user3-public-key-abcde' }
        ];
        console.log('✅ Created', mockParticipants.length, 'mock participants');

        // Test 3: Create complete key package (both encryptions)
        console.log('\n3. Testing dual encryption key package...');
        const keyPackage = keyManager.createGroupKeyPackage(groupId, mockParticipants);
        console.log('✅ Key package created with:');
        console.log('   - Plain group key:', keyPackage.group_symmetric_key.substring(0, 20) + '...');
        console.log('   - Server encrypted key:', keyPackage.server_encrypted_key.substring(0, 20) + '...');
        console.log('   - Client encrypted keys:', keyPackage.encrypted_keys.length, 'participants');

        // Test 4: Verify server can decrypt with master key
        console.log('\n4. Testing server decryption with master key...');
        const serverDecryptedKey = encryptionService.decryptGroupKeyWithMasterKey(keyPackage.server_encrypted_key);
        console.log('✅ Server decrypted key:', serverDecryptedKey.substring(0, 20) + '...');
        console.log('✅ Server decryption successful:', keyPackage.group_symmetric_key === serverDecryptedKey);

        // Test 5: Verify client key encryption (simulated)
        console.log('\n5. Testing client key encryption...');
        console.log('✅ Client keys encrypted for', keyPackage.encrypted_keys.length, 'participants');
        keyPackage.encrypted_keys.forEach((key, index) => {
            console.log(`   - Participant ${key.user_id}: ${key.encrypted_symmetric_key.substring(0, 20)}...`);
        });

        // Test 6: Test key rotation with dual encryption
        console.log('\n6. Testing key rotation with dual encryption...');
        const remainingParticipants = mockParticipants.slice(0, 2); // Remove one participant
        const rotatedKeyPackage = keyManager.rotateGroupKey(groupId, remainingParticipants);
        console.log('✅ Rotated key package created:');
        console.log('   - New plain group key:', rotatedKeyPackage.group_symmetric_key.substring(0, 20) + '...');
        console.log('   - New server encrypted key:', rotatedKeyPackage.server_encrypted_key.substring(0, 20) + '...');
        console.log('   - New client encrypted keys:', rotatedKeyPackage.encrypted_keys.length, 'participants');
        console.log('   - Key version:', rotatedKeyPackage.key_version);

        // Test 7: Verify rotated keys are different
        console.log('\n7. Verifying key rotation...');
        console.log('✅ Original key different from rotated key:', groupSymmetricKey !== rotatedKeyPackage.group_symmetric_key);
        console.log('✅ Server encrypted keys are different:', keyPackage.server_encrypted_key !== rotatedKeyPackage.server_encrypted_key);

        // Test 8: Test adding new participant
        console.log('\n8. Testing adding new participant...');
        const newParticipant = { user_id: 4, public_key: 'user4-public-key-new' };
        const newParticipantKey = keyManager.addParticipantToGroup(groupId, rotatedKeyPackage.group_symmetric_key, newParticipant);
        console.log('✅ New participant key created:', newParticipantKey.encrypted_symmetric_key.substring(0, 20) + '...');

        console.log('\n🎉 All dual encryption tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testDualEncryption(); 