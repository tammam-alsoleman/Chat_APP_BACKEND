const { encryptionRepository } = require('./src/core/services/encryption/index');
console.log('Current working directory:', process.cwd());
async function getGroupKeyExample(groupId) {
    try {
        const groupKeyInfo = await encryptionRepository.getGroupKey(groupId);
        if (groupKeyInfo) {
            console.log(`Decrypted Group Key for Group ID ${groupId}:`, groupKeyInfo.decrypted_key);
        } else {
            console.log(`No group key found for Group ID ${groupId}`);
        }
    } catch (error) {
        console.error('Error retrieving group key:', error);
    }
}

// Example usage
getGroupKeyExample(1); // Replace 1 with the actual group ID you want to retrieve the key for
