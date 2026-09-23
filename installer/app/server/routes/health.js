export async function healthRoutes(fastify) {
    fastify.get('/health', async (_request, reply) => {
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
//# sourceMappingURL=health.js.map