# Skill: Secrets and git history

**Purpose:** Keep credentials out of the repo, and keep the response to a leak
proportionate — so that fixing a secret never costs the team its shared history.

**Use when:** Gitleaks fails, a `.env` or key appears in a diff, someone proposes
rewriting history, or you are about to add configuration that holds a credential.

---

## 1. Never commit a credential

- `.env`, `.env.*`, `config/master.key`, `config/*.key` are gitignored, and the
  **Repo hygiene** CI job fails if one is committed anyway. Do not "temporarily"
  commit one.
- Real values live in **GitHub Actions secrets** (Settings → Secrets and
  variables → Actions) and reach a workflow through `env:`:

  ```yaml
  steps:
    - name: Do the thing
      env:
        API_TOKEN: ${{ secrets.API_TOKEN }}
      run: ./script-that-reads-API_TOKEN
  ```

  Read them in Rails from `ENV.fetch("API_TOKEN")` or encrypted credentials —
  never a literal in a committed file.
- `secrets` is **not** available in `if:` conditions. Guard inside the step
  (`if [ -z "${TOKEN:-}" ]; then … fi`), as the Slack workflows do.
- Never interpolate `${{ github.event.* }}` into a `run:` block. Titles and
  branch names are attacker-controlled; pass them via `env:` and read the
  variable. The same habit keeps secrets out of shell history and logs.
- **Framework generators emit secret-shaped defaults** (Devise's
  `config.secret_key`, Rails' `secret_key_base` samples). Delete them when you
  generate, before the first commit — that single commented line is why this
  repo's secret scan went red.

---

## 2. When Gitleaks fails — verify before you react

Gitleaks reports **per commit**, and CI scans full history (`fetch-depth: 0`).
So one line introduced once, then squash-merged, is reported **twice**. Two
findings do not mean two credentials.

Work through this in order:

1. **Read the finding.** File, line, commit, rule. `gh run view --job <id> --log`
2. **Is it real?** Check whether the value was ever *active*, not just present:

   ```bash
   # every commit that touched it
   git log --all --oneline -S"config.secret_key" -- path/to/file
   # was it ever uncommented / actually used?
   git show <sha>:path/to/file | grep -E "^\s*config\.secret_key"
   grep -rn "THE_CONSTANT_NAME" app config lib   # is anything reading it?
   ```
3. **If it is real:** rotate it at the source **first** (the provider console).
   Rotation is what makes the credential worthless; scrubbing the file only
   hides it. Then remove it from HEAD in a normal commit.
4. **If it is a verified false positive** (a generator default, a test fixture,
   an example value): add a **targeted** allowlist entry to `.gitleaks.toml` —
   scoped to the specific commit SHAs, not to a file path or a broad regex, so a
   genuine secret in a new commit anywhere in the tree still fails.

State which of 3 or 4 applies, and why, in the PR. "Probably fine" is not a
verification.

---

## 3. Do not rewrite shared history

`git filter-repo` / `filter-branch` + `git push --force` is **not** the default
remedy, and on this repo it is almost always the wrong one:

- It rewrites every commit SHA from the touched point forward. Every clone
  breaks; every open PR needs rebasing; anything referencing an old SHA — the
  `.gitleaks.toml` allowlist included — silently stops matching.
- `--path <file> --invert-paths` removes the **entire file** from all history,
  not the offending line. Deleting `config/initializers/devise.rb` to remove one
  commented line is a much larger change than it looks.
- **The secret is already exposed.** Anyone who cloned or forked still has it,
  and GitHub keeps unreachable objects. Rewriting history does not un-leak
  anything — **only rotation does.**
- This repo has already been damaged once by force merges. Do not reach for the
  same class of tool to tidy up.

If history genuinely must be rewritten (a live production credential, and
rotation alone is judged insufficient), that is **Jesse's and Gichogu's call**,
announced to the whole team beforehand, with every open PR accounted for. Never
propose it as a routine fix, and never run it unprompted.

---

## 4. Quick reference

| Situation | Do |
| --- | --- |
| Live credential committed | Rotate at source → remove from HEAD in a normal commit → note it in the PR |
| Generator default / fixture / example | Targeted `.gitleaks.toml` allowlist by commit SHA + a comment saying why it is inert |
| Same finding reported twice | Check the commit SHAs — a squash and its original are two commits, one secret |
| Someone proposes `filter-repo` + force push | Push back with §3; escalate to Jesse/Gichogu if it is genuinely warranted |
| New config needs a credential | Actions secret → `env:` → `ENV.fetch` |

Related: [[pr-and-review]] for the "no secrets committed" reviewer check,
`docs/slack-setup.md` for how the Slack webhooks are stored.
