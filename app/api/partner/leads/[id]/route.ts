import { db, logEvent } from "@/lib/db";

export async function PATCH(req: Request, ctx: RouteContext<"/api/partner/leads/[id]">) {
  const { id } = await ctx.params;
  const { status, assigned } = (await req.json()) as { status?: string; assigned?: string };
  if (status) db().prepare("UPDATE leads SET status = ? WHERE id = ?").run(status, id);
  if (assigned) db().prepare("UPDATE leads SET assigned = ? WHERE id = ?").run(assigned, id);
  logEvent("lead.update", id, { status, assigned });
  return Response.json({ ok: true });
}
