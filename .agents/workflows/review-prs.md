---
description: Analyze open Pull Requests from the project's GitHub repository, generate a critical report, and optionally implement approved changes
---

# /review-prs — PR Review & Analysis Workflow

## Overview

This workflow fetches all open PRs from the project's GitHub repository, performs a critical analysis of each one, generates a detailed report, and waits for user approval before proceeding with implementation. **All improvements are committed on the current release branch** (`release/vX.Y.Z`).

> **BRANCH RULE**: All work MUST happen on the current `release/vX.Y.Z` branch. Never create separate feature or fix branches. If no release branch exists yet, create one first using `/generate-release` Phase 1 steps 1–5.

## Steps

### 1. Identify the GitHub Repository

- Read `package.json` to get the repository URL, or use the git remote origin URL
  // turbo
- Run: `git -C <project_root> remote get-url origin` to extract the owner/repo

### 2. Ensure Release Branch Exists

// turbo

Before doing any work, ensure you are on the current release branch:

```bash
# Check current branch
git branch --show-current

# If on main, determine next version and create the release branch
VERSION=$(node -p "require('./package.json').version")
# Bump patch: e.g. 3.3.11 → 3.3.12
NEXT=$(node -p "const [a,b,c]=('$VERSION').split('.').map(Number); c>=9?a+'.'+(b+1)+'.0':a+'.'+b+'.'+(c+1)")
git checkout -b release/v$NEXT
npm version patch --no-git-tag-version
npm install
```

If already on a `release/vX.Y.Z` branch, continue working there.

### 3. Fetch Open Pull Requests

// turbo-all

**⚠️ CRITICAL**: The JSON output of `gh pr list` can be truncated by the tool, silently hiding PRs. You MUST use the two-step approach below to guarantee **all** PRs are fetched.

**Step 3a — Get PR numbers only** (small output, never truncated):

- Run: `gh pr list --repo <owner>/<repo> --state open --limit 500 --json number --jq '.[].number'`
- This outputs one PR number per line. Count them and confirm total.

**Step 3b — Fetch full metadata for each PR** (one call per PR):

- For each PR number from step 3a, run:
  `gh pr view <NUMBER> --repo <owner>/<repo> --json number,title,author,headRefName,body,createdAt,additions,deletions,files`
- You may batch these into parallel calls (up to 4 at a time).

**Step 3c — Fetch diffs for each PR** (one call per PR, saved to /tmp):

- For each PR number, run:
  `gh pr diff <NUMBER> --repo <owner>/<repo> > /tmp/pr<NUMBER>.diff`
- Then read each diff file with `view_file`.

- For each open PR, collect:
  - PR number, title, author, branch, number of commits, date
  - PR description/body
  - Files changed (diff)
  - Existing review comments (from bots or humans)

**Verification**: Confirm the count of PRs analyzed matches the count from step 3a before proceeding.

### 4. Analyze Each PR — For each open PR, perform the following analysis:

#### 4a. Feature Assessment

- **Does it make sense?** Evaluate if the feature fills a real gap or solves a valid problem
- **Alignment** — Check if it aligns with the project's architecture and roadmap
- **Complexity** — Assess if the scope is reasonable or if it should be split

#### 4b. Code Quality Review

- Check for code duplication
- Evaluate error handling patterns (consistent with existing codebase?)
- Check naming conventions and code style
- Verify TypeScript types (any `any` usage, missing types?)

#### 4c. Security Review

- Check for missing authentication/authorization on new endpoints
- Check for injection vulnerabilities (URL params, SQL, XSS)
- Verify input validation on all user-controlled data
- Check for hardcoded secrets or credentials

#### 4d. Architecture Review

- Does the change follow existing patterns?
- Are there any breaking changes to public APIs?
- Is the database schema affected? Migration needed?
- Impact on performance (N+1 queries, missing indexes?)

#### 4e. Test Coverage

- Does the PR include tests?
- Are edge cases covered?
- Would existing tests break?

#### 4f. Cross-Layer (Global) Analysis

Perform a **global impact assessment** to verify whether the PR changes are complete across all layers of the application:

