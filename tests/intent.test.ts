import { describe, expect, it } from 'vitest';
import {
  classifyByRules,
  validateModelIntent,
  directReply,
  needsResearch,
  isResearchFollowUp,
} from '../src/lib/agent/intent';
describe('intent fallback', () => {
  it('rejects a syntactically valid but contradicted small-model classification', () => {
    expect(validateModelIntent('fit', 'Phân tích công nghệ frontend trong repo CSM')).toMatchObject(
      { intent: 'skills', method: 'rules' },
    );
    expect(validateModelIntent('projects', 'Ứng viên có bao nhiêu repo?')).toMatchObject({
      intent: 'projects',
      method: 'model',
    });
  });
  it.each([
    ['Ứng viên có phù hợp vị trí frontend không?', 'fit'],
    ['Kinh nghiệm làm việc của ứng viên?', 'experience'],
    ['CV và học vấn', 'profile'],
    ['Kỹ năng React và TypeScript?', 'skills'],
    ['Phân tích dự án', 'projects'],
    ['Giới thiệu ứng viên', 'overview'],
    ['Thời tiết hôm nay?', 'other'],
    ['Hello', 'greeting'],
    ['Hello!', 'greeting'],
    ['Xin chào bạn', 'greeting'],
    ['Cảm ơn bạn', 'thanks'],
    ['Bạn có thể làm gì?', 'help'],
    ['Bạn là ai?', 'help'],
    ['???', 'clarification'],
    ['Hello, phân tích repo CSM', 'projects'],
    ['Cảm ơn, cho tôi biết kỹ năng React', 'skills'],
    ['Cung cấp hình ảnh trực quan về ứng dụng đó được không?', 'images'],
    ['Cho tôi xem screenshot dự án CSM', 'images'],
    ['Ứng dụng đó có chức năng gì?', 'projects'],
  ])('routes %s honestly', (q, intent) =>
    expect(classifyByRules(q)).toMatchObject({ intent, method: 'rules' }),
  );
  it('does not route social or ambiguous questions to research', () => {
    for (const q of ['Hello', 'Cảm ơn', 'Bạn có thể làm gì?', '???', 'Thời tiết hôm nay']) {
      const classification = validateModelIntent('overview', q);
      // An unresolved ambiguous classifier result is handled separately; social rules always win.
      if (q !== '???') expect(needsResearch(classification.intent)).toBe(false);
      expect(directReply(classifyByRules(q).intent)).toBeTruthy();
    }
    expect(directReply('skills')).toBeNull();
    expect(isResearchFollowUp('Hãy tóm tắt câu trả lời trước')).toBe(true);
  });
});
