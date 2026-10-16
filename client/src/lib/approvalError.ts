import { CATEGORY_CAP } from "../../../shared/schema";

/**
 * Turns a failed nominee approval into the exact words the admin is shown.
 *
 * The server is the only source of truth here. A category may be described as
 * full *only* when the server actually rejected it as full (`categoryFull`);
 * every other failure — a stale security token, a validation error, a network
 * drop — must report the real reason instead of inventing a nominee count.
 * A hardcoded count was what made the panel claim categories were full while
 * every category read `0/9 spots filled`.
 */
export function approvalFailure(
  err: (Error & { categoryFull?: boolean }) | null | undefined,
  categoryName: string,
): { title: string; description: string; categoryFull: boolean } {
  if (err?.categoryFull) {
    return {
      categoryFull: true,
      title: "Cannot approve — category full",
      description: `${categoryName} already has its ${CATEGORY_CAP} nominees. Remove one from that category first, then try again.`,
    };
  }

  return {
    categoryFull: false,
    title: "Approval failed",
    description:
      err?.message && err.message.length > 0
        ? err.message
        : `Could not add this nominee to ${categoryName}.`,
  };
}

export type CategoryFullError = Error & { categoryFull?: boolean };

/**
 * Shapes a failed `POST /api/artists` response into the error the approve flow
 * throws. Kept outside the hook so it can be tested: this is the seam that
 * decides whether the admin is told "category full" or the server's real
 * reason, and it may only claim a full category when the server said 409 (or
 * sent its own `categoryFull` flag).
 */
export function createArtistError(status: number, body: unknown): CategoryFullError {
  const payload = (body ?? {}) as { message?: unknown; categoryFull?: unknown };
  const message =
    typeof payload.message === "string" && payload.message.length > 0
      ? payload.message
      : status === 400
        ? "That nomination is not valid."
        : "Failed to create artist";

  const error = new Error(message) as CategoryFullError;
  if (status === 409 || payload.categoryFull === true) error.categoryFull = true;
  return error;
}
