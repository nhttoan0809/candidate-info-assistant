import type { Progress } from '../types';

/** Observe event types only. Never forward the model's private reasoning text. */
export function createProgressObserver<T extends { type: string; text?: string }>(
  report: (phase: Progress['phase']) => void,
  onFirstText: () => void,
  onFirstModelEvent: () => void,
  hasEvidence: () => boolean,
) {
  let firstModel = false;
  let firstText = false;
  let phase = '';
  return new TransformStream<T, T>({
    transform(part, controller) {
      if (part.type === 'start-step') phase = '';
      if (
        !firstModel &&
        [
          'reasoning-start',
          'reasoning-delta',
          'text-delta',
          'tool-input-start',
          'tool-call',
        ].includes(part.type)
      ) {
        firstModel = true;
        onFirstModelEvent();
      }
      let next: Progress['phase'] | undefined;
      if (part.type === 'reasoning-start' || part.type === 'reasoning-delta') next = 'reasoning';
      if (part.type === 'tool-input-start' || part.type === 'tool-call') next = 'preparing';
      if (part.type === 'text-delta' && part.text?.trim() && hasEvidence()) {
        next = 'streaming';
        if (!firstText) {
          firstText = true;
          onFirstText();
        }
      }
      if (next && next !== phase) {
        phase = next;
        report(next);
      }
      controller.enqueue(part);
    },
  });
}
export const progressCopy: Record<Progress['phase'], { label: string; detail: string }> = {
  classification: {
    label: 'Đang hiểu câu hỏi',
    detail: 'Xác định cần đọc dữ liệu, trả lời trực tiếp hay hỏi thêm.',
  },
  'waiting-model': {
    label: 'Đang chờ mô hình xử lý',
    detail: 'Đã gửi yêu cầu tới Ollama; chưa nhận token trả lời.',
  },
  reasoning: {
    label: 'Mô hình đang phân tích',
    detail: 'Đã nhận tín hiệu suy luận; nội dung suy nghĩ nội bộ không hiển thị.',
  },
  tool: {
    label: 'Đang đọc dữ liệu GitHub',
    detail: 'Công cụ đang truy xuất bằng chứng cho câu hỏi.',
  },
  preparing: {
    label: 'Đang chuẩn bị câu trả lời',
    detail: 'Mô hình đang chọn bước tiếp theo hoặc tổng hợp dữ liệu; chưa có nội dung để hiển thị.',
  },
  streaming: {
    label: 'Đang viết câu trả lời',
    detail: 'Nội dung được hiển thị ngay khi nhận từ mô hình.',
  },
  done: { label: 'Đã hoàn tất', detail: 'Luồng phản hồi đã kết thúc.' },
  error: { label: 'Chưa hoàn tất phản hồi', detail: 'Bạn có thể thử lại hoặc hỏi ngắn gọn hơn.' },
};
