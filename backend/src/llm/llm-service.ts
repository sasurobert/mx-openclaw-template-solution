/**
 * LlmService — Generic LLM adapter.
 *
 * Supports OpenAI, Anthropic, and Google Gemini.
 * Streams responses via async generator.
 *
 * Configuration (via .env):
 *   LLM_PROVIDER = openai | anthropic | google
 *   LLM_API_KEY  = your API key
 *   LLM_MODEL    = model name (e.g., gpt-4o, claude-sonnet-4-20250514, gemini-2.5-pro)
 */

export interface LlmMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LlmChunk {
    type: 'text' | 'done';
    content: string;
}

type Provider = 'openai' | 'anthropic' | 'google';

const PROVIDER_CONFIG: Record<Provider, { url: string; buildRequest: (model: string, messages: LlmMessage[]) => unknown; parseStream: (line: string) => string | null }> = {
    openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        buildRequest: (model, messages) => ({
            model,
            messages,
            stream: true,
        }),
        parseStream: (line) => {
            if (!line.startsWith('data: ') || line === 'data: [DONE]') return null;
            try {
                const json = JSON.parse(line.slice(6));
                return json.choices?.[0]?.delta?.content || null;
            } catch { return null; }
        },
    },
    anthropic: {
        url: 'https://api.anthropic.com/v1/messages',
        buildRequest: (model, messages) => {
            const system = messages.find(m => m.role === 'system')?.content || '';
            const userMessages = messages.filter(m => m.role !== 'system');
            return {
                model,
                max_tokens: 4096,
                system,
                messages: userMessages,
                stream: true,
            };
        },
        parseStream: (line) => {
            if (!line.startsWith('data: ')) return null;
            try {
                const json = JSON.parse(line.slice(6));
                if (json.type === 'content_block_delta') return json.delta?.text || null;
                return null;
            } catch { return null; }
        },
    },
    google: {
        url: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse',
        buildRequest: (_model, messages) => ({
            contents: messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }],
                })),
            systemInstruction: messages.find(m => m.role === 'system')
                ? { parts: [{ text: messages.find(m => m.role === 'system')!.content }] }
                : undefined,
        }),
        parseStream: (line) => {
            if (!line.startsWith('data: ')) return null;
            try {
                const json = JSON.parse(line.slice(6));
                return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
            } catch { return null; }
        },
    },
};

export class LlmService {
    private provider: Provider;
    private apiKey: string;
    private model: string;

    constructor(
        provider?: string,
        apiKey?: string,
        model?: string,
    ) {
        this.provider = (provider || process.env.LLM_PROVIDER || 'openai') as Provider;
        this.apiKey = apiKey || process.env.LLM_API_KEY || '';
        this.model = model || process.env.LLM_MODEL || 'gpt-4o';

        if (!this.apiKey) {
            throw new Error('LLM_API_KEY is required. Set it in .env or pass it to the constructor.');
        }

        if (!PROVIDER_CONFIG[this.provider]) {
            throw new Error(`Unknown LLM provider: ${this.provider}. Supported: openai, anthropic, google`);
        }
    }

    /**
     * Stream a completion from the LLM.
     */
    async *stream(messages: LlmMessage[]): AsyncGenerator<LlmChunk> {
        const config = PROVIDER_CONFIG[this.provider];
        let url = config.url;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        // Provider-specific auth
        if (this.provider === 'openai') {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        } else if (this.provider === 'anthropic') {
            headers['x-api-key'] = this.apiKey;
            headers['anthropic-version'] = '2023-06-01';
        } else if (this.provider === 'google') {
            url = url.replace('{model}', this.model) + `&key=${this.apiKey}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(config.buildRequest(this.model, messages)),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LLM API error (${response.status}): ${errorText}`);
        }

        if (!response.body) {
            throw new Error('LLM response has no body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                const text = config.parseStream(trimmed);
                if (text) {
                    yield { type: 'text', content: text };
                }
            }
        }

        yield { type: 'done', content: '' };
    }

    /**
     * Non-streaming completion — returns the full response as a string.
     */
    async complete(messages: LlmMessage[]): Promise<string> {
        const chunks: string[] = [];
        for await (const chunk of this.stream(messages)) {
            if (chunk.type === 'text') chunks.push(chunk.content);
        }
        return chunks.join('');
    }

    /**
     * Check if the LLM service is configured and reachable.
     */
    isConfigured(): boolean {
        return !!this.apiKey && !!PROVIDER_CONFIG[this.provider];
    }
}
