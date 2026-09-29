// Verifies the repository publishes a security policy GitHub recognises, with a
// private reporting route, a stated response time and a supported-versions
// table that tracks the published major version. Tracked in issue #54.
import { assert, assertEquals } from "@std/assert";

const POLICY_PATHS = ["SECURITY.md", ".github/SECURITY.md", "docs/SECURITY.md"];
const PRIVATE_ROUTE = /\/security\/advisories\/new\b|mailto:[^\s)]+@/;
const RESPONSE_TIME = /\bwithin\s+\d+\s+(?:business\s+)?(?:hours?|days?)\b/i;
const SUPPORTED_ROW = /^\|\s*(\d+)\.x\s*\|[^\n]*(?:✅|\byes\b)/gim;

/** Requirements a security policy text is missing; empty when compliant. */
export function securityPolicyGaps(text: string, major: number): string[] {
  const gaps: string[] = [];
  if (!PRIVATE_ROUTE.test(text)) gaps.push("private reporting route");
  if (!RESPONSE_TIME.test(text)) gaps.push("response time");
  const supportedMajors = Array.from(
    text.matchAll(SUPPORTED_ROW),
    (match) => Number(match[1]),
  );
  if (!supportedMajors.includes(major)) {
    gaps.push(`supported-versions row for ${major}.x`);
  }
  return gaps;
}

async function readPolicy(): Promise<string> {
  for (const path of POLICY_PATHS) {
    try {
      return await Deno.readTextFile(path);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  throw new Error(`no security policy at any of: ${POLICY_PATHS.join(", ")}`);
}

async function publishedMajor(): Promise<number> {
  const { version } = JSON.parse(await Deno.readTextFile("deno.json"));
  const major = Number.parseInt(String(version).split(".")[0], 10);
  assert(Number.isInteger(major), `invalid deno.json version: ${version}`);
  return major;
}

const COMPLIANT = `
Report privately via https://github.com/o/r/security/advisories/new.
We acknowledge reports within 3 business days.

| Version | Supported |
| ------- | --------- |
| 2.x     | ✅        |
| < 2.0   | ❌        |
`;

Deno.test("securityPolicyGaps - accepts a compliant policy", () => {
  assertEquals(securityPolicyGaps(COMPLIANT, 2), []);
});

Deno.test("securityPolicyGaps - accepts an email reporting route", () => {
  const text = COMPLIANT.replace(
    "https://github.com/o/r/security/advisories/new",
    "[email](mailto:security@example.com)",
  );
  assertEquals(securityPolicyGaps(text, 2), []);
});

Deno.test("securityPolicyGaps - reports every missing requirement", () => {
  assertEquals(securityPolicyGaps("# Security\n\nOpen an issue.\n", 1), [
    "private reporting route",
    "response time",
    "supported-versions row for 1.x",
  ]);
});

Deno.test("securityPolicyGaps - flags a stale supported major", () => {
  assertEquals(securityPolicyGaps(COMPLIANT, 3), [
    "supported-versions row for 3.x",
  ]);
});

Deno.test("securityPolicyGaps - an unsupported row does not count", () => {
  const text = COMPLIANT.replace("| 2.x     | ✅ ", "| 2.x     | ❌ ");
  assertEquals(securityPolicyGaps(text, 2), [
    "supported-versions row for 2.x",
  ]);
});

Deno.test("SECURITY.md - meets the disclosure policy requirements", async () => {
  assertEquals(
    securityPolicyGaps(await readPolicy(), await publishedMajor()),
    [],
  );
});
