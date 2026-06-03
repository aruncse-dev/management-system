# PR prep

Prepare a pull request per `ai/skills/git-workflow.md` (main is PR-only).

1. Confirm branch is not `main`; create `feat/<slug>` or `fix/<slug>` from updated `main` if needed.
2. Run `pnpm prepush`.
3. Review `git status` and `git diff`; stage only relevant files (never `.env` or secrets).
4. Commit with format: `feat(scope): short description` or `fix(scope): ...`
5. Push: `git push -u origin HEAD`
6. Create PR with `gh pr create` — include Summary and Test plan checklists.

Do not push directly to `main`. Do not commit unless the user asked.

If the user wants merge + release after PR, use `/release` after merge.
