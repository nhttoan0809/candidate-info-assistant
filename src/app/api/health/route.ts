import { getEnv } from '@/lib/env';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const env = getEnv();
    const response = await fetch(`${env.MODEL_URL}/models`, {
      headers: env.MODEL_API_KEY ? { Authorization: `Bearer ${env.MODEL_API_KEY}` } : {},
      signal: AbortSignal.timeout(7000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('unavailable');
    const body = await response.json();
    const found =
      Array.isArray(body.data) && body.data.some((m: { id: string }) => m.id === env.MODEL_NAME);
    return Response.json(
      {
        model: env.MODEL_NAME,
        connected: found,
        message: found ? 'Model sẵn sàng' : 'Không tìm thấy model đã cấu hình',
      },
      { status: found ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { connected: false, message: 'Không kết nối được model. Kiểm tra MODEL_URL và tunnel.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
