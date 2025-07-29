require('dotenv').config();
const Joi = require('joi');

const envSchema = Joi.object().keys({
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_SERVER: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_PORT: Joi.number().integer().default(1433),
  DB_OPTIONS_ENCRYPT: Joi.boolean().default(false),
  DB_OPTIONS_TRUST_SERVER_CERTIFICATE: Joi.boolean().default(true),
  API_PORT: Joi.number().integer().default(5000),
  JWT_SECRET: Joi.string().required(),
  MASTER_ENCRYPTION_KEY: Joi.string().required(),
}).unknown(); 

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  console.error(`!!! Environment variable validation error: ${error.message} !!!`);
  process.exit(1);
}

const config = {
  API_PORT: envVars.API_PORT,
  JWT_SECRET: envVars.JWT_SECRET,
  MASTER_ENCRYPTION_KEY: envVars.MASTER_ENCRYPTION_KEY,
  db: {
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
    server: envVars.DB_SERVER,
    database: envVars.DB_DATABASE,
    port: envVars.DB_PORT,
    options: {
      encrypt: envVars.DB_OPTIONS_ENCRYPT,
      trustServerCertificate: envVars.DB_OPTIONS_TRUST_SERVER_CERTIFICATE,
    },
  }
};

module.exports = config;