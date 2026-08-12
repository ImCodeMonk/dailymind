import { getLastSavedNote } from "@/lib/memory";

export async function GET() {
  try {
    const last = await getLastSavedNote();
    if (!last) return Response.json({ last: null });
    return Response.json({ last });
  } catch (err) {
    console.error("GET /api/notes/last error", err);
    return Response.json({ error: "Unable to read last note." }, { status: 500 });
  }
}
