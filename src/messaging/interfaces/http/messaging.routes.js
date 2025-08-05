const express = require('express');
const messagingController = require('./messaging.controller');
const authenticateToken = require('../../../users/middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.route('/')
    .post(messagingController.createChat)
    .get(messagingController.getMyChats);

router.route('/:chatId/participants')
    .post(messagingController.addParticipants);

router.route('/:chatId/messages')
    .get(messagingController.getMessages);

router.route('/:chatId/my-key').get(messagingController.getMyEncryptedKey);

module.exports = router;