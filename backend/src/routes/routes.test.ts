import request from 'supertest';
import { createApp } from '../server';

describe('API Routes', () => {
    const app = createApp();

    describe('GET /api/health', () => {
        it('should return 200 with status ok', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });

        it('should include uptime', async () => {
            const res = await request(app).get('/api/health');
            expect(res.body.uptime).toBeDefined();
            expect(typeof res.body.uptime).toBe('number');
        });
    });

    describe('GET /api/agent', () => {
        it('should return 200 with agent profile', async () => {
            const res = await request(app).get('/api/agent');
            expect(res.status).toBe(200);
            expect(res.body.name).toBeDefined();
            expect(res.body.pricing).toBeDefined();
        });
    });

    describe('POST /api/chat', () => {
        it('should return 400 if no message provided', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({});
            expect(res.status).toBe(400);
        });

        it('should create a new session if sessionId is not provided', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({ message: 'Hello' });
            // Should return 402 (payment required) for a new unpaid session
            expect(res.status).toBe(402);
            expect(res.body.sessionId).toBeDefined();
            expect(res.body.payment).toBeDefined();
            expect(res.body.payment.amount).toBeDefined();
            expect(res.body.payment.token).toBeDefined();
            expect(res.body.payment.receiver).toBeDefined();
        });

        it('should return 402 for unpaid session', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({ message: 'Research AI trends' });
            expect(res.status).toBe(402);
            expect(res.body.payment).toBeDefined();
        });
    });

    describe('POST /api/chat/confirm-payment', () => {
        it('should return 400 if sessionId or txHash missing', async () => {
            const res = await request(app)
                .post('/api/chat/confirm-payment')
                .send({});
            expect(res.status).toBe(400);
        });

        it('should return 404 for non-existent session', async () => {
            const res = await request(app)
                .post('/api/chat/confirm-payment')
                .send({ sessionId: 'fake-id', txHash: 'tx-123' });
            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/upload', () => {
        it('should return 400 if no file attached', async () => {
            const res = await request(app)
                .post('/api/upload');
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/download/:jobId', () => {
        it('should return 404 for non-existent job', async () => {
            const res = await request(app).get('/api/download/fake-job-id');
            expect(res.status).toBe(404);
        });
    });
});
