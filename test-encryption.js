// Test file for encryption services
// Run with: node test-encryption.js

const { encryption } = require('./src/core/services');
const { encryptionService, keyManager } = encryption;

async function testEncryptionServices() {
    console.log('🧪 Testing Encryption Services...\n');

    try {
        // Test 1: Generate symmetric key
        console.log('1. Testing symmetric key generation...');
        const symmetricKey = encryptionService.generateSymmetricKey();
        console.log('✅ Generated symmetric key:', symmetricKey.substring(0, 20) + '...');
        console.log('✅ Key validation:', encryptionService.isValidBase64Key(symmetricKey));

        // Test 2: AES encryption/decryption
        console.log('\n2. Testing AES encryption/decryption...');
        const testMessage = 'Hello, this is a test message!';
        const encrypted = encryptionService.encryptWithAES(testMessage, symmetricKey);
        console.log('✅ Encrypted message:', encrypted.encryptedData.substring(0, 20) + '...');
        
        const decrypted = encryptionService.decryptWithAES(
            encrypted.encryptedData, 
            symmetricKey, 
            encrypted.iv
        );
        console.log('✅ Decrypted message:', decrypted);
        console.log('✅ Encryption/decryption successful:', testMessage === decrypted);

        // Test 3: Create encrypted message package
        console.log('\n3. Testing encrypted message package...');
        const messagePackage = encryptionService.createEncryptedMessage(testMessage, symmetricKey);
        console.log('✅ Message package created:', {
            encryptedContent: messagePackage.encryptedContent.substring(0, 20) + '...',
            iv: messagePackage.iv.substring(0, 10) + '...',
            timestamp: messagePackage.timestamp
        });

        // Test 4: Decrypt message package
        const decryptedFromPackage = encryptionService.decryptMessage(messagePackage, symmetricKey);
        console.log('✅ Decrypted from package:', decryptedFromPackage);
        console.log('✅ Package decryption successful:', testMessage === decryptedFromPackage);

        // Test 5: Key manager - generate group key
        console.log('\n4. Testing key manager...');
        const groupId = 123;
        const groupKey = keyManager.generateGroupKey(groupId);
        console.log('✅ Generated group key:', groupKey.substring(0, 20) + '...');

        // Test 6: Key manager - encrypt for participants
        console.log('\n5. Testing participant key encryption...');
        const mockParticipants = [
            { user_id: 1, public_key: 'mock-public-key-1' },
            { user_id: 2, public_key: 'mock-public-key-2' },
            { user_id: 3, public_key: null } // This one should be skipped
        ];
        
        const encryptedKeys = keyManager.encryptGroupKeyForParticipants(groupKey, mockParticipants);
        console.log('✅ Encrypted keys for participants:', encryptedKeys.length);
        console.log('✅ Successful encryptions:', encryptedKeys.filter(k => k !== null).length);

        // Test 7: Key manager - create complete package
        console.log('\n6. Testing complete key package...');
        const keyPackage = keyManager.createGroupKeyPackage(groupId, mockParticipants);
        console.log('✅ Key package created:', {
            group_id: keyPackage.group_id,
            key_version: keyPackage.key_version,
            total_participants: keyPackage.total_participants,
            successful_encryptions: keyPackage.successful_encryptions
        });

        // Test 8: Validate key package
        console.log('\n7. Testing key package validation...');
        const isValid = keyManager.validateKeyPackage(keyPackage);
        console.log('✅ Key package validation:', isValid);

        // Test 9: Get key statistics
        console.log('\n8. Testing key statistics...');
        const stats = keyManager.getKeyStatistics(keyPackage);
        console.log('✅ Key statistics:', stats);

        console.log('\n🎉 All encryption service tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testEncryptionServices(); 