# PR Summary — Issue #54

## Summary

Closes #54

Adds a root `SECURITY.md` so reporters of a vulnerability in the JSR-published
`@stsoftware/tags` package have a private route instead of a public issue.

- [x] `SECURITY.md` — private reporting via GitHub private vulnerability
      reporting (confirmed enabled on the repo), response times (acknowledgement
      within 3 business days, triage within 10, updates every 14 days),
      supported-versions table (`1.x` ✅, `< 1.0` ❌) and a Mermaid disclosure
      flow.
- [x] `test/SecurityPolicy.ts` — loads the policy from any GitHub-recognised
      location and checks the reporting route, a stated response time and a
      supported row for the major version in `deno.json`, so the table cannot
      drift from the published version.
- [x] `README.md` — short "Security" section linking to the policy.

## Evidence

Docs and test only, so there is no visual surface to screenshot.

- TDD red: `deno test --allow-all test/SecurityPolicy.ts` failed with
  `no security policy at any of: SECURITY.md, .github/SECURITY.md, docs/SECURITY.md`.
- Green: `ok | 6 passed | 0 failed`.
- `./quality.sh`: `ok | 40 passed | 0 failed`, exit 0.
- markdownlint-cli2: 0 issues; cspell: 0 issues.

## Test Plan

- `deno test --allow-all test/SecurityPolicy.ts < /dev/null`
- `./quality.sh < /dev/null`
- After merge, confirm the repo's **Security → Policy** tab shows the policy.
