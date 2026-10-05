import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './db/migrate.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { classRoutes } from './routes/classes.js';
import { studentRoutes } from './routes/students.js';
import { teacherClassRoutes } from './routes/teacherClasses.js';
import { attendanceRoutes } from './routes/attendance.js';
import { feeRoutes } from './routes/fees.js';
import { feeRuleRoutes } from './routes/feeRules.js';
import { settingsRoutes } from './routes/settings.js';
import { salaryRoutes } from './routes/salaries.js';
import { teacherProfileRoutes } from './routes/teacherProfiles.js';
import { parentAlertsRoutes } from './routes/parentAlerts.js';
import { familyRoutes } from './routes/families.js';
import { familyPaymentRoutes } from './routes/familyPayments.js';
import { studentFeeAssignmentRoutes } from './routes/studentFeeAssignments.js';
const server = Fastify({ logger: true });
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
// Production web build location:
// apps/server/dist/index.js
// apps/web/dist/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_DIST_CANDIDATES = [
    path.resolve(__dirname, '../../web/dist'),
    path.resolve(__dirname, '../web/dist'),
];
const WEB_DIST = WEB_DIST_CANDIDATES.find((candidate) => fs.existsSync(path.join(candidate, 'index.html'))) ??
    WEB_DIST_CANDIDATES[0];
// â”€â”€ CORS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
await server.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
});
// â”€â”€ COOKIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
await server.register(cookie);
// â”€â”€ DATABASE MIGRATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
runMigrations();
// â”€â”€ ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
await server.register(healthRoutes, { prefix: '/api' });
await server.register(authRoutes, { prefix: '/api/auth' });
await server.register(userRoutes, { prefix: '/api/users' });
await server.register(classRoutes, { prefix: '/api/classes' });
await server.register(studentRoutes, { prefix: '/api/students' });
await server.register(teacherClassRoutes, { prefix: '/api/teacher-classes' });
await server.register(attendanceRoutes, { prefix: '/api/attendance' });
await server.register(feeRoutes, { prefix: '/api/fees' });
await server.register(feeRuleRoutes, { prefix: '/api/fee-rules' });
await server.register(settingsRoutes, { prefix: '/api' });
await server.register(salaryRoutes, { prefix: '/api/salaries' });
await server.register(teacherProfileRoutes, { prefix: '/api/teacher-profiles' });
await server.register(parentAlertsRoutes, { prefix: '/api/parent-alerts' });
await server.register(familyRoutes, { prefix: '/api/families' });
await server.register(familyPaymentRoutes, { prefix: '/api/family-payments' });
await server.register(studentFeeAssignmentRoutes, {
    prefix: '/api/student-fee-assignments',
});
// â”€â”€ PRODUCTION WEB APP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Serves apps/web/dist directly from the Fastify production server.
// This removes the need for Vite during normal school usage.
await server.register(fastifyStatic, {
    root: WEB_DIST,
    prefix: '/',
    index: 'index.html',
});
// â”€â”€ START â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`\n  Server running at http://localhost:${PORT}`);
    console.log(`  Web app:   http://localhost:${PORT}`);
    console.log(`  Health:    GET http://localhost:${PORT}/api/health`);
    console.log(`  Login:     POST http://localhost:${PORT}/api/auth/login\n`);
}
catch (err) {
    server.log.error(err);
    process.exit(1);
}
//# sourceMappingURL=index.js.map