/**
 * The hard rule about money: this server may ask M-Pesa to charge a fan and may
 * ask what happened to that charge. It must never be able to move money back.
 *
 * A reversal cannot be prevented here — only the owner of the receiving shortcode
 * (the gateway) or Safaricom can issue one, and a website has no way to stop it.
 * What this test guarantees is the part that *is* ours: no code path in this
 * repository can submit a reversal, refund or cancellation to the gateway. If
 * someone adds one, this suite fails before it can ship.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SERVER_DIR = join(process.cwd(), "server");

/** The only two gateway endpoints this app is allowed to call. */
const ALLOWED = new Set(["initiatestk", "transactionstatus"]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

test("the server only calls the two allowed gateway endpoints", () => {
  const seen = new Map<string, string[]>();

  for (const file of sourceFiles(SERVER_DIR)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/backend\/v1\/([a-z0-9_-]+)/gi)) {
      const name = match[1].toLowerCase();
      seen.set(name, [...(seen.get(name) ?? []), file]);
    }
  }

  assert.ok(seen.size > 0, "expected to find the gateway calls — the scan is broken otherwise");

  const unexpected = [...seen.keys()].filter((name) => !ALLOWED.has(name));
  assert.deepEqual(
    unexpected,
    [],
    `gateway endpoint(s) outside the allowlist: ${unexpected
      .map((name) => `${name} (${seen.get(name)!.join(", ")})`)
      .join("; ")}. Charging a fan and reading a status are the only permitted calls.`,
  );
});

test("every gateway URL is an absolute https call to the payment gateway", () => {
  for (const file of sourceFiles(SERVER_DIR)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/"https?:\/\/[^"]*megapay[^"]*"/gi)) {
      const url = match[0].slice(1, -1);
      assert.match(
        url,
        /^https:\/\/megapay\.co\.ke\/backend\/v1\/(initiatestk|transactionstatus)$/,
        `${file}: unexpected gateway URL ${url}`,
      );
    }
  }
});
