# FAQ — “I pushed but don’t see a PR / review”

This matches what we saw in practice on **private** `9sonic-bestpinnaclecare` (PM vs developer experience).

## Short answer

| What you did | What you see | Why |
|--------------|--------------|-----|
| Pushed a **branch** only | No PR, no Fireworks, no Copilot | Reviews run on **pull requests**, not bare branch pushes |
| Pushed **straight to `main`** | Code on main, no PR review UI | Skips the whole PR path (we saw this on test commits) |
| Opened a **PR** | Checks on the PR + Conversation comments | This is the intended path |
| Opened a PR but **Reviews** tab empty | Might still have Fireworks on **Conversation** | Fireworks used to be comment-only; Copilot often fails on free/quota plans |

**Rule:** `branch push ≠ delivery`. Always **Compare & open pull request** into `main`.

---

## Why it “worked for PM but not for me”

1. **PM usually opens PRs** from branches that already include workflows on `main` after merge. Your work is real; the review rail only attaches to a PR.
2. **Copilot review is not guaranteed** for every collaborator/plan. The Action often posts: *“Assign Copilot manually”* or *“quota limit”*. That is not “Fireworks broken.”
3. **Fireworks *did* run on developer PRs** (e.g. PR #30 by Asmadeous) — look under **Conversation** for `### Fireworks AI code review` from `github-actions[bot]`. It did **not** always appear under the formal **Reviews** tab (fixed to also post a formal review going forward).
4. **Template gate red** does not mean reviews didn’t run. If the PR body lacks `Closes #N` or `Process-only: true`, **Template gate** fails while Fireworks may still pass.
5. **Repo transfer / wrong remote** — work must land on `9-sonic/9sonic-bestpinnaclecare`, not an old personal fork URL.

---

## What developers should check (2 minutes)

1. Open https://github.com/9-sonic/9sonic-bestpinnaclecare/pulls — is **your** PR listed?
2. If not: GitHub → your branch → **Compare & pull request**.
3. On the PR:
   - **Checks** tab → `Fireworks review`, `Request Copilot`, `Template gate`, `CI summary`
   - **Conversation** → sticky Fireworks comment
   - **Files changed** / **Reviews** → formal review entries (after the workflow fix)
4. If Template gate is red: fix description (`Closes #n` or `Process-only: true`) and push again.
5. Never: `git push origin main` for feature work.

---

## What PM should check when someone says “no review”

1. Did they open a **PR** or only push a branch / main?
2. Actions → workflow **Fireworks AI Code Review** for that PR number — green?
3. Secret `FIREWORKS_API_KEY` still set (org/repo Actions secrets)?
4. Collaborator has **Write** on the private repo?
5. Point them at Conversation + Checks, not only Copilot under Reviews.

---

## Related

- [join-and-go.md](./join-and-go.md) — first PR path  
- [CONTRIBUTING.md](../CONTRIBUTING.md) — ship path  
- Issue lesson: direct main push never gets PR reviews (process test around #26 / main-push-guard)
