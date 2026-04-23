---
name: sync-upstream
description: Sync fork with upstream pcvelz/ccstatusline-usage using the reset-main + rebase-feat-branches + cherry-pick workflow. Use when upstream has new commits or when the user asks to "sync with upstream".
---

# Sync with upstream (pcvelz/ccstatusline-usage)

This fork's model:
- `main` is always derivable — it equals `upstream/main` + cherry-picked feat-branch commits, in logical order. No merge commits.
- Each `feat/*` branch is based on `upstream/main` and contains only its own feature commits.
- When upstream advances: reset main to upstream, rebase feat branches onto new upstream, then rebuild main by cherry-picking.

## When to use
- User says "sync with upstream", "pull upstream changes", or similar.
- `git log main..upstream/main` shows new commits after `git fetch upstream`.

## Prerequisites
- Remote `upstream` points to `https://github.com/pcvelz/ccstatusline-usage`. Verify: `git remote -v`.
- Working tree clean. If not, stop and ask the user.
- Know which local feat branches have unmerged-upstream work that should survive. Usually: inspect `git branch` and ask.

## Workflow

### 1. Fetch
```
git fetch upstream
git fetch origin
```

### 2. Inspect what's new
```
git log --oneline main..upstream/main
```
If empty, nothing to sync. Otherwise, note the new upstream commits.

### 3. Reset main to upstream/main
**Destructive — requires user confirmation.** This discards whatever main currently has.
```
git checkout main
git reset --hard upstream/main
```
Safety-net hooks will likely block this. Ask the user to run it manually if so.

### 4. For each feat branch to preserve
Identify branches that need to follow the new upstream:
```
git branch --list 'feat/*'
```

For each one:
```
git checkout feat/<name>
git log --oneline upstream/main..HEAD   # see how many commits need replaying
```

If the branch was previously based on old main (with fork-specific commits), use `--onto` to replay only the feat commits on top of upstream/main:
```
git rebase --onto upstream/main <old-base-commit>
```
where `<old-base-commit>` is the commit just before the feat branch's own work started. You can find it with `git log --oneline` — the first non-feat commit is the base.

If the branch is already based directly on upstream (no fork-specific commits in its history), a plain rebase works:
```
git rebase upstream/main
```

Resolve conflicts as they appear. After each conflict:
```
git add <resolved-files>
git rebase --continue
```

### 5. Cherry-pick feat commits onto main
Think about logical order first. Foundational commits go first (e.g., a widget's showPercent toggle before a feature that depends on that toggle). Branches that build on each other should be picked in dependency order.

If one feat branch already chains on top of another (like `feat/off-hours-configuration` chaining on the weekly-pace work), you can cherry-pick the whole downstream branch and it will cover both:
```
git checkout main
git cherry-pick upstream/main..feat/<chained-branch>
```

Otherwise, pick in explicit order:
```
git cherry-pick <sha1> <sha2> <sha3>
```

Resolve conflicts per-commit. After each:
```
git add <resolved-files>
git cherry-pick --continue
```

### 6. Verify
```
bun test <feat-specific test paths>
```
Run at minimum the tests that cover the cherry-picked features. A full `bun test` on Windows will show platform-specific failures (macOS keychain, path quoting) that are pre-existing — don't treat them as regressions.

### 7. Publish
**Requires user confirmation.** Force-push is required because both main and feat branches were history-rewritten:
```
git push --force-with-lease origin main
git push --force-with-lease origin feat/<name>
```

Use `--force-with-lease` (not `--force`) — it refuses if someone else pushed to the remote since your last fetch.

## Notes and gotchas

- **Never merge upstream into main.** Always reset. The fork's identity is "upstream + cherry-picks" — merge commits contaminate that.
- **Release tags (v2.3.x) survive the main reset.** They're refs pointing at specific SHAs; resetting main's branch pointer doesn't touch them. They'll just become unreachable from main — that's fine.
- **Duplicate-patch detection on rebase.** If a feat branch includes work that upstream also shipped, git's patch-id matching usually drops the duplicate cleanly. If not, `git rebase --skip` for the redundant commit.
- **Chained feat branches.** If branch B is based on branch A, rebase A first, then rebase B onto A's new tip (not onto upstream/main directly) so B keeps its relationship to A. Then cherry-pick B onto main (which also covers A's commits).
- **Settings schema conflicts.** `src/types/Settings.ts` is the most common conflict site because upstream and fork both modify it. Resolution is usually mechanical — keep both additions, drop whatever upstream removed.
