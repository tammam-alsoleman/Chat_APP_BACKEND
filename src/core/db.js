// src/core/db.js - IMPROVED AND ROBUST VERSION

const sql = require('mssql');
const config = require('./config');
const logger = require('./logger');

let pool;

async function connectToDb() {
  try {
    // If pool is not created or is closed, create a new one
    if (!pool || !pool.connected) {
      logger.info('Attempting to connect to SQL Server...');
      pool = await new sql.ConnectionPool(config.db).connect();
      logger.info('Successfully connected to SQL Server.');

      // Handle errors that happen after the initial connection
      pool.on('error', err => {
        logger.error('SQL Pool Error:', err);
        // Setting pool to null will allow the next getPool() call to try and reconnect
        pool = null; 
      });
    }
  } catch (err) {
    logger.error('Error connecting to SQL Server:', err);
    // Set pool to null on connection failure to allow retries
    pool = null; 
    throw err; // Re-throw the error so the startup process fails
  }
}

// The getPool function is now ASYNC and ensures the connection exists
async function getPool() {
  // If the pool doesn't exist or is not connected, try to connect
  if (!pool || !pool.connected) {
    await connectToDb();
  }
  
  // If after trying to connect, the pool is still not available, throw an error
  if (!pool) {
    throw new Error('Database pool is not available. Failed to connect.');
  }

  return pool;
}


// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received. Closing SQL Server connection pool...');
  if (pool) {
    try {
      await pool.close();
      logger.info('SQL Server connection pool closed.');
    } catch (err) {
      logger.error('Error closing SQL Server connection pool during shutdown:', err);
    }
  }
  process.exit(0);
});

// We still export connectToDb for the initial startup, and getPool for repositories
module.exports = { connectToDb, getPool };