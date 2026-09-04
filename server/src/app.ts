import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import batchRoutes from './routes/batchRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import syncRoutes from './routes/syncRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import googleSheetsRoutes from './routes/googleSheetsRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middlewares
app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow local dev origins & Vercel deployments
      callback(null, origin || true);
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Versioned API routes (mounted on both /api/v1 and /v1 for Vercel serverless compatibility)
['/api/v1', '/v1'].forEach((prefix) => {
  app.use(prefix, healthRoutes);
  app.use(prefix, authRoutes);
  app.use(prefix, statsRoutes);
  app.use(prefix, staffRoutes);
  app.use(prefix, batchRoutes);
  app.use(prefix, studentRoutes);
  app.use(prefix, syncRoutes);
  app.use(`${prefix}/reports`, reportRoutes);
  app.use(prefix, googleSheetsRoutes);
});

// Global Error Handler
app.use(errorHandler);

export default app;
