import type { FastifyInstance } from 'fastify';
import type { ApiResponse } from '@school/shared';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
}

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get<{ Reply: ApiResponse<HealthData> }>('/health', async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  });
}
