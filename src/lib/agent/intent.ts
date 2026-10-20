import type { Classification, Intent } from '../types';
export const plans: Record<Intent, string> = {
  overview: 'Đọc hồ sơ công khai, đối chiếu các repo và chọn bằng chứng tiêu biểu.',
  experience:
    'Tìm dự án thực tế, đọc README và phân biệt trải nghiệm dự án với kinh nghiệm làm việc.',
  skills: 'Đối chiếu ngôn ngữ, dependencies và code; chỉ kết luận ở mức bằng chứng cho phép.',
  projects: 'Khám phá repo, đọc tài liệu và tìm các quyết định kỹ thuật đáng chú ý.',
  images:
    'Xác định dự án đang được hỏi, tìm ảnh thật trong README và thư mục screenshot rồi đính kèm nguồn.',
  profile: 'Đọc hồ sơ GitHub và tìm CV/README; ghi rõ những thông tin chưa được công khai.',
  fit: 'Đối chiếu yêu cầu vị trí với bằng chứng dự án, chỉ ra điểm phù hợp và phần cần xác minh.',
  greeting: 'Chào bạn và giới thiệu những việc trợ lý có thể giúp, không đọc GitHub.',
  thanks: 'Ghi nhận lời cảm ơn, không khởi động truy xuất dữ liệu.',
  help: 'Giới thiệu khả năng và gợi ý câu hỏi, không cần đọc dữ liệu ứng viên.',
  clarification: 'Hỏi thêm để hiểu bạn muốn tìm điều gì trước khi truy xuất.',
  other: 'Giải thích phạm vi trợ lý và gợi ý một câu hỏi liên quan.',
};
export function needsResearch(intent: Intent) {
  return ['overview', 'experience', 'skills', 'projects', 'images', 'profile', 'fit'].includes(
    intent,
  );
}
function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[!?.,;:…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function rule(intent: Intent): Classification {
  return { intent, method: 'rules', summary: plans[intent] };
}
export function isImageRequest(text: string) {
  return /hinh anh|screenshot|screen shot|anh (?:du an|ung dung|giao dien|minh hoa)|xem anh|hien thi anh|\bimages?\b|\bphotos?\b|visual preview/.test(
    normalize(text),
  );
}
export function isImageFollowUp(text: string) {
  return (
    isImageRequest(text) &&
    /\b(do|nay|vua (?:noi|nhac)|that (?:app|project)|this (?:app|project)|it)\b/.test(
      normalize(text),
    )
  );
}
export function classifyByRules(text: string): Classification {
  const q = normalize(text);
  // Exact social turns only: "Hello, phân tích repo CSM" must still reach research.
  if (
    /^(hello|hi|hey|chao|xin chao|chao ban|hello ban|hello there|hi there|hey there|how are you|ban khoe khong|chao buoi sang|good (morning|afternoon|evening)|alo|👋)( ban| nhe| a)?$/.test(
      q,
    )
  )
    return rule('greeting');
  if (
    /^(cam on( ban| nhe| nhieu)?|thank(s| you)( very much)?|ok(ay)?|oke|da hieu|tuyet voi|👍)$/.test(
      q,
    )
  )
    return rule('thanks');
  if (isImageRequest(text)) return rule('images');
  if (
    /^(help|giup toi|huong dan|ban (co the |lam duoc |giup duoc )?(gi|lam gi)|how (can you help|does this work)|what can you do|ban la ai)$/.test(
      q,
    )
  )
    return rule('help');
  const patterns: [Intent, RegExp][] = [
    ['other', /thoi tiet|weather|gia (vang|bitcoin)|stock price|ke chuyen cuoi/],
    ['fit', /phu hop|tuyen dung|job description|\bjd\b|hire|hiring|vi tri|fit for/],
    ['experience', /kinh nghiem|nam lam|cong ty|experience|employment|career/],
    ['profile', /\bcv\b|ly lich|lien he|hoc van|ho so|email|resume|contact|education|profile/],
    ['skills', /ky nang|cong nghe|stack|skill|react|typescript|frontend|front.end|tailwind/],
    ['projects', /du an|repo|project|code|kien truc|architecture|ung dung|application|\bapp\b/],
    ['overview', /tong quan|gioi thieu|ung vien|about|overview|candidate|ban than/],
  ];
  return rule(patterns.find(([, re]) => re.test(q))?.[0] || 'clarification');
}
export function validateModelIntent(intent: Intent, text: string): Classification {
  const rules = classifyByRules(text);
  if (rules.intent !== 'clarification' && rules.intent !== intent) return rules;
  return { intent, method: 'model', summary: plans[intent] };
}
export function isResearchFollowUp(text: string) {
  return (
    /^(?:(?:hay|please) )?(tiep tuc|noi them|chi tiet hon|vi sao|tai sao|tom tat|viet gon|rut gon|continue|tell me more|why|summari[sz]e|shorter)\b/.test(
      normalize(text),
    ) || /dan chung tu code|diem manh noi bat|ban tom tat|phan con thieu/.test(normalize(text))
  );
}
export function directReply(intent: Intent): string | null {
  switch (intent) {
    case 'greeting':
      return 'Chào bạn! Mình là trợ lý tìm hiểu ứng viên qua GitHub. Bạn muốn xem **dự án**, **kỹ năng**, hay **kinh nghiệm có bằng chứng**? Bạn cũng có thể đưa mô tả vị trí để mình đối chiếu.';
    case 'thanks':
      return 'Rất vui được hỗ trợ bạn! Khi cần, mình có thể cùng bạn tìm hiểu sâu hơn về một dự án hoặc kỹ năng của ứng viên.';
    case 'help':
      return 'Mình có thể giúp bạn:\n\n- Tìm hiểu dự án và các quyết định kỹ thuật.\n- Đối chiếu kỹ năng với README, dependencies và code.\n- Tìm thông tin hồ sơ công khai hoặc so sánh với yêu cầu vị trí.\n\nVí dụ: **“Phân tích một dự án frontend và dẫn nguồn.”** Mình chỉ đọc GitHub khi câu hỏi cần dữ liệu ứng viên.';
    case 'clarification':
      return 'Bạn muốn tìm hiểu điều gì cụ thể? Bạn có thể hỏi về **kỹ năng**, **một dự án**, **hồ sơ**, hoặc gửi **yêu cầu vị trí tuyển dụng** để mình đối chiếu. Mình sẽ chờ bạn làm rõ trước khi đọc GitHub.';
    case 'other':
      return 'Mình tập trung hỗ trợ tìm hiểu ứng viên từ GitHub công khai. Với câu hỏi này, mình chưa cần đọc repo. Bạn có muốn xem một dự án hoặc kỹ năng của ứng viên không?';
    default:
      return null;
  }
}
