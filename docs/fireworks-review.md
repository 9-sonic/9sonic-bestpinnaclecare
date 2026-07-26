# Fireworks AI PR review (quality lane)

Primary automated review when Copilot quota fails.

| Role | Default model | Override var |
|------|---------------|--------------|
| **Primary** (quality) | `accounts/fireworks/models/kimi-k2p7-code` | `FIREWORKS_MODEL` |
| **Fallback** (if primary times out / 5xx / empty) | `accounts/fireworks/models/qwen3p7-plus` | `FIREWORKS_FALLBACK_MODEL` |

Each model is tried up to **2 times** with backoff. Explicit connect timeout (~55s).

| Outcome | Check result |
|---------|----------------|
| Transient failures only (timeout / 5xx / network) after all models | Skip notice + **soft-fail** (green — does not block merge) |
| Config failures only (400 / 401 / 403 / 404) | Skip notice + **hard-fail** (red — fix key or model id) |

## Goal

Give the PM a **merge-oriented** review that:

1. Understands the **request** (PR title/body + linked GitHub issues + `BES-*` ids).  
2. Checks **goal fit** (acceptance criteria vs diff).  
3. Separates **Blocking** / **Should fix** / **Nits**.  
4. Ends with a clear **Verdict for PM**.

## What the model receives

| Input | Source |
|-------|--------|
| PR title, description, labels, author, branch | GitHub event |
| Linked issues (`Closes #n` / `Fixes #n`) | Fetched issue title + body (truncated) |
| `BES-n` ids | Parsed from title/body (not fetched from Linear API) |
| Diff | `gh pr diff`, with lockfiles/binary noise stripped, then length-capped |

## Required author habits (improves review quality)

1. Fill the PR template (goal + scope).  
2. Link work: `Closes #12` and/or `BES-12` in title/body.  
3. Keep PRs focused (large diffs are truncated).  
4. Put acceptance criteria on the **GitHub issue** body when possible.

Without a linked issue, the model only has the PR description — still useful, but weaker on “goal fit.”

## Config

| Secret / var | Purpose |
|--------------|---------|
| `FIREWORKS_API_KEY` | Required |
| `FIREWORKS_MODEL` | Optional primary model path |
| `FIREWORKS_FALLBACK_MODEL` | Optional fallback when primary fails |
| `FIREWORKS_MAX_DIFF_CHARS` | Optional (default `32000`) |

Workflow: `.github/workflows/fireworks-pr-review.yml`

## Verdict meanings

| Verdict | PM action |
|---------|-----------|
| **Ready to merge** | Checks green + human OK → merge |
| **Merge after fixes** | Author addresses Blocking (and ideally Should fix) |
| **Needs human specialist** | Domain risk — assign FE/BE lead |
| **Do not merge** | Serious security/data/process risk |

## Not a substitute for

- Specialist craft review on hard subsystems (offline engine, payroll math)  
- Template gate / CI / secret scan  
- Your merge judgment  

See also: [faq-pr-reviews.md](./faq-pr-reviews.md), [join-and-go.md](./join-and-go.md).

<!-- fireworks smoke 2026-07-26T12:01:03Z -->
