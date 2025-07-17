const Joi = require('joi');

const createChatSchema = Joi.object({
  group_name: Joi.string().min(3).max(100).required(),
  participants: Joi.array().items(Joi.string().alphanum()).min(1).required(),
});

const addParticipantsSchema = Joi.object({
  participants: Joi.array().items(Joi.string().alphanum()).min(1).required(),
});

module.exports = {
  createChatSchema,
  addParticipantsSchema,
};