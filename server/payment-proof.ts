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
  // wrong PIN.
  const code = String(b.ResultCode ?? b.ResponseCode ?? b.result_code ?? "");
  if (["1032", "1037", "2001", "1"].includes(code)) return "failed";

  // "Success. Request accepted for processing" and anything without proof: the
  // prompt was accepted, the money has not been confirmed.
  if (ACCEPTED_TEXT.test(desc)) return "pending";

  return "pending";
}
