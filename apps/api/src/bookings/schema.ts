import { z } from "zod";

/** First and last pickup slot starts (30-minute slots; the last ends at 22:30). */
export const FIRST_SLOT = "06:00";
export const LAST_SLOT = "22:00";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, "must be a real calendar date");

const slot = z
  .string()
  .regex(/^([01]\d|2[0-3]):(00|30)$/, "must be HH:00 or HH:30")
  .refine((value) => value >= FIRST_SLOT && value <= LAST_SLOT, {
    message: `must be between ${FIRST_SLOT} and ${LAST_SLOT}`,
  });

const trimmed = (max: number) => z.string().trim().min(1).max(max);

/** Strict: unknown keys are rejected rather than silently dropped. */
export const createBookingSchema = z
  .object({
    restaurantId: trimmed(64),
    date: isoDate,
    slot,
    item: trimmed(120),
    quantity: z.number().int().min(1).max(10_000),
    contactName: trimmed(120),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const listBookingsQuerySchema = z
  .object({
    restaurantId: trimmed(64),
    date: isoDate.optional(),
  })
  .strict();

export const bookingIdSchema = z.string().regex(/^bk_[A-Za-z0-9]{8,64}$/, "malformed booking id");

/** Client-chosen key making a create safe to retry. */
export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_.:-]{8,128}$/, "must be 8-128 characters of letters, digits, _ . : -");

export interface FieldIssue {
  path: string;
  message: string;
}

export function toFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(body)",
    message: issue.message,
  }));
}
