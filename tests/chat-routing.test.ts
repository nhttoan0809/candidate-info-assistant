import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ generateText: vi.fn(), agent: vi.fn(), github: vi.fn() }));
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: mocks.generateText,
}));
vi.mock('../src/lib/agent/agent', () => ({ createCandidateAgent: mocks.agent }));
vi.mock('../src/lib/github', () => ({ GitHubClient: mocks.github }));
vi.mock('../src/lib/rate-limit', () => ({ allowRequest: async () => true }));
import { POST } from '../src/app/api/chat/route';
import { classifyIntent } from '../src/lib/agent/classifier';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MODEL_URL', 'http://localhost:11434/v1');
  vi.stubEnv('MODEL_NAME', 'test');
  vi.stubEnv('REPO_URL', 'https://github.com/example');
});
describe('non-research routing', () => {
  it('accepts a same-origin loopback alias without calling LLM or GitHub', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' },
        body: JSON.stringify({
          messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('text-delta');
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(mocks.github).not.toHaveBeenCalled();
  });
  it('rejects a cross-origin request before processing chat', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'https://evil.example',
          'x-forwarded-host': 'evil.example',
        },
        body: '{}',
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Yêu cầu không cùng nguồn.' });
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(mocks.github).not.toHaveBeenCalled();
    expect(mocks.agent).not.toHaveBeenCalled();
  });
  it.each(['Hello', 'Cảm ơn bạn', 'Bạn có thể làm gì?', 'Thời tiết hôm nay?'])(
    'answers %s without calling LLM or GitHub',
    async (text) => {
      const response = await POST(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          body: JSON.stringify({ messages: [{ role: 'user', parts: [{ type: 'text', text }] }] }),
        }),
      );
      expect(response.status).toBe(200);
      const stream = await response.text();
      expect(stream).toContain('text-delta');
      expect(stream).toContain('"type":"finish"');
      expect(stream).not.toContain('data-sources');
      expect(stream).not.toContain('data-usage');
      expect(mocks.generateText).not.toHaveBeenCalled();
      expect(mocks.github).not.toHaveBeenCalled();
      expect(mocks.agent).not.toHaveBeenCalled();
    },
  );
  it('asks for clarification when the classifier is unavailable and the question is vague', async () => {
    mocks.generateText.mockRejectedValue(new Error('model offline'));
    const result = await classifyIntent('hmm?', new AbortController().signal);
    expect(result.intent).toBe('clarification');
    expect(mocks.github).not.toHaveBeenCalled();
  });
  it('inherits candidate intent for a follow-up, but never for Hello', async () => {
    const signal = new AbortController().signal;
    expect((await classifyIntent('Tiếp tục', signal, ['Phân tích dự án CSM'])).intent).toBe(
      'projects',
    );
    expect((await classifyIntent('Hello', signal, ['Phân tích dự án CSM'])).intent).toBe(
      'greeting',
    );
    expect((await classifyIntent('Tiếp tục', signal)).intent).toBe('clarification');
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
  it('routes visual follow-ups to image research and asks clarification without project context', async () => {
    const text = 'Cung cấp hình ảnh trực quan về ứng dụng đó được không?';
    const signal = new AbortController().signal;
    expect((await classifyIntent(text, signal, ['Phân tích dự án CSM'])).intent).toBe('images');
    expect((await classifyIntent(text, signal)).intent).toBe('clarification');
    expect((await classifyIntent('Cho xem screenshot repo CSM', signal)).intent).toBe('images');
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});
