import { expect, it, vi } from 'vitest';
import { createProgressObserver } from '../src/lib/agent/progress';
it('reports genuine reasoning/tool/text phases without putting private reasoning into events', async () => {
  const report = vi.fn();
  const firstText = vi.fn();
  const firstModel = vi.fn();
  let evidence = false;
  const observer = createProgressObserver<{ type: string; text?: string }>(
    report,
    firstText,
    firstModel,
    () => evidence,
  );
  const reader = observer.readable.getReader();
  const writer = observer.writable.getWriter();
  const consume = (async () => {
    while (!(await reader.read()).done) {}
  })();
  for (const p of [
    { type: 'start-step' },
    { type: 'reasoning-start' },
    { type: 'reasoning-delta', text: 'PRIVATE' },
    { type: 'reasoning-delta', text: 'PRIVATE' },
    { type: 'tool-call' },
    { type: 'text-delta', text: 'ungrounded' },
  ])
    await writer.write(p);
  expect(firstText).not.toHaveBeenCalled();
  evidence = true;
  await writer.write({ type: 'start-step' });
  await writer.write({ type: 'reasoning-start' });
  await writer.write({ type: 'text-delta', text: 'answer' });
  await writer.write({ type: 'text-delta', text: 'answer continued' });
  await writer.close();
  await consume;
  expect(report.mock.calls).toEqual([['reasoning'], ['preparing'], ['reasoning'], ['streaming']]);
  expect(firstModel).toHaveBeenCalledTimes(1);
  expect(firstText).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(report.mock.calls)).not.toContain('PRIVATE');
});
