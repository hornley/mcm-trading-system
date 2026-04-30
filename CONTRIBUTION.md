git commands
git status - check if any changes have been made
git add (. - to add all changes || (insert file name) - to add a change done from one file)
git commit - records changes that were added with git add to a snapshot
	git commit - m "(insert message)"
git push - pushes changes made from the commit to the remote repo
git branch <branch_name> - makes a new branch
git branch - checks which branch you are in
git push origin <branch_name> - pushes the branch to a remote repo (github) to access it online
git checkout <branch_name> - change accessed branch to the one named
git checkout -b <branch_name> - makes and accesses a new branch
git merge <branch_name> - merges the changes made into the branch to the root
git branch -d <branch_name> - deletes the named branch


========================================
INITIAL SETUP
========================================

Clone repository:
git clone <repository-url>

Go into project folder:
cd <project-name>

Check current branches:
git branch -a


========================================
STARTING A NEW TASK / FEATURE
========================================

1. Make sure main is updated

git checkout main
git pull origin main

2. Create a new feature branch from main

git checkout -b feature/<feature-name>

Examples:
git checkout -b feature/auth-ui
git checkout -b feature/dashboard-layout
git checkout -b fix/login-validation


========================================
WORKING ON FEATURE
========================================

1. Check changed files

git status

2. Stage files

git add .

(or specific files)
git add src/App.jsx

3. Commit changes

git commit -m "Add authentication UI screens"

4. Push branch to remote

git push origin feature/auth-ui


========================================
OPENING A PULL REQUEST
========================================

On GitHub:

1. Go to repository
2. Click "Compare & pull request"
3. Verify:

base: main
compare: feature/auth-ui

4. Add PR title

Example:
Add authentication UI screens

5. Add PR description

- Added landing page
- Added login page
- Added register page
- Added auth routing

6. Click "Create Pull Request"


========================================
AFTER PULL REQUEST IS MERGED
========================================

1. Return to main

git checkout main

2. Pull latest merged changes

git pull origin main

3. Delete old local branch

git branch -d feature/auth-ui

4. Delete remote branch (optional if not auto-deleted)

git push origin --delete feature/auth-ui


========================================
START NEXT TASK
========================================

1. Create new branch from updated main

git checkout -b feature/<next-feature>

Example:
git checkout -b feature/owner-dashboard


========================================
FULL PROJECT LOOP
========================================

main
↓
pull latest
↓
create feature branch
↓
code changes
↓
git add
↓
git commit
↓
git push
↓
open pull request
↓
merge into main
↓
checkout main
↓
pull latest
↓
delete old branch
↓
create next feature branch


========================================
IMPORTANT RULES
========================================

1. Never code directly on main

BAD:
git checkout main
(code here)

2. One branch = one task

GOOD:
feature/auth-ui
feature/dashboard-layout
fix/navbar-bug

BAD:
frontend
backend
authUI forever

3. Delete branches after merge

Branches are temporary workspaces.

4. Always branch from updated main

git checkout main
git pull origin main
git checkout -b feature/new-task


========================================
USEFUL COMMANDS
========================================

Check branch:
git branch

Check status:
git status

View commit history:
git log --oneline

Switch branches:
git checkout <branch-name>

Pull latest:
git pull origin main

Push branch:
git push origin <branch-name>

Delete branch:
git branch -d <branch-name>


========================================
EMERGENCY: DISCARD LOCAL CHANGES
========================================

Discard unstaged changes:
git restore .

Discard staged changes:
git reset HEAD .

Hard reset everything:
git reset --hard HEAD