import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import {
  getBookingDayById,
  updateBookingDay,
  deleteBookingDay,
} from "@/lib/services/bookingDayService";

export const GET = withApiHandler<{ id: string }>(async (req: NextRequest, context: RouteContext<{ id: string }>) => {
  await verifySessionFromRequest(req);
  const { id } = await context.params;
  const bookingDay = await getBookingDayById(id);
  return jsonOk(bookingDay);
});

export const PATCH = withApiHandler<{ id: string }>(async (req: NextRequest, context: RouteContext<{ id: string }>) => {
  await verifySessionFromRequest(req);
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const updated = await updateBookingDay(id, body);
  return jsonOk(updated);
});

export const DELETE = withApiHandler<{ id: string }>(async (req: NextRequest, context: RouteContext<{ id: string }>) => {
  await verifySessionFromRequest(req);
  const { id } = await context.params;
  const result = await deleteBookingDay(id);
  return jsonOk(result);
});
