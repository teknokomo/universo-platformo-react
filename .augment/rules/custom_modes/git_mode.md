---
type: 'agent_requested'
description: 'If user message starts with GIT'
---

When the user writes **GIT**, you switch to **GIT mode**.  
This mode automates committing changes, creating GitHub issues and opening pull requests to deliver the completed work.  
Continue following your **base prompt**, and augment with the instructions below.

**Steps to Follow:**

1. Begin with **"OK GIT"** to confirm GIT mode.
2. **Create a GitHub Issue**: Summarize the work completed and write a new GitHub issue describing the changes, following our issue format guidelines (see `.augment/rules/github-issues.md`). Include a concise title and a detailed description of what was done and why.
3. **Post the Issue on Upstream**: Using the GitHub API or IDE’s integrated GitHub tools, create this issue in the **Upstream repository** (the main repo). If the current working repo is a fork and the agent lacks permission on the upstream, then create the issue in the fork instead.
4. **Commit Changes with Issue Reference**: Prepare a git commit containing all the final changes. Begin the commit message with the issue number (for example, `#123 `) followed by a brief summary of the changes. Ensure the commit message clearly references the issue (e.g., “#123 Add feature X and refactor Y”).
5. **Push to Repository**: Push the commit to the appropriate repository. If working on a fork, push to a branch on the fork (since you may not have direct push access to the upstream). If working directly in a repository where you have push rights, you can push to a new branch on that repository.
6. **Open a Pull Request**: Using the GitHub API or tools, open a PR from the new branch to the upstream repository’s main branch. In the PR title, include the issue number in the format `GH123 ` (to reference the issue). In the PR description, include `Fix #123 ` at the beginning to link the issue (so it will close automatically upon merging) and then copy or summarize the issue description in the PR body (explaining what was done).
7. **Automation and Tools**: Leverage the IDE’s capabilities to automate these steps. For example, use any provided functions or commands to create issues, commit, push, and open PRs. (If using VS Code/Cursor with Augment, assume you have tools or commands like cursor.git.commit, cursor.git.push, or GitHub API calls available.) Ensure you have a valid GitHub access token configured and that your Git user name/email and remotes (origin, upstream) are set correctly in the environment.
8. **Error Handling**: If any step fails (e.g., lack of permissions to create an upstream issue), handle it gracefully: fall back to posting the issue or PR in the fork, or provide a clear error message. By default, if working with a fork, always create a PR to upstream rather than pushing directly to upstream’s main branch (unless explicitly instructed otherwise).

_Goal: This mode should fully automate final code delivery to GitHub, creating all necessary tracking artifacts (issue, commit, PR) with minimal human intervention._
