/**
 * BaseAgent — Abstract agent interface for the mx-openclaw-template-solution.
 *
 * Derivatives (like mx-openclaw-market-research) extend this class and provide:
 * 1. Their own tools (search, scrape, analyze, etc.)
 * 2. Their own system prompt
 *
 * The base template handles the chat server, payment gating, and streaming.
 * The agent only needs to know how to process a prompt and yield results.
 */

export interface Tool {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<string>;
}

export interface StreamEvent {
    type: 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'complete' | 'error';
    content: string;
    toolName?: string;
    jobId?: string;
}

export interface AgentContext {
    sessionId: string;
    fileIds: string[];
    previousMessages: Array<{ role: string; content: string }>;
}

export abstract class BaseAgent {
    /**
     * Return the list of tools this agent can use.
     * Override in derivatives to add domain-specific tools.
     */
    abstract getTools(): Tool[];

    /**
     * Return the system prompt for this agent.
     * Override in derivatives to customize behavior.
     */
    abstract getSystemPrompt(): string;

    /**
     * Execute a prompt and yield streaming events.
     * The base implementation provides a placeholder.
     * Derivatives should override with actual LLM integration.
     */
    async *execute(prompt: string, context: AgentContext): AsyncGenerator<StreamEvent> {
        yield { type: 'thinking', content: 'Processing your request...' };

        // Placeholder — derivatives override this with real LLM calls
        yield {
            type: 'text',
            content: `Received: "${prompt}". This is the base template agent. Override execute() to add real functionality.`,
        };

        yield {
            type: 'complete',
            content: 'Done',
            jobId: `job-${context.sessionId}`,
        };
    }

    /**
     * Get agent metadata for the /api/agent endpoint.
     */
    getMetadata(): Record<string, unknown> {
        return {
            tools: this.getTools().map(t => ({ name: t.name, description: t.description })),
            systemPromptLength: this.getSystemPrompt().length,
        };
    }
}

/**
 * Default agent — used when no derivative is configured.
 * Echoes back the user's message as a placeholder.
 */
export class DefaultAgent extends BaseAgent {
    getTools(): Tool[] {
        return [];
    }

    getSystemPrompt(): string {
        return 'You are a helpful AI assistant powered by MultiversX. Respond to user queries.';
    }
}
