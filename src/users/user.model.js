const Joi = require('joi');

const userSignInSchema = Joi.object({
  user_name: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(6).required(),
  display_name: Joi.string().min(3).max(50).required(),
});

const userLogInSchema = Joi.object({
  user_name: Joi.string().required(),
  password: Joi.string().required(),
});

module.exports = { userSignInSchema, userLogInSchema };