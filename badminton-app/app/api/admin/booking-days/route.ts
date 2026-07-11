import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { createBookingDay, listBookingDays } from "@/lib/services/bookingDayService";
import { ValidationError } from "@/lib/errors";
import type { SlotMode } from "@prisma/client";

export const GET = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);
  const bookingDays = await listBookingDays();
  return jsonOk(bookingDays);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw new ValidationError("요청 본문이 필요합니다.");
  }

  const bookingDay = await createBookingDay(
    {
      date: body.date,
      label: body.label ?? null,
      startTime: body.startTime,
      endTime: body.endTime,
      location: body.location,
      dutyPerson: body.dutyPerson,
      totalSlots: Number(body.totalSlots),
      annualSlots: body.annualSlots !== undefined ? Number(body.annualSlots) : undefined,
      casualSlots: body.casualSlots !== undefined ? Number(body.casualSlots) : undefined,
      slotMode: body.slotMode as SlotMode,
      isOpen: body.isOpen ?? true,
    },
    { autoAssignMonthlyMembers: body.autoAssignMonthlyMembers ?? true }
  );

  return jsonOk(bookingDay, 201);
});
