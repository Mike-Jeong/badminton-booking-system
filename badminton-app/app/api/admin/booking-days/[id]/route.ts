import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
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
  // 듀티 다중 배정(decisions.md D-39): 키 자체가 없으면 기존 배정을 건드리지 않고,
  // 빈 배열이면 전부 해제한다(부분 업데이트 컨벤션). 배열이 아닌 값은 거부한다.
  if (body.dutyPersonIds !== undefined && !Array.isArray(body.dutyPersonIds)) {
    throw new ValidationError("dutyPersonIds는 배열이어야 합니다.");
  }
  const updated = await updateBookingDay(id, body);
  return jsonOk(updated);
});

export const DELETE = withApiHandler<{ id: string }>(async (req: NextRequest, context: RouteContext<{ id: string }>) => {
  await verifySessionFromRequest(req);
  const { id } = await context.params;
  const result = await deleteBookingDay(id);
  return jsonOk(result);
});
