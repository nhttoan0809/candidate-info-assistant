import { z } from 'zod';
import type { ModelMessage } from 'ai';

export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (origin === null) return; // Non-browser API clients may omit Origin.
  try {
    const url = new URL(request.url);
    const host = request.headers.get('host');
    // Next dev can reconstruct request.url using its bind hostname instead of
    // the hostname used by the browser. Host retains the incoming authority.
    // Do not accept arbitrary X-Forwarded-Host values as an alternative origin.
    if (host !== null && (!host || /[\s\\/@?#,]/.test(host))) throw new Error('Invalid host');
    const target = host === null ? url : new URL(`${url.protocol}//${host}`);
    if (origin === target.origin) return;
  } catch {
    /* Invalid authorities and opaque origins fail closed. */
  }
  throw new RequestError('Yêu cầu không cùng nguồn.', 403);
}

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  parts: z
    .array(z.object({ type: z.string(), text: z.string().max(10000).optional() }).passthrough())
    .max(100),
});
const schema = z.object({ messages: z.array(messageSchema).min(1).max(30) });

export function parseHistory(body: unknown): ModelMessage[] {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new RequestError('Hội thoại không hợp lệ hoặc quá dài. Hãy tạo cuộc trò chuyện mới.');
  const messages = parsed.data.messages
    .map((m) => ({
      role: m.role,
      content: m.parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text || '')
        .join('\n')
        .trim(),
    }))
    .filter((m) => m.content)
    .slice(-16);
  if (!messages.length || messages.at(-1)?.role !== 'user')
    throw new RequestError('Thiếu câu hỏi của bạn.');
  if (messages.reduce((n, m) => n + m.content.length, 0) > 40000)
    throw new RequestError('Hội thoại quá dài. Hãy bắt đầu cuộc trò chuyện mới.');
  return messages;
}

export async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('Thiếu nội dung yêu cầu.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 200000) {
      await reader.cancel();
      throw new RequestError('Nội dung vượt giới hạn 200 KB.', 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError('JSON không hợp lệ.');
  }
}
