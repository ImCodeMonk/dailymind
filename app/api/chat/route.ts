import { llm } from "@/lib/llm";

export async function POST(req: Request) {
  const { message } = await req.json();
  const result = await llm.invoke(message);
  return Response.json({ reply: result.content });
}