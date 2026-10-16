import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeBase32,
  enrollmentSecret,
  generateSecret,
  generateTotp,
  otpauthUri,
  twoFactorEnabled,
  verifyTotp,
} from "../server/totp";

// base32 of the RFC 6238 SHA-1 key "12345678901234567890"
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("decodeBase32 matches the RFC 6238 key", () => {
  assert.equal(decodeBase32(RFC_SECRET).toString("ascii"), "12345678901234567890");
  assert.equal(decodeBase32("gezd gnbv-gy3t qojq").toString("ascii").length > 0, true);
  assert.equal(decodeBase32("").length, 0);
  assert.throws(() => decodeBase32("188"), /Invalid base32/);
});

test("generateTotp reproduces the RFC 6238 SHA-1 test vectors", () => {
  const vectors: Array<[number, string]> = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  for (const [seconds, expected] of vectors) {
    assert.equal(generateTotp(RFC_SECRET, seconds * 1000, { digits: 8 }), expected, `T=${seconds}`);
  }
});

test("verifyTotp accepts the current code and rejects everything else", () => {
  const now = 1_700_000_000_000;
  const code = generateTotp(RFC_SECRET, now);
  assert.equal(code.length, 6);
  assert.equal(verifyTotp(RFC_SECRET, code, now), true);
  assert.equal(verifyTotp(RFC_SECRET, ` ${code} `, now), true, "surrounding spaces are tolerated");
  const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
  assert.equal(verifyTotp(RFC_SECRET, wrong, now), false);
  assert.equal(verifyTotp(RFC_SECRET, "abcdef", now), false);
  assert.equal(verifyTotp(RFC_SECRET, "12345", now), false);
  assert.equal(verifyTotp(RFC_SECRET, "", now), false);
  assert.equal(verifyTotp("not-base32!!", code, now), false);
  assert.equal(verifyTotp("", code, now), false);
});

test("verifyTotp allows one step of clock drift, not three", () => {
  const now = 1_700_000_000_000;
  assert.equal(verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now - 30_000), now), true);
  assert.equal(verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now + 30_000), now), true);
  assert.equal(verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now - 90_000), now), false);
});

test("this is RFC test mode: larger codes are rejected by the 6-digit login check", () => {
  const now = 1_700_000_000_000;
  assert.equal(verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now, { digits: 8 }), now), false);
});

test("generateSecret produces 20 decodable bytes", () => {
  const secret = generateSecret();
  assert.equal(decodeBase32(secret).length, 20);
  assert.match(secret, /^[A-Z2-7]+$/);
  assert.notEqual(generateSecret(), secret, "each call is a fresh secret");
});

test("enrollmentSecret is stable within a process", () => {
  // Regression: a rotating enrolment secret meant an admin could scan one secret,
  // come back to the tab, set the *other* one, and lock themselves out.
  const first = enrollmentSecret();
  const second = enrollmentSecret();
  assert.equal(first, second);
  assert.equal(decodeBase32(first).length, 20);
});

test("twoFactorEnabled only trusts a usable base32 secret", () => {
  const original = process.env.ADMIN_TOTP_SECRET;
  try {
    process.env.ADMIN_TOTP_SECRET = generateSecret();
    assert.equal(twoFactorEnabled(), true);
    process.env.ADMIN_TOTP_SECRET = "not-base32!!";
    assert.equal(twoFactorEnabled(), false);
    process.env.ADMIN_TOTP_SECRET = "   ";
    assert.equal(twoFactorEnabled(), false);
    delete process.env.ADMIN_TOTP_SECRET;
    assert.equal(twoFactorEnabled(), false);
  } finally {
    if (original === undefined) delete process.env.ADMIN_TOTP_SECRET;
    else process.env.ADMIN_TOTP_SECRET = original;
  }
});

test("otpauthUri is scannable and carries the expected parameters", () => {
  const secret = generateSecret();
  const uri = otpauthUri(secret, "admin", "Hope Awards Kenya");
  assert.ok(
    uri.startsWith("otpauth://totp/Hope%20Awards%20Kenya:admin?"),
    `unexpected label form: ${uri}`,
  );
  assert.equal(uri.includes("%3A"), false, "the issuer:account colon stays literal");
  const params = new URLSearchParams(uri.split("?")[1]);
  assert.equal(params.get("secret"), secret);
  assert.equal(params.get("period"), "30");
  assert.equal(params.get("digits"), "6");
  assert.equal(params.get("algorithm"), "SHA1");
});

test("otpauthUri escapes an email-style account but keeps the separator", () => {
  const secret = generateSecret();
  const uri = otpauthUri(secret, "admin@hopeawards.co.ke", "Hope Awards Kenya");
  assert.ok(uri.startsWith("otpauth://totp/Hope%20Awards%20Kenya:admin%40hopeawards.co.ke?"), uri);
  assert.equal(new URLSearchParams(uri.split("?")[1]).get("secret"), secret);
});
