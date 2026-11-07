import { connection } from "next/server";
import { db, logEvent, newId } from "@/lib/db";
import { getOrder, orderView } from "@/lib/orders";

export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const o = getOrder(id);
  if (!o) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(orderView(o));
}

/** Owner actions: pick an install slot, raise a ticket, or (demo) fast-forward time. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  const o = getOrder(id);
  if (!o) return Response.json({ error: "not found" }, { status: 404 });
  const body = (await req.json()) as { slot?: { date: string; window: string }; advanceHours?: number; ticket?: string };
  if (body.slot) {
    db().prepare("UPDATE orders SET slot = ? WHERE id = ?").run(JSON.stringify(body.slot), o.id);
    logEvent("order.slot", o.id, body.slot);
  }
  if (body.advanceHours) {
    db().prepare("UPDATE orders SET offset_hours = offset_hours + ? WHERE id = ?").run(Math.min(Math.max(body.advanceHours, -720), 720), o.id);
  }
  let ticketId: string | undefined;
  if (body.ticket) {
    ticketId = newId("TKT", 5);
    db().prepare("INSERT INTO tickets (id, order_id, created_at, text) VALUES (?,?,?,?)").run(ticketId, o.id, Date.now(), body.ticket.slice(0, 500));
    logEvent("order.ticket", o.id, { ticketId });
  }
  return Response.json({ ...orderView(getOrder(o.id)!), ticketId });
}
