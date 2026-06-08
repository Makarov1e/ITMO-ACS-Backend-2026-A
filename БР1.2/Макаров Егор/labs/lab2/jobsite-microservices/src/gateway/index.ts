import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { env } from '../common/env';

/**
 * API Gateway — единая точка входа. Маршрутизирует запросы /api/v1/* по сервисам.
 * Тело запроса не парсится: проксируется как есть (стриминг).
 */
const pickTarget = (url: string): string | null => {
  // url уже без префикса /api/v1 (срезается монтированием)
  if (url.startsWith('/auth') || url.startsWith('/users')) return env.services.auth;
  if (url.startsWith('/industries') || url.startsWith('/skills')) return env.services.catalog;
  if (url.startsWith('/seeker/saved-vacancies')) return env.services.vacancy;
  if (
    url.startsWith('/seeker') || url.startsWith('/seekers') || url.startsWith('/resumes')
    || url.startsWith('/work-experiences') || url.startsWith('/educations')
  ) return env.services.seeker;
  if (url.startsWith('/employer') || url.startsWith('/companies')) return env.services.employer;
  if (url.startsWith('/applications')) return env.services.application;
  if (/^\/vacancies\/\d+\/applications/.test(url)) return env.services.application;
  if (url.startsWith('/vacancies')) return env.services.vacancy;
  return null;
};

export const app = express();
app.use(cors());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'gateway' }));

app.use('/api/v1', createProxyMiddleware({
  changeOrigin: true,
  router: (req) => {
    const target = pickTarget(req.url || '');
    if (!target) throw new Error(`Не найден сервис для пути ${req.url}`);
    return target;
  },
  on: {
    error: (_err, _req, res) => {
      // res может быть http.ServerResponse
      const r = res as express.Response;
      if (!r.headersSent) r.status?.(502);
      r.end?.(JSON.stringify({ code: 'BAD_GATEWAY', message: 'Сервис недоступен' }));
    },
  },
}));

app.use((_req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Эндпоинт не найден' });
});
