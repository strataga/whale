export async function GET() {
  return Response.json({
    status: "ok",
    version: "2026-02-08",
    timestamp: Date.now(),
  });
}
