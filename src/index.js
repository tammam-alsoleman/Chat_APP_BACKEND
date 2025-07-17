const config = require('./core/config');
const logger = require('./core/logger');
const { connectToDb } = require('./core/db');
const { startServer } = require('./core/server');
const { initializeSocket } = require('./core/socket');

async function main() {
  try {
    logger.info('Application starting...');
    await connectToDb();
    const server = startServer(config.API_PORT);
    const io = initializeSocket(server);

    server.app.use((req, res, next) => {
      req.io = io;
      next();
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received. Shutting down gracefully...');
      const { getPool } = require('./core/db');
      const pool = getPool(false); // Get pool without throwing error
      if (pool) {
        await pool.close();
        logger.info('SQL Server connection pool closed.');
      }
      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start the application:', error);
    process.exit(1);
  }
}

main();