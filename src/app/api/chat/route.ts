import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type TextStreamPart,
} from 'ai';
import { getEnv } from '@/lib/env';
import { GitHubClient } from '@/lib/github';
import { directReply } from '@/lib/agent/intent';
import { createProgressObserver, progressCopy } from '@/lib/agent/progress';
import { classifyIntent } from '@/lib/agent/classifier';
import { createTools } from '@/lib/agent/tools';
import { createCandidateAgent } from '@/lib/agent/agent';
import { createEvidenceGate } from '@/lib/agent/evidence-gate';
import { allowRequest } from '@/lib/rate-limit';
import { assertSameOrigin, readBody, RequestError } from '@/lib/request';
import { parseAgentRequest } from '@/lib/agent/entry';
import type { Activity, ChatMessage, Evidence, Progress, ProjectImage } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;
const safeError = () =>
  'Không thể hoàn tất phản hồi. Kiểm tra kết nối Ollama/tunnel và thử lại; dữ liệu đã đọc vẫn hiển thị ở phần nguồn.';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const env = getEnv();
    if (!(await allowRequest(request)))
      return Response.json(
        { error: 'Bạn đang gửi quá nhanh. Thử lại sau một phút.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    const {
      entry,
      history,
      classification: entryClassification,
    } = parseAgentRequest(await readBody(request), env.scope);
    if (entry?.action === 'repository' && env.MAX_AGENT_STEPS < 3)
      throw new RequestError('Hỏi nhanh repo cần MAX_AGENT_STEPS từ 3 trở lên.', 503);
    const question = String(history.at(-1)!.content);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(env.MODEL_TIMEOUT_MS)]);
    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer }) => {
        const started = Date.now();
        let repositoryRead = false;
        writer.write({ type: 'start', messageId: crypto.randomUUID() });
        const progress = (phase: Progress['phase'], detail?: string) =>
          writer.write({
            type: 'data-progress',
            id: 'progress',
            data: {
              phase,
              ...progressCopy[phase],
              ...(detail ? { detail } : {}),
              elapsedMs: Date.now() - started,
            },
          });
        const report = (activity: Activity) => {
          if (
            activity.kind === 'tool' &&
            activity.label === 'Đọc dự án' &&
            activity.status === 'done'
          )
            repositoryRead = true;
          writer.write({ type: 'data-activity', id: activity.id, data: activity });
          if (activity.kind === 'tool')
            progress(
              activity.status === 'running' ? 'tool' : 'preparing',
              activity.status === 'running' ? activity.detail : undefined,
            );
        };
        progress('classification');
        report({
          id: 'classification',
          kind: 'classification',
          label: 'Hiểu câu hỏi',
          detail: 'Phân loại ý định truy vấn',
          status: 'running',
        });
        const classification =
          entryClassification ||
          (await classifyIntent(
            question,
            signal,
            history
              .slice(0, -1)
              .filter((m) => m.role === 'user')
              .map((m) => String(m.content)),
          ));
        writer.write({ type: 'data-classification', id: 'intent', data: classification });
        report({
          id: 'classification',
          kind: 'classification',
          label: 'Đã xác định ý định',
          detail: entry
            ? 'Định tuyến theo hành động đã chọn'
            : classification.method === 'model'
              ? 'Phân loại bằng mô hình'
              : 'Định tuyến bằng quy tắc dự phòng',
          status: 'done',
          elapsedMs: Date.now() - started,
        });
        const classificationMs = Date.now() - started;
        const direct = directReply(classification.intent);
        if (direct) {
          // Product-authored routing response: no fake model stream, tools, tokens or GitHub evidence.
          writer.write({ type: 'text-start', id: 'direct' });
          writer.write({ type: 'text-delta', id: 'direct', delta: direct });
          writer.write({ type: 'text-end', id: 'direct' });
          progress('done', 'Phản hồi trực tiếp từ định tuyến hội thoại; không truy xuất GitHub.');
          writer.write({ type: 'finish', finishReason: 'stop' });
          return;
        }
        report({
          id: 'plan',
          kind: 'plan',
          label: 'Hướng tìm hiểu',
          detail: classification.summary,
          status: 'done',
        });
        const sources = new Map<string, Evidence>();
        const images = new Map<string, ProjectImage>();
        const tools = createTools(
          new GitHubClient(signal),
          report,
          (items) => {
            for (const source of items) sources.set(source.url, source);
            writer.write({ type: 'data-sources', id: 'evidence', data: [...sources.values()] });
          },
          (items) => {
            for (const img of items)
              if (images.size < 12 || images.has(img.id)) images.set(img.id, img);
            writer.write({ type: 'data-images', id: 'project-images', data: [...images.values()] });
          },
          entry?.action === 'repository' ? entry.repository : undefined,
          entry?.action === 'overview',
        );
        let steps = 0;
        let firstTextMs: number | undefined;
        let firstModelEventMs: number | undefined;
        const hasEvidence = () =>
          sources.size > 0 && (entry?.action !== 'repository' || repositoryRead);
        const result = await createCandidateAgent(tools, classification, entry).stream({
          messages: history,
          abortSignal: signal,
          onStepStart: () => {
            steps++;
            progress('waiting-model');
            report({
              id: 'answer',
              kind: 'answer',
              label: 'Đang xử lý yêu cầu',
              detail: `Lượt xử lý ${steps} · ${entry ? 'truy xuất và tổng hợp theo hành động đã chọn' : 'mô hình chọn công cụ hoặc viết phản hồi'}`,
              status: 'running',
            });
          },
          onEnd: ({ totalUsage, finishReason }) => {
            writer.write({
              type: 'data-usage',
              id: 'usage',
              data: {
                inputTokens: totalUsage.inputTokens || 0,
                outputTokens: totalUsage.outputTokens || 0,
                elapsedMs: Date.now() - started,
                steps,
                finishReason,
                classificationMs,
                firstTextMs,
                firstModelEventMs,
              },
            });
            if (!hasEvidence()) {
              progress('error');
              if (finishReason === 'length') {
                report({
                  id: 'answer',
                  kind: 'answer',
                  label: 'Chưa hoàn tất truy xuất',
                  detail:
                    'Lượt sinh đã chạm giới hạn trước khi lấy được bằng chứng. Chưa có kết luận về ứng viên.',
                  status: 'error',
                  elapsedMs: Date.now() - started,
                });
                return;
              }
              report({
                id: 'answer',
                kind: 'answer',
                label: 'Chưa có bằng chứng',
                detail: 'Model không truy xuất dữ liệu; phản hồi chưa xác minh đã được chặn.',
                status: 'error',
              });
              writer.write({
                type: 'error',
                errorText:
                  entry?.action === 'repository'
                    ? 'Chưa đọc được repo đã chọn để kiểm chứng. Hãy thử lại.'
                    : 'Model chưa sử dụng công cụ để kiểm chứng dữ liệu. Hãy thử lại hoặc chọn model hỗ trợ tool calling tốt hơn.',
              });
              return;
            }
            progress(finishReason === 'length' ? 'error' : 'done');
            report({
              id: 'answer',
              kind: 'answer',
              label:
                finishReason === 'length' ? 'Đã chạm giới hạn phản hồi' : 'Đã tổng hợp phản hồi',
              detail: `${sources.size} nguồn đã truy xuất`,
              status: finishReason === 'length' ? 'error' : 'done',
              elapsedMs: Date.now() - started,
            });
          },
        });
        // Do not show ungrounded prose if a small/local model ignores the tool instructions.
        const observed = result.stream.pipeThrough(
          createProgressObserver<TextStreamPart<typeof tools>>(
            progress,
            () => {
              firstTextMs = Date.now() - started;
            },
            () => {
              firstModelEventMs = Date.now() - started;
            },
            hasEvidence,
          ),
        );
        const grounded = observed.pipeThrough(
          createEvidenceGate<TextStreamPart<typeof tools>>(hasEvidence),
        );
        writer.merge(
          toUIMessageStream({
            stream: grounded,
            sendStart: false,
            sendReasoning: false,
            onError: safeError,
          }),
        );
      },
      onError: safeError,
    });
    return createUIMessageStreamResponse({
      stream,
      headers: { 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
    });
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 503;
    const message =
      error instanceof RequestError
        ? error.message
        : 'Dịch vụ chưa sẵn sàng. Kiểm tra cấu hình môi trường trên máy chủ.';
    return Response.json({ error: message }, { status });
  }
}
