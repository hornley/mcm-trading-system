# Contributing to MCM Trading System

## Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd <project-name>

# Check current branches
git branch -a
```

## Workflow

### 1. Start a New Task

Make sure `main` is up to date before creating a new branch.

```bash
git checkout main
git pull origin main
git checkout -b feature/<feature-name>
git push origin -u feature/<feature-name>
```

**Branch naming convention:**
- `feature/<feature-name>` — new features
- `fix/<issue-name>` — bug fixes
- `docs/<topic>` — documentation updates

**Examples:**
```bash
git checkout -b feature/auth-ui
git checkout -b feature/dashboard-layout
git checkout -b fix/login-validation
git checkout -b docs/contribution-guide
```

### 2. Make Changes

```bash
# Check what files have changed
git status

# Stage files
git add .                  # stage all changes
git add <file-name>        # stage specific file

# Commit changes
git commit -m "feat: add login page"
```

### 3. Open a Pull Request on GitHub

1. Go to the repository
2. Click **"Compare & pull request"**
3. Verify: base `main` ← compare `feature/<name>`
4. Add a clear PR title and description
5. Click **"Create Pull Request"**

### 4. After Your PR is Merged

```bash
git checkout main
git pull origin main
git branch -d feature/<name>            # delete local branch
git push origin --delete feature/<name>  # delete remote branch
```

## Contribution Guidelines

### Rules

1. **Never code directly on `main`**

   Always create a feature branch for any changes.

2. **One branch = one task**

   Keep each branch focused on a single feature or fix.

   ```
   feature/auth-ui          ✓
   feature/dashboard-layout ✓
   fix/navbar-bug           ✓

   frontend                 ✗
   backend                  ✗
   authUI-forever           ✗
   ```

3. **Delete branches after merging**

   Branches are temporary workspaces. Clean up after yourself.

4. **Branch from a fresh `main`**

   Always pull the latest before creating a new branch.

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/new-task
   ```

### Commit Message Format

Prefix your commits with a type:

```
feat:     new feature
fix:      bug fix
docs:     documentation change
refactor: code refactoring (no feature or bug change)
style:    formatting, missing semicolons, etc.
chore:    maintenance tasks (deps, config, etc.)
```

**Examples:**
```
feat: add authentication UI screens
fix: resolve login validation error
docs: update contribution guide
refactor: simplify sidebar component
```

### PR Description Tips

List what changed and why:

```
## Summary
- Added landing page
- Added login and register pages
- Set up auth routing

## Testing
- Verified login flow works
- Tested register with duplicate email
```

## Project Workflow Loop

```
main
  ↓
pull latest
  ↓
create feature branch
  ↓
make code changes
  ↓
git add + commit + push
  ↓
open pull request
  ↓
merge into main
  ↓
checkout main + pull latest
  ↓
delete old branch
  ↓
repeat
```

## Useful Commands

| Command | Description |
|---|---|
| `git status` | Check changed files |
| `git branch` | Check current branch |
| `git log --oneline` | View commit history |
| `git restore .` | Discard unstaged changes |
| `git reset HEAD .` | Unstage staged changes |
| `git reset --hard HEAD` | Hard reset everything |

## Emergency

Discard unstaged changes:
```bash
git restore .
```

Unstage all staged changes:
```bash
git reset HEAD .
```

Hard reset (destroy all local changes):
```bash
git reset --hard HEAD
```