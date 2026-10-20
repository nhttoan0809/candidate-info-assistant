/** Prevent a model that ignores tool instructions from streaming ungrounded prose. */
export function createEvidenceGate<T extends { type: string }>(hasEvidence: () => boolean) {
  return new TransformStream<T, T>({
    transform(part, controller) {
      if (['text-start', 'text-delta', 'text-end'].includes(part.type) && !hasEvidence()) return;
      controller.enqueue(part);
    },
  });
}
