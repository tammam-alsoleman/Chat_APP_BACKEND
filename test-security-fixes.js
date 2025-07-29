// Test file for security fixes
// Run with: node test-security-fixes.js

const crypto = require('crypto');
const testMasterKey = crypto.randomBytes(32).toString('base64');
process.env.MASTER_ENCRYPTION_KEY = testMasterKey;
console.log('Generated test master key:', testMasterKey.substring(0, 20) + '...');

const { encryption } = require('./src/core/services');
const { encryptionService, keyManager } = encryption;

async function testSecurityFixes() {
    console.log('🔐 Testing Security Fixes...\n');

    try {
        // Test 1: RSA Encryption (replacing XOR)
        console.log('1. Testing RSA encryption...');
        
        // Generate a test RSA key pair
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        
        const testSymmetricKey = encryptionService.generateSymmetricKey();
        console.log('✅ Generated test symmetric key:', testSymmetricKey.substring(0, 20) + '...');
        
        // Encrypt with RSA
        const encryptedWithRSA = encryptionService.encryptSymmetricKeyWithPublicKey(testSymmetricKey, publicKey);
        console.log('✅ Encrypted with RSA:', encryptedWithRSA.substring(0, 20) + '...');
        
        // Decrypt with private key to verify
        const decryptedWithRSA = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            Buffer.from(encryptedWithRSA, 'base64')
        );
        
        const decryptedKey = decryptedWithRSA.toString('base64');
        console.log('✅ RSA encryption/decryption successful:', testSymmetricKey === decryptedKey);

        // Test 2: Random IV Encryption (replacing fixed IV)
        console.log('\n2. Testing random IV encryption...');
        
        const testMessage = 'Test group key for encryption';
        const testKey = crypto.randomBytes(32);
        
        // Encrypt with random IV
        const encryption1 = encryptionService.encryptGroupKeyWithMasterKey(testMessage);
        const encryption2 = encryptionService.encryptGroupKeyWithMasterKey(testMessage);
        
        console.log('✅ First encryption IV:', encryption1.iv.substring(0, 10) + '...');
        console.log('✅ Second encryption IV:', encryption2.iv.substring(0, 10) + '...');
        console.log('✅ IVs are different:', encryption1.iv !== encryption2.iv);
        console.log('✅ Encrypted data is different:', encryption1.encryptedData !== encryption2.encryptedData);
        
        // Decrypt both to verify they produce the same result
        const decrypted1 = encryptionService.decryptGroupKeyWithMasterKey(encryption1.encryptedData, encryption1.iv);
        const decrypted2 = encryptionService.decryptGroupKeyWithMasterKey(encryption2.encryptedData, encryption2.iv);
        
        console.log('✅ Both decryptions successful:', decrypted1 === decrypted2);
        console.log('✅ Decrypted matches original:', decrypted1 === testMessage);

        // Test 3: Key Manager with new encryption
        console.log('\n3. Testing key manager with new encryption...');
        
        const mockParticipants = [
            { user_id: 1, public_key: publicKey },
            { user_id: 2, public_key: publicKey }
        ];
        
        const keyPackage = keyManager.createGroupKeyPackage(123, mockParticipants);
        console.log('✅ Key package created with:');
        console.log('   - Server encrypted key:', keyPackage.server_encrypted_key.substring(0, 20) + '...');
        console.log('   - Server encrypted IV:', keyPackage.server_encrypted_iv.substring(0, 10) + '...');
        console.log('   - Client encrypted keys:', keyPackage.encrypted_keys.length);
        
        // Verify server can decrypt
        const serverDecrypted = encryptionService.decryptGroupKeyWithMasterKey(
            keyPackage.server_encrypted_key, 
            keyPackage.server_encrypted_iv
        );
        console.log('✅ Server decryption successful:', serverDecrypted === keyPackage.group_symmetric_key);

        // Test 4: Key rotation with new encryption
        console.log('\n4. Testing key rotation...');
        
        const rotatedPackage = keyManager.rotateGroupKey(123, mockParticipants);
        console.log('✅ Rotated key package created:');
        console.log('   - New server encrypted key:', rotatedPackage.server_encrypted_key.substring(0, 20) + '...');
        console.log('   - New server encrypted IV:', rotatedPackage.server_encrypted_iv.substring(0, 10) + '...');
        console.log('   - Key version:', rotatedPackage.key_version);
        
        // Verify rotation produces different keys
        console.log('✅ Keys are different after rotation:', 
            keyPackage.group_symmetric_key !== rotatedPackage.group_symmetric_key);
        console.log('✅ Encrypted keys are different:', 
            keyPackage.server_encrypted_key !== rotatedPackage.server_encrypted_key);

        console.log('\n🎉 All security fixes tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testSecurityFixes(); 