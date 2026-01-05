import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getDb, migrate, getDefaultMigrationsDir } from '@meals/core';
import { errorHandler } from './middleware/error-handler.js';
import { ErrorCodes, errorResponse, successResponse } from './types.js';
import { recipeRoutes, planRoutes, groceryRoutes, preferenceRoutes, pantryRoutes } from './routes/index.js';

/**
 * Health check response type
 */
interface HealthResponse {
  status: 'ok';
  timestamp: string;
  version: string;
}

/**
 * Create and configure the Fastify server
 */
export async function buildServer() {
  const server = Fastify({
    logger: true,
  });

  // Register CORS plugin - enabled for localhost
  await server.register(cors, {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173', // Vite default port
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Set up global error handler
  server.setErrorHandler(errorHandler);

  // Set up not found handler for consistent ApiResponse format
  server.setNotFoundHandler((_request, reply) => {
    reply.status(404).send(errorResponse(ErrorCodes.NOT_FOUND, 'Route not found'));
  });

  // Health endpoint
  server.get('/health', async () => {
    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
    return successResponse(response);
  });

  // Register API routes
  await server.register(recipeRoutes);
  await server.register(planRoutes);
  await server.register(groceryRoutes);
  await server.register(preferenceRoutes);
  await server.register(pantryRoutes);

  return server;
}

/**
 * Initialize database connection and run migrations
 */
function initDatabase(): void {
  try {
    // Initialize database connection (this will create the file if missing)
    const db = getDb();

    // Run any pending migrations
    const migrationsDir = getDefaultMigrationsDir();
    const appliedCount = migrate(db, migrationsDir);

    if (appliedCount > 0) {
      console.log(`Applied ${appliedCount} database migration(s)`);
    }
  } catch (err) {
    console.error('Failed to initialize database:', err);
    console.error('Hint: Set MEALS_DB_PATH environment variable to specify database location');
    throw err;
  }
}

/**
 * Start the server
 */
async function start() {
  const port = parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    // Initialize database before starting server
    initDatabase();

    const server = await buildServer();
    await server.listen({ port, host });
    console.log(`Server is running on http://${host}:${port}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start server if this is the main module
start();
