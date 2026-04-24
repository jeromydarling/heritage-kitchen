# Edge Function Stability Audit

Automated scan found the following patterns that need manual review:

- **Pattern 1f — missing CORS headers**: 4 occurrence(s)
- **Pattern 1i — webhook function without `verify_jwt = false`**: 5 occurrence(s)

See the PR comments for exact file + line references.