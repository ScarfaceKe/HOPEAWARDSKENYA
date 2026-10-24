import test from "node:test";
import assert from "node:assert/strict";
import { classifySettlement, isRealReceipt } from "../server/payment-proof";

test("an accepted STK request is not proof of payment", () => {
  // The exact shape MegaPay returns when the prompt is merely accepted. Crediting
  // on this is what let a reversed payment keep its vote.
  assert.equal(
    classifySettlement({
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing",
    }),
    "pending",
  );
  assert.equal(classifySettlement({ ResultCode: "0", success: true }), "pending");
  assert.equal(classifySettlement({}), "pending");
  assert.equal(classifySettlement(null), "pending");
});

test("a real M-Pesa receipt means the vote is owed", () => {
  assert.equal(classifySettlement({ ResultCode: "0", MpesaReceiptNumber: "SGR7XK2P9Q" }), "paid");
  assert.equal(classifySettlement({ TransactionStatus: "Completed" }), "paid");
  assert.equal(
    classifySettlement({ TransactionStatus: "Completed", TransactionReceipt: "SGR7XK2P9Q" }),
    "paid",
  );
});

test("N/A is not a receipt", () => {
  assert.equal(isRealReceipt("N/A"), false);
  assert.equal(isRealReceipt("n/a"), false);
  assert.equal(isRealReceipt("none"), false);
  assert.equal(isRealReceipt(""), false);
  assert.equal(isRealReceipt(null), false);
  assert.equal(isRealReceipt("SGR7XK2P9Q"), true);

  // The live transactionstatus response for an unpaid order.
  assert.equal(
    classifySettlement({
      ResultCode: "200",
      ResultDesc: "Unknown error",
      TransactionStatus: "Failed",
      TransactionCode: "2035",
      TransactionReceipt: "N/A",
    }),
    "failed",
  );
});

test("cancellations and reversals are failures, not pending", () => {
  assert.equal(
    classifySettlement({ ResponseCode: "1032", ResponseDescription: "Request cancelled by user" }),
    "failed",
  );
  assert.equal(classifySettlement({ status: "reversed" }), "failed");
  assert.equal(classifySettlement({ TransactionStatus: "Cancelled" }), "failed");
  assert.equal(classifySettlement({ ResultDesc: "Insufficient funds" }), "failed");
});
