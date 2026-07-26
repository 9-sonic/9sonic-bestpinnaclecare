# MCP setup (Linear, Notion, GitHub) — self-serve

**MCP is not installed by cloning this repo.**  
Each developer configures MCP on **their machine** inside an MCP-capable client (Claude Desktop, Claude Code, Cursor, Grok, etc.).

| You get from clone | You configure yourself |
|--------------------|------------------------|
| `.claude/` skills + CLAUDE.md | Linear / Notion / GitHub MCP in your client |
| Process docs | Tokens / OAuth — never commit them |

Team key is **`BES`** (not BPC).

---

## 1. What MCP is for

| Use | Do not use for |
|-----|----------------|
| Search Linear issues, draft comments | Silent merge to `main` |
| Read/write GitHub PRs/issues (with care) | Inventing client policy |
| Fetch Notion specs / ADRs | Dumping whole workspace secrets |
| Faster context while coding | Replacing human review |

Skills under `.claude/skills/` still apply whether or not MCP is connected.

---

## 2. Prerequisites

1. Access: GitHub Write on `9-sonic/9sonic-bestpinnaclecare`, Linear team **Best Pinnacle**, Notion Engineering Hub (when invited).  
2. MCP client installed and signed in.  
3. Node.js ≥ 18 if your client uses `npx` servers.  
4. Password manager for tokens — **never** put keys in the monorepo.

---

## 3. Linear MCP (P0)

**Create key:** [Linear → Settings → API](https://linear.app/settings/api) → personal API key (workspace with BES).

### Example — Claude Desktop / many `npx` clients

Config file location depends on OS (e.g. Claude Desktop `claude_desktop_config.json`). Merge into `mcpServers`:

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-linear"],
      "env": {
        "LINEAR_API_KEY": "<your-linear-api-key>"
      }
    }
  }
}
```

**Some clients (e.g. Grok, newer Claude)** use **HTTP + OAuth** for Linear instead of `npx`. Prefer the client’s built-in “Add Linear MCP” / OAuth flow when available — same outcome: tools can list/update **BES** issues.

**Verify:** “List open issues on team Best Pinnacle” or “Show BES-5”.

---

## 4. Notion MCP (P1)

**Option A — Official / client OAuth (preferred when offered):**  
Add Notion MCP in the client UI and complete OAuth. Share Engineering Hub pages with the integration if prompted.

**Option B — Integration secret + `npx`:**

1. Create integration: https://www.notion.so/my-integrations  
2. Share **Start here**, **Join and go**, ADR log, env log (not the whole company) with the integration.  
3. Config:

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-notion"],
      "env": {
        "NOTION_API_KEY": "<your-notion-integration-secret>"
      }
    }
  }
}
```

**Verify:** “Find Engineering Hub Start here and summarize the dual-board rule.”

---

## 5. GitHub MCP (P0 for coding with AI)

**Token:** Fine-grained PAT limited to `9-sonic/9sonic-bestpinnaclecare`  
Permissions: Contents R, Metadata R, Pull requests R/W, Issues R/W (as needed).

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-pat>"
      }
    }
  }
}
```

**Verify:** “List open PRs on 9-sonic/9sonic-bestpinnaclecare.”

---

## 6. Combined example

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-linear"],
      "env": { "LINEAR_API_KEY": "<linear>" }
    },
    "notion": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-notion"],
      "env": { "NOTION_API_KEY": "<notion>" }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<github-pat>" }
    }
  }
}
```

Restart the client after editing config.

---

## 7. What still works without MCP

1. Clone + open repo → Claude/Cursor loads **`.claude/`**.  
2. Use Linear + GitHub in the browser.  
3. Open PRs; Fireworks still reviews.  

MCP is acceleration, not a gate.

---

## 8. Safety

- Draft → human confirm for issue creates/status moves.  
- Never paste production secrets into chat.  
- Do not grant MCP tokens org-wide admin if least privilege is enough.  
- Figma MCP is **later** (deferred).

See also: [join-and-go.md](./join-and-go.md), [dual-board.md](./dual-board.md), Notion *Claude Vibe Coding Playbook*.
