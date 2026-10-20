import 'server-only';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getEnv } from '../env';
import { getModel } from './model';
import {
  classifyByRules,
  validateModelIntent,
  isResearchFollowUp,
  needsResearch,
  isImageFollowUp,
} from './intent';
import type { Classification } from '../types';

export async function classifyIntent(
  text: string,
  signal: AbortSignal,
  previousQuestions: string[] = [],
): Promise<Classification> {
  const quick = classifyByRules(text);
  if (['greeting', 'thanks', 'help', 'other'].includes(quick.intent)) return quick;
  const previous = [...previousQuestions]
    .reverse()
    .map(classifyByRules)
    .find((c) => needsResearch(c.intent));
  if (quick.intent === 'images') {
    if (isImageFollowUp(text) && !previous) return classifyByRules('???');
    return quick;
  }
  if (quick.intent === 'clarification' && isResearchFollowUp(text)) {
    return previous || quick;
  }
  if (quick.intent === 'clarification' && !previous && text.trim().split(/\s+/).length <= 3)
    return quick;
  const env = getEnv();
  try {
    const { output } = await generateText({
      model: getModel(true),
      temperature: 0,
      maxOutputTokens: 160,
      maxRetries: 0,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(env.CLASSIFIER_TIMEOUT_MS)]),
      output: Output.object({
        schema: z.object({
          intent: z.enum([
            'overview',
            'experience',
            'skills',
            'projects',
            'images',
            'profile',
            'fit',
            'greeting',
            'thanks',
            'help',
            'clarification',
            'other',
          ]),
        }),
      }),
      instructions:
        'Phân loại ý định câu hỏi về ứng viên GitHub. Trả JSON. Ví dụ: "Giới thiệu ứng viên" => overview; "Kinh nghiệm làm việc" => experience; "Kỹ năng React" => skills; "Có bao nhiêu repo? Phân tích dự án CSM" => projects; "CV, học vấn, email" => profile; "Phù hợp vị trí frontend không?" => fit; "Thời tiết?" => other. Chỉ chọn fit khi có yêu cầu đánh giá phù hợp với vị trí tuyển dụng. Chào hỏi đơn thuần => greeting; lời cảm ơn => thanks; hỏi bạn làm được gì => help; câu mơ hồ không đủ thông tin => clarification; không tự mặc định nghiên cứu ứng viên. Dựa vào câu hỏi trước nếu câu mới là câu hỏi tiếp nối.',
      prompt: `Câu hỏi trước (chỉ để hiểu tham chiếu): ${previousQuestions.slice(-2).join(' | ')}\nCâu hỏi hiện tại: ${text}\n/no_think`,
    });
    return validateModelIntent(output.intent, text);
  } catch {
    if (signal.aborted) throw signal.reason;
    return quick;
  }
}
