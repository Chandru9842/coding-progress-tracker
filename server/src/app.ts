import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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

// Versioned API routes (/api/v1)
app.use('/api/v1', healthRoutes);
app.use('/api/v1', authRoutes);
app.use('/api/v1', statsRoutes);
app.use('/api/v1', staffRoutes);
app.use('/api/v1', batchRoutes);
app.use('/api/v1', studentRoutes);
app.use('/api/v1', syncRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1', googleSheetsRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
