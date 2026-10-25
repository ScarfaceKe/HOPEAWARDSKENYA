// ─── Did money actually move? ────────────────────────────────────────────────
// MegaPay answers an STK request with `ResultCode/ResponseCode: 0` and
// "Success. Request accepted for processing". That means the prompt was
// accepted — NOT that the fan paid. Crediting a vote on it lets a reversed or
// abandoned payment keep a vote, which is the one thing this site cannot do.
//
// A vote is only owed when there is settlement evidence: an M-Pesa receipt or a
// completed transaction status. Anything else is "pending" and must be confirmed
// with `/backend/v1/transactionstatus`.
//
// Pure and dependency-free so the rule is unit-tested without a database.

export type Settlement = "paid" | "failed" | "pending";

/** M-Pesa receipts are alphanumeric; MegaPay sends "N/A" when nothing settled. */
export function isRealReceipt(value: unknown): boolean {
  const text =
    typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  if (!text) return false;
  return !/^(n\/?a|none|null|-|0)$/i.test(text);
}

const FAILURE_TEXT = /cancel|fail|declin|insufficient|timed?\s*out|rejected|wrong pin|not enough/i;
const ACCEPTED_TEXT = /accepted for processing|request accepted|being processed/i;
const FAILED_STATUS = /cancel|fail|declin|insufficient|timed?\s*out|rejected/i;

/**
 * M-Pesa result codes that are terminal failures, phrased so a fan knows their
 * money is safe. Code 17 is the paying shortcode refusing the transaction — a
 * merchant-side problem, not the fan's balance. Kept pure so the wording is
 * unit-tested instead of drifting inside the route.
 */
const FAILURE_REASONS: Record<string, string> = {
  "1": "M-Pesa says this number's balance is too low for this payment.",
  "17": "MegaPay's paying shortcode could not process this one (M-Pesa code 17). Nothing was charged — try again in a moment, or try a smaller amount.",
  "1019": "The M-Pesa prompt expired before it was approved — nothing was charged.",
  "1032": "You cancelled the M-Pesa prompt — nothing was charged.",
  "1037": "The M-Pesa prompt timed out before it was approved — nothing was charged. Try again and enter your PIN promptly.",
  "2001": "Wrong M-Pesa PIN — nothing was charged.",
};

/** The fan-facing explanation for a failure code, or undefined if we have none. */
export function paymentFailureReason(code: unknown): string | undefined {
  const key =
    typeof code === "string" ? code.trim() : typeof code === "number" ? String(code) : "";
  return key ? FAILURE_REASONS[key] : undefined;
}

/**
 * Classifies a MegaPay callback or transaction-status body.
 *
 * `paid`    — a real receipt or a completed status: the vote is owed.
 * `failed`  — cancelled/declined/reversed: no vote, and an existing one is void.
 * `pending` — the request was merely accepted (or says nothing): keep waiting.
 */
export function classifySettlement(body: unknown): Settlement {
  if (!body || typeof body !== "object") return "pending";
  const b = body as Record<string, unknown>;

  const receipt = b.TransactionReceipt ?? b.MpesaReceiptNumber ?? b.TransID ?? b.transaction_receipt;
  if (isRealReceipt(receipt)) return "paid";

  const txStatus = String(b.TransactionStatus ?? b.transaction_status ?? "").toLowerCase();
  if (txStatus === "completed" || txStatus === "success") return "paid";
  if (FAILED_STATUS.test(txStatus)) return "failed";

  const desc = String(
    b.ResultDesc ?? b.ResponseDescription ?? b.result_desc ?? b.message ?? "",
  );
  if (FAILURE_TEXT.test(desc)) return "failed";

  const status = String(b.status ?? "").toLowerCase();
  if (status === "failed" || status === "cancelled" || status === "canceled" || status === "reversed") {
    return "failed";
  }

  // Known M-Pesa failure codes: cancelled by user, timeout, insufficient funds,
  // wrong PIN, and code 17 (the paying shortcode refused the transaction).
  // TransactionCode is included because the status endpoint reports M-Pesa's
  // code there, not only in ResultCode.
  const code = String(
    b.ResultCode ?? b.ResponseCode ?? b.TransactionCode ?? b.result_code ?? b.transaction_code ?? "",
  );
  if (["1032", "1037", "2001", "17", "1"].includes(code)) return "failed";

  // "Success. Request accepted for processing" and anything without proof: the
  // prompt was accepted, the money has not been confirmed.
  if (ACCEPTED_TEXT.test(desc)) return "pending";

  return "pending";
}
