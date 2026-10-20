import { expect, it } from 'vitest';
import { createEvidenceGate } from '../src/lib/agent/evidence-gate';
it('blocks invented prose while preserving tool events, then streams grounded text', async () => {
  let grounded = false;
  const gate = createEvidenceGate<{ type: string; text?: string }>(() => grounded);
  const writer = gate.writable.getWriter();
  const reader = gate.readable.getReader();
  const output: unknown[] = [];
  const consume = (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      output.push(value);
    }
  })();
  await writer.write({ type: 'text-start' });
  await writer.write({ type: 'text-delta', text: 'Invented CV' });
  await writer.write({ type: 'text-end' });
  await writer.write({ type: 'tool-input-available' });
  grounded = true;
  await writer.write({ type: 'text-start' });
  await writer.write({ type: 'text-delta', text: 'Retrieved facts' });
  await writer.write({ type: 'text-end' });
  await writer.close();
  await consume;
  expect(output).toEqual([
    { type: 'tool-input-available' },
    { type: 'text-start' },
    { type: 'text-delta', text: 'Retrieved facts' },
    { type: 'text-end' },
  ]);
});
