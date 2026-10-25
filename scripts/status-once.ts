// READ-ONLY: ask MegaPay for the status of one transaction request id.
//   npx tsx scripts/status-once.ts PFXID...
export {};

const id = process.argv[2];
if (!id) {
  console.error("usage: npx tsx scripts/status-once.ts PFXID...");
  process.exit(1);
}

const res = await fetch("https://megapay.co.ke/backend/v1/transactionstatus", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    api_key: process.env.MEGAPAY_API_KEY,
    email: process.env.MEGAPAY_EMAIL,
    transaction_request_id: id,
  }),
});

console.log(`http=${res.status}`);
console.log(await res.text());
process.exit(0);
