import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { runMigrations } from './db/migrate.js';
import { healthRoutes }      from './routes/health.js';
import { authRoutes }        from './routes/auth.js';
import { userRoutes }        from './routes/users.js';
import { classRoutes }       from './routes/classes.js';
import { studentRoutes }     from './routes/students.js';
import { teacherClassRoutes } from './routes/teacherClasses.js';
import { attendanceRoutes }  from './routes/attendance.js';

const server = Fastify({ logger: true });

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// ── CORS ──────────────────────────────────────────────────────────────────────
await server.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

// ── COOKIES ───────────────────────────────────────────────────────────────────
await server.register(cookie);

// ── DATABASE MIGRATIONS ───────────────────────────────────────────────────────
runMigrations();

// ── ROUTES ────────────────────────────────────────────────────────────────────
await server.register(healthRoutes,       { prefix: '/api' });
await server.register(authRoutes,         { prefix: '/api/auth' });
await server.register(userRoutes,         { prefix: '/api/users' });
await server.register(classRoutes,        { prefix: '/api/classes' });
await server.register(studentRoutes,      { prefix: '/api/students' });
await server.register(teacherClassRoutes, { prefix: '/api/teacher-classes' });
await server.register(attendanceRoutes,   { prefix: '/api/attendance' });

// ── START ─────────────────────────────────────────────────────────────────────
try {
  await server.listen({ port: PORT, host: HOST });
  console.log(`\n  Server running at http://localhost:${PORT}`);
  console.log(`  Health:   GET  http://localhost:${PORT}/api/health`);
  console.log(`  Login:    POST http://localhost:${PORT}/api/auth/login\n`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
