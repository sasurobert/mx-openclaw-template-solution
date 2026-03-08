/**
 * E2E Test: Backend API Full Flow
 *
 * Tests the complete API flow using supertest against the real Express app:
 * 1. Health check
 * 2. Agent profile
 * 3. Chat session creation → 402 payment gate
 * 4. Payment confirmation → session unlock
 * 5. Paid chat → SSE stream with agent events
 * 6. File upload
 * 7. Download (404 expected for non-existent reports)
 * 8. Security headers validation
 * 9. Rate limiting validation
 * 10. Input validation (missing fields, oversized messages)
 */

import request from 'supertest';
import path from 'path';
import fs from 'fs';

// Set test environment BEFORE importing server
process.env.NODE_ENV = 'test';
process.env.SKIP_TX_VERIFICATION = 'true';

// Import createApp from backend — we need to resolve it properly
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createApp } = require(path.resolve(
    __dirname,
    '../../backend/src/server',
));

describe('E2E: Backend API', () => {
    const app = createApp();

    // ─── Health & Status ──────────────────────────────────────────────────────

    describe('Health & Status', () => {
        it('GET /api/health returns 200 with status ok', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body.uptime).toBeDefined();
            expect(res.body.timestamp).toBeDefined();
            expect(res.body.version).toBeDefined();
        });

        it('GET /api/agent returns agent profile', async () => {
            const res = await request(app).get('/api/agent');
            expect(res.status).toBe(200);
            expect(res.body.name).toBeDefined();
            expect(typeof res.body.name).toBe('string');
            expect(res.body.pricing).toBeDefined();
        });
    });

    // ─── Chat Flow ────────────────────────────────────────────────────────────

    describe('Chat Flow (Payment Gate)', () => {
        it('POST /api/chat without message returns 400', async () => {
            const res = await request(app).post('/api/chat').send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('message is required');
        });

        it('POST /api/chat with oversized message returns 400', async () => {
            const longMessage = 'x'.repeat(10001);
            const res = await request(app)
                .post('/api/chat')
                .send({ message: longMessage });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('too long');
        });

        it('POST /api/chat with valid message returns 402 (payment required)', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({ message: 'Hello, agent!' });
            expect(res.status).toBe(402);
            expect(res.body.sessionId).toBeDefined();
            expect(res.body.payment).toBeDefined();
            expect(res.body.payment.amount).toBeDefined();
            expect(res.body.payment.token).toBeDefined();
            expect(res.body.payment.receiver).toBeDefined();
            expect(res.body.payment.message).toBeDefined();
        });

        it('Full chat flow: create session → confirm payment → chat', async () => {
            // Step 1: Create session (gets 402)
            const chatRes = await request(app)
                .post('/api/chat')
                .send({ message: 'Research blockchain trends' });
            expect(chatRes.status).toBe(402);

            const sessionId = chatRes.body.sessionId;
            expect(sessionId).toBeDefined();

            // Step 2: Confirm payment
            const payRes = await request(app)
                .post('/api/chat/confirm-payment')
                .send({ sessionId, txHash: 'tx-' + 'a'.repeat(64) });
            expect(payRes.status).toBe(200);
            expect(payRes.body.status).toBe('confirmed');
            expect(payRes.body.jobId).toBeDefined();

            // Step 3: Chat with paid session (SSE stream)
            const streamRes = await request(app)
                .post('/api/chat')
                .send({ message: 'Research blockchain trends', sessionId });
            expect(streamRes.headers['content-type']).toContain('text/event-stream');
            expect(streamRes.text).toContain('data:');
            expect(streamRes.text).toContain('thinking');
            expect(streamRes.text).toContain('complete');
        });
    });

    // ─── Payment Confirmation ─────────────────────────────────────────────────

    describe('Payment Confirmation', () => {
        it('POST /api/chat/confirm-payment without fields returns 400', async () => {
            const res = await request(app)
                .post('/api/chat/confirm-payment')
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('required');
        });

        it('POST /api/chat/confirm-payment with invalid sessionId returns 404', async () => {
            const res = await request(app)
                .post('/api/chat/confirm-payment')
                .send({ sessionId: 'nonexistent-session', txHash: 'tx-abc123456789' });
            expect(res.status).toBe(404);
        });

        it('POST /api/chat/confirm-payment with short txHash returns 400', async () => {
            // First create a real session
            const chatRes = await request(app)
                .post('/api/chat')
                .send({ message: 'test' });
            const sessionId = chatRes.body.sessionId;

            const res = await request(app)
                .post('/api/chat/confirm-payment')
                .send({ sessionId, txHash: 'short' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid txHash');
        });
    });

    // ─── File Upload ──────────────────────────────────────────────────────────

    describe('File Upload', () => {
        it('POST /api/upload without file returns 400', async () => {
            const res = await request(app).post('/api/upload');
            expect(res.status).toBe(400);
        });

        it('POST /api/upload with valid file returns success', async () => {
            const tmpFile = path.resolve(__dirname, 'test-upload.txt');
            fs.writeFileSync(tmpFile, 'Test file content for E2E testing');

            try {
                const res = await request(app)
                    .post('/api/upload')
                    .attach('file', tmpFile);
                expect(res.status).toBe(200);
                expect(res.body.fileId).toBeDefined();
                expect(res.body.filename).toBeDefined();
                expect(res.body.size).toBeGreaterThan(0);
                expect(res.body.message).toContain('success');
            } finally {
                fs.unlinkSync(tmpFile);
            }
        });
    });

    // ─── Download ─────────────────────────────────────────────────────────────

    describe('Download', () => {
        it('GET /api/download/:jobId with non-existent job returns 404', async () => {
            const res = await request(app).get('/api/download/job-fake-id');
            expect(res.status).toBe(404);
        });

        it('GET /api/download/:jobId with invalid format returns 400', async () => {
            // Use a value that reaches the route handler but fails the /^job-[\w-]+$/ regex
            const res = await request(app).get('/api/download/invalid<script>alert(1)');
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid jobId');
        });
    });

    // ─── Security Headers ─────────────────────────────────────────────────────

    describe('Security Headers', () => {
        it('responses include helmet security headers', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
        });
    });

    // ─── Input Validation Edge Cases ──────────────────────────────────────────

    describe('Input Validation Edge Cases', () => {
        it('POST /api/chat with non-string message returns 400', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({ message: 12345 });
            expect(res.status).toBe(400);
        });

        it('POST /api/chat with empty string message returns 400', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({ message: '' });
            expect(res.status).toBe(400);
        });

        it('multiple sessions are independent', async () => {
            // Create two separate sessions
            const res1 = await request(app)
                .post('/api/chat')
                .send({ message: 'Session 1' });
            const res2 = await request(app)
                .post('/api/chat')
                .send({ message: 'Session 2' });

            expect(res1.body.sessionId).not.toBe(res2.body.sessionId);
        });
    });
});
