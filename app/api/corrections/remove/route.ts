import { removeNeedFixAtIndexes } from '@/lib/memory';
import { requireAdmin } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    const unauthorized = requireAdmin(req);
    if (unauthorized) return unauthorized;
    const body = await req.json().catch(() => null);
    const indexes: number[] = Array.isArray(body?.indexes) ? body.indexes : [];
    if (!indexes.length) return Response.json({ removed: 0 });
    await removeNeedFixAtIndexes(indexes);
    return Response.json({ removed: indexes.length });
  } catch (err) {
    console.error('POST /api/corrections/remove error', err);
    return Response.json({ error: 'Unable to remove corrections.' }, { status: 500 });
  }
}
