import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { SessionStore } from './session/session-store';

// Multer config for file uploads
const upload = multer({
    dest: path.resolve(__dirname, '../uploads'),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
    fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.csv', '.txt', '.docx', '.md'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${ext} not allowed. Supported: ${allowed.join(', ')}`));
        }
    },
});

// Load agent config
function loadAgentConfig(): Record<string, unknown> {
    try {
        return require(path.resolve(process.cwd(), 'agent.config.json'));
    } catch {
        return {
            agentName: process.env.AGENT_NAME || 'openclaw-bot',
            description: 'A MultiversX-powered AI agent',
            pricing: {
                perQuery: process.env.PRICE_PER_QUERY || '0.50',
                token: process.env.PRICE_TOKEN || 'USDC-350c4e',
            },
        };
    }
}

export function createApp(): Express {
    const app = express();
    const sessionStore = new SessionStore();
    const agentConfig = loadAgentConfig();

    // Middleware
    app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
    app.use(express.json());

    // ==========================================
    // GET /api/health
    // ==========================================
    app.get('/api/health', (_req, res) => {
        res.json({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    });

    // ==========================================
    // GET /api/agent
    // ==========================================
    app.get('/api/agent', (_req, res) => {
        const config = agentConfig as Record<string, unknown>;
        res.json({
            name: (config.agentName as string) || 'openclaw-bot',
            description: (config.description as string) || '',
            pricing: config.pricing || { perQuery: '0.50', token: 'USDC-350c4e' },
            services: config.services || [],
        });
    });

    // ==========================================
    // POST /api/chat
    // ==========================================
    app.post('/api/chat', (req, res) => {
        const { message, sessionId } = req.body;

        if (!message || typeof message !== 'string') {
            res.status(400).json({ error: 'message is required and must be a string' });
            return;
        }

        // Get or create session
        let session = sessionId ? sessionStore.getSession(sessionId) : undefined;
        if (!session) {
            session = sessionStore.createSession();
        }

        // Add user message
        sessionStore.addMessage(session.id, { role: 'user', content: message });

        // Payment gate
        if (!session.isPaid) {
            const pricing = (agentConfig as Record<string, unknown>).pricing as Record<string, string> | undefined;
            res.status(402).json({
                sessionId: session.id,
                payment: {
                    amount: pricing?.perQuery || '0.50',
                    token: pricing?.token || 'USDC-350c4e',
                    receiver: process.env.AGENT_WALLET_ADDRESS || 'erd1...',
                    message: 'Payment required to proceed. Sign the transaction to start your query.',
                },
            });
            return;
        }

        // If paid — for now, return a placeholder.
        // In the real implementation, this will be an SSE stream from the agent.
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'thinking', content: 'Processing your request...' })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'text', content: 'Agent response placeholder' })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'complete', content: 'Done', jobId: session.jobId })}\n\n`);
        res.end();
    });

    // ==========================================
    // POST /api/chat/confirm-payment
    // ==========================================
    app.post('/api/chat/confirm-payment', (req, res) => {
        const { sessionId, txHash } = req.body;

        if (!sessionId || !txHash) {
            res.status(400).json({ error: 'sessionId and txHash are required' });
            return;
        }

        const session = sessionStore.getSession(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const jobId = `job-${uuidv4()}`;
        sessionStore.markPaid(sessionId, txHash, jobId);

        res.json({
            status: 'confirmed',
            jobId,
            message: 'Payment confirmed. You can now send your query.',
        });
    });

    // ==========================================
    // POST /api/upload
    // ==========================================
    app.post('/api/upload', upload.single('file'), (req, res) => {
        if (!req.file) {
            res.status(400).json({ error: 'No file attached. Use field name "file".' });
            return;
        }

        const fileId = uuidv4();
        res.json({
            fileId,
            filename: req.file.originalname,
            size: req.file.size,
            message: 'File uploaded successfully.',
        });
    });

    // ==========================================
    // GET /api/download/:jobId
    // ==========================================
    app.get('/api/download/:jobId', (req, res) => {
        const { jobId } = req.params;
        const reportPath = path.resolve(__dirname, `../reports/${jobId}.pdf`);

        try {
            const fs = require('fs');
            if (!fs.existsSync(reportPath)) {
                res.status(404).json({ error: `No report found for job ${jobId}` });
                return;
            }
            res.download(reportPath, `report-${jobId}.pdf`);
        } catch {
            res.status(404).json({ error: `No report found for job ${jobId}` });
        }
    });

    return app;
}

// Start server if run directly
if (require.main === module) {
    const port = parseInt(process.env.BACKEND_PORT || '4000', 10);
    const app = createApp();
    app.listen(port, () => {
        console.log(`🚀 mx-openclaw-template-solution backend running on port ${port}`);
    });
}
