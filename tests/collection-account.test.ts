/**
 * The money rule that broke every payment: KCB paybill 522533 posts each
 * collection to the account number carried in the request. Sending our order id
 * there didn't match an account, so KCB returned the money to the payer while
 * MegaPay reported "Completed". These tests pin the fix in place.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  COLLECTION_ACCOUNT_NUMBER,
  COLLECTION_PAYBILL,
  collectionAccountNumber,
} from "../shared/site";

test("every order sends the KCB collection account, not an order id", () => {
  assert.equal(collectionAccountNumber(), COLLECTION_ACCOUNT_NUMBER);
  assert.match(COLLECTION_ACCOUNT_NUMBER, /^\d{5,12}$/, "must look like a bank account number");
  assert.equal(COLLECTION_PAYBILL, "522533");
});

test("an env override wins, trimmed", () => {
  assert.equal(collectionAccountNumber(" 8035572 "), "8035572");
  assert.equal(collectionAccountNumber("1234567"), "1234567");
});

test("a blank override falls back instead of sending nothing", () => {
  // Sending an empty reference is what made every payment bounce.
  for (const blank of ["", "   ", null, undefined]) {
    assert.equal(collectionAccountNumber(blank as string | null | undefined), COLLECTION_ACCOUNT_NUMBER);
  }
});