- **Backend → Frontend check**: If the PR adds or modifies backend-only resources (new endpoints, services, data models), evaluate whether corresponding frontend changes are missing:
  - Does a new endpoint require a new screen/page in the dashboard?
  - Should there be a new action button, menu item, or navigation link?
  - Are there new data fields that should be displayed or editable in the UI?
  - Does a new feature need a toggle, configuration panel, or status indicator?
- **Frontend → Backend check**: If the PR adds frontend elements, verify the backend support exists:
  - Are the required API endpoints implemented?
  - Is the data model sufficient for the new UI components?
- **Cross-cutting concerns**: Check shared layers (types, DTOs, validation schemas, routes, middleware) for completeness
- **Document gaps** — If missing layers are detected, list them as **IMPORTANT** issues in the report with concrete suggestions for what should be added

### 5. Generate Report — Create a markdown report for each PR including:

- **PR Summary** — What it does, files affected, commit count
- **Improvements/Benefits** — Numbered list with impact level (HIGH/MEDIUM/LOW)
- **Risks & Issues** — Categorized as CRITICAL / IMPORTANT / MINOR
- **Scoring Table** — Rate across: Feature Relevance, Code Quality, Security, Robustness, Tests
- **Verdict** — Ready to merge? With mandatory vs optional fixes
- **Next Steps** — What will happen if approved

### 6. Present to User

- Show the report via `notify_user` with `BlockedOnUser: true`
- Wait for user decision:
  - **Approved** → Proceed to step 7
  - **Approved with changes** → Implement the fixes and corrections before merging
  - **Rejected** → Close the PR or leave a review comment

### 7. Pre-Merge Fixes & CI Green-Lighting (if approved)

> **⚠️ Fixes should be pushed back to the PR branch before merging.** We want the PR itself to be green and fully valid before it integrates.

- **Sync latest fixes:** Merge `main` or the current `release` branch into the PR branch so the PR inherits any latest CI or integration test fixes (preventing false-positive failures).
- **Implement improvements:** Apply the required fixes identified in the analysis directly on the PR branch (e.g., adding missing API routes, fixing SSRF, applying comments from other agents).
- **Pushing changes to PR branches:**

  ```bash
  # Checkout the PR locally
  gh pr checkout <NUMBER>

  # Apply fixes, commit your changes
  git commit -m "chore: apply review suggestions and missing layers"

  # Attempt to push directly to the PR branch
  git push
  ```

- **Fallback (For external forks without maintainer edit access):**
  If `git push` fails because the PR comes from an external fork without write access, you MUST:
  1. Create a new branch ending in `-fix` (e.g., `checkout -b fix-pr-<NUMBER>`).
  2. Push your branch to the main repo (`git push origin fix-pr-<NUMBER>`).
  3. Create a Pull Request targeting the contributor's repository and branch (use `gh pr create --repo <contributor-repo> --base <contributor-branch> --head linhnguyen-gt:fix-pr-<NUMBER>`).
  4. Once they accept our PR into their branch, their original PR to our `main` will automatically update and become green.

- Run the project's test suite locally to verify nothing breaks:
  // turbo
- Run: `npm test` or equivalent test command

### 8. Merge & Integrate

- Once the PR is green (you can check with `gh pr status`), proceed to merge the PR into the current release branch (`release/vX.Y.Z`).

  ```bash
  gh pr merge <NUMBER> --repo <owner>/<repo>
  ```

- Post a **thank-you comment** on the PR via the GitHub API
- The message should:
  - Thank the author by name/username for their contribution
  - Briefly mention what the PR accomplishes and any improvements applied
  - Note it will be included in the upcoming release
  - Be friendly, professional, and encouraging
- Example: _"Thanks @author for this great contribution! 🎉 The [feature/fix] has been integrated into the release/vX.Y.Z branch and will be part of the next release. We appreciate your effort!"_

### 9. Close the Original PR

- Close the original PR with a comment explaining it was integrated into the release branch:
  ```bash
  gh pr close <NUMBER> --repo <owner>/<repo> --comment "Integrated into release/vX.Y.Z. Will be released as part of v3.X.Y. Thank you!"
  ```

### 10. Continue or Finalize

After processing all approved PRs:

- If more PRs remain, go back to step 7
- When all PRs are processed, **update CHANGELOG.md** on the release branch with all new entries
- Run `/generate-release` workflow Phase 1 steps 7–10 (tests → commit → push → open PR to main → wait for user)
