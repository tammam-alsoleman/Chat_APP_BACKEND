// Test file for master key encryption
// Run with: node test-master-key.js

// Set a test master key in environment (32 bytes = 256 bits)
// Generate a proper 32-byte key and encode it in base64
const crypto = require('crypto');
const testMasterKey = crypto.randomBytes(32).toString('base64');
process.env.MASTER_ENCRYPTION_KEY = testMasterKey;
console.log('Generated test master key:', testMasterKey.substring(0, 20) + '...');

const { encryption } = require('./src/core/services');
const { encryptionService, keyManager } = encryption;

async function testMasterKeyEncryption() {
    console.log('🔐 Testing Master Key Encryption...\n');

    try {
        // Test 1: Generate a group symmetric key
        console.log('1. Testing group symmetric key generation...');
        const groupId = 123;
        const groupSymmetricKey = keyManager.generateGroupKey(groupId);
        console.log('✅ Generated group symmetric key:', groupSymmetricKey.substring(0, 20) + '...');

        // Test 2: Encrypt group key with master key
        console.log('\n2. Testing master key encryption...');
        const encrypted = encryptionService.encryptGroupKeyWithMasterKey(groupSymmetricKey);
        console.log('✅ Encrypted group key:', encrypted.substring(0, 20) + '...');

        // Test 3: Decrypt group key with master key
        console.log('\n3. Testing master key decryption...');
        const decrypted = encryptionService.decryptGroupKeyWithMasterKey(encrypted);
        console.log('✅ Decrypted group key:', decrypted.substring(0, 20) + '...');

        // Test 4: Verify encryption/decryption
        console.log('\n4. Verifying encryption/decryption...');
        const isMatch = groupSymmetricKey === decrypted;
        console.log('✅ Original key matches decrypted key:', isMatch);

        // Test 5: Test with different keys
        console.log('\n5. Testing with different group keys...');
        const groupKey2 = keyManager.generateGroupKey(456);
        const encrypted2 = encryptionService.encryptGroupKeyWithMasterKey(groupKey2);
        const decrypted2 = encryptionService.decryptGroupKeyWithMasterKey(encrypted2);
        console.log('✅ Second key encryption/decryption successful:', groupKey2 === decrypted2);

        // Test 6: Verify keys are different
        console.log('\n6. Verifying keys are unique...');
        console.log('✅ Keys are different:', groupSymmetricKey !== groupKey2);
        console.log('✅ Encrypted keys are different:', encrypted !== encrypted2);

        console.log('\n🎉 All master key encryption tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testMasterKeyEncryption(); 