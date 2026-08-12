import { getNeedFixList } from '@/lib/memory';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(req: Request) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  try {
    const list = await getNeedFixList();
    return Response.json({ list });
  } catch (err) {
    console.error('GET /api/corrections/list error', err);
    return Response.json({ error: 'Unable to fetch corrections.' }, { status: 500 });
  }
}
