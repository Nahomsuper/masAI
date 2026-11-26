import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { config, ensureRuntimeDirs, isGeminiConfigured } from './config.js';
import './db/index.js';
import { requireAuth } from './lib/auth.js';
import { badRequest, errorMiddleware, notFound } from './lib/http.js';
import { authRouter } from './routes/auth.js';
import { cropsRouter } from './routes/crops.js';
import { dashboardRouter } from './routes/dashboard.js';
import { recordsRouter } from './routes/records.js';
import { scansRouter } from './routes/scans.js';
import { demoRouter } from './routes/demo.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(serverDir, '..', 'dist');

ensureRuntimeDirs();

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '12mb' }));

app.use((error, _req, _res, next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return next(badRequest('The request body is not valid JSON'));
  }
  return next(error);
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'MasAI',
    aiConfigured: isGeminiConfigured(),
    time: new Date().toISOString(),
  });
});

app.use('/api/demo', demoRouter);
app.use('/api/auth', authRouter);
app.use('/api/crops', requireAuth, cropsRouter);
app.use('/api/records', requireAuth, recordsRouter);
app.use('/api/scans', requireAuth, scansRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api', (_req, _res, next) => next(notFound('Unknown API endpoint')));

app.use('/uploads', express.static(config.uploadsDir));

if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
} else {
  app.get('*', (_req, res) => {
    res.json({
      name: 'MasAI API',
      message: 'The web app has not been built yet. Run "npm run build", or use "npm run dev".',
      endpoints: ['/api/health', '/api/demo', '/api/auth', '/api/dashboard', '/api/crops', '/api/records', '/api/scans'],
    });
  });
}

app.use(errorMiddleware);

app.listen(config.port, () => {
  console.log(`[masai] API ready on http://localhost:${config.port}`);
  console.log(`[masai] Gemini ${isGeminiConfigured() ? 'configured' : 'not configured — using local rules'}`);
});

export default app;
