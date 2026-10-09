/** Errors that map 1:1 to an HTTP status and a stable machine-readable code. */
export class BookingError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export const notFound = (what: string, id: string) =>
  new BookingError(404, `${what}_not_found`, `${what} '${id}' was not found`);
