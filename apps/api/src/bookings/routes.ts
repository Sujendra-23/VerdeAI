import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { BookingError } from "./errors.js";
import {
  bookingIdSchema,
  createBookingSchema,
  idempotencyKeySchema,
  listBookingsQuerySchema,
  toFieldIssues,
} from "./schema.js";
import type { BookingService } from "./service.js";

type Handler = (req: Request, res: Response) => Promise<void>;

/** Express 4 does not catch rejected promises; route them to the error handler. */
const wrap =
  (handler: Handler): RequestHandler =>
  (req, res, next: NextFunction) => {
    handler(req, res).catch(next);
  };

function validationError(issues: ReturnType<typeof toFieldIssues>): BookingError {
  return new BookingError(400, "validation_error", "request validation failed", issues);
}

export function createBookingRouter(service: BookingService): Router {
  const router = Router();

  router.post(
    "/bookings",
    wrap(async (req, res) => {
      const rawKey = req.get("Idempotency-Key");
      let key: string | undefined;
      if (rawKey !== undefined) {
        const parsedKey = idempotencyKeySchema.safeParse(rawKey);
        if (!parsedKey.success) {
          throw new BookingError(400, "invalid_idempotency_key", parsedKey.error.issues[0]!.message);
        }
        key = parsedKey.data;
      }
      const body = createBookingSchema.safeParse(req.body);
      if (!body.success) throw validationError(toFieldIssues(body.error));

      const { booking, replayed } = await service.create(body.data, key);
      res.status(replayed ? 200 : 201);
      if (replayed) res.set("Idempotent-Replayed", "true");
      res.set("Location", `/api/bookings/${booking.id}`).json(booking);
    }),
  );

  router.get(
    "/bookings",
    wrap(async (req, res) => {
      const query = listBookingsQuerySchema.safeParse(req.query);
      if (!query.success) throw validationError(toFieldIssues(query.error));
      res.json(await service.list(query.data.restaurantId, query.data.date));
    }),
  );

  router.get(
    "/bookings/:id",
    wrap(async (req, res) => {
      const id = bookingIdSchema.safeParse(req.params.id);
      if (!id.success) throw validationError(toFieldIssues(id.error));
      res.json(await service.get(id.data));
    }),
  );

  router.post(
    "/bookings/:id/cancel",
    wrap(async (req, res) => {
      const id = bookingIdSchema.safeParse(req.params.id);
      if (!id.success) throw validationError(toFieldIssues(id.error));
      res.json(await service.cancel(id.data));
    }),
  );

  return router;
}

/** Terminal error middleware: JSON for booking errors, body-parser failures and the unexpected. */
export function jsonErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof BookingError) {
    res.status(error.status).json({ error: error.message, code: error.code, details: error.details });
    return;
  }
  const typed = error as { type?: string; status?: number } | null;
  if (typed?.type === "entity.parse.failed") {
    res.status(400).json({ error: "request body is not valid JSON", code: "invalid_json" });
    return;
  }
  if (typed?.type === "entity.too.large") {
    res.status(413).json({ error: "request body is too large", code: "payload_too_large" });
    return;
  }
  // eslint-disable-next-line no-console
  console.error("[verdeai-api] unhandled error", error);
  res.status(500).json({ error: "internal server error", code: "internal_error" });
}
