import { needsResearch } from '../src/lib/agent/intent';
import type { Intent } from '../src/lib/types';
const base = process.env.SMOKE_URL || 'http://127.0.0.1:3000';
const question =
  process.env.SMOKE_QUESTION ||
  'Ứng viên có bao nhiêu repo gốc và repo fork? Trả lời ngắn và dẫn nguồn.';
const prior = process.env.SMOKE_PRIOR_QUESTION;
const action = process.env.SMOKE_ACTION;
const repository = process.env.SMOKE_REPOSITORY;
const started = Date.now();
const response = await fetch(`${base}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...(action ? { action, repository } : {}),
    messages: [
      ...(prior ? [{ id: 'prior', role: 'user', parts: [{ type: 'text', text: prior }] }] : []),
      { id: 'smoke', role: 'user', parts: [{ type: 'text', text: question }] },
    ],
  }),
  signal: AbortSignal.timeout(270000),
});
if (!response.ok || !response.body)
  throw new Error(`Chat HTTP ${response.status}: ${await response.text()}`);
const reader = response.body.getReader();
const decoder = new TextDecoder();
let intent: Intent = 'overview';
let firstText = false;
let images = 0;
let pending = '';
let answer = '';
let tools = 0;
let sources = 0;
let classification = '';
let finished = false;
let inspected = false;
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  pending += decoder.decode(value, { stream: true });
  let index: number;
  while ((index = pending.indexOf('\n\n')) >= 0) {
    const block = pending.slice(0, index);
    pending = pending.slice(index + 2);
    const data = block
      .split('\n')
      .find((l) => l.startsWith('data: '))
      ?.slice(6);
    if (!data || data === '[DONE]') continue;
    const part = JSON.parse(data);
    if (part.type === 'text-delta') {
      answer += part.delta;
      if (!firstText) {
        console.log('First visible text (ms):', Date.now() - started);
        firstText = true;
      }
    }
    if (part.type === 'data-progress')
      console.log('Progress:', part.data.phase, part.data.elapsedMs);
    if (part.type === 'tool-input-available') {
      tools++;
      if (part.toolName === 'inspect_repository' && part.input.repository === repository)
        inspected = true;
      console.log('Tool:', part.toolName, part.input);
    }
    if (part.type === 'data-images') {
      images = part.data.length;
      console.log(
        'Project images:',
        part.data.map((img: { src: string }) => img.src),
      );
    }
    if (part.type === 'data-sources') sources = part.data.length;
    if (part.type === 'data-classification') {
      intent = part.data.intent;
      classification = part.data.method;
      console.log('Intent:', part.data);
    }
    if (part.type === 'data-activity' && part.data.status === 'error')
      throw new Error(`Tool failed: ${part.data.detail}`);
    if (part.type === 'error') throw new Error(part.errorText);
    if (part.type === 'finish') finished = true;
    if (part.type === 'data-usage') console.log('Usage:', part.data);
  }
}
console.log('Answer:', answer);
console.log({ tools, sources, classification, finished, characters: answer.length });
if (
  !finished ||
  !answer.trim() ||
  (needsResearch(intent) ? tools < 1 || sources < 1 : tools !== 0 || sources !== 0)
)
  throw new Error('Expected complete real answer with tool calls and sources.');
if (/Okay,|Let me think|<\/?think>|the user (?:asks|wants)/i.test(answer))
  throw new Error('Model leaked reasoning into final text. Choose a compatible model/template.');

if (intent === 'images' && process.env.SMOKE_EXPECT_IMAGES === '1' && images < 1)
  throw new Error('Expected real project image attachments.');
if (action === 'repository' && !inspected)
  throw new Error('Quick repository entry must inspect the exact selected repo.');
