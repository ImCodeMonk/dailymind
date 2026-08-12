export function requireAdmin(req: Request) {
  const token = req.headers.get('x-admin-token') || '';
  const expected = process.env.ADMIN_TOKEN || '';
  if (!expected || token !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
