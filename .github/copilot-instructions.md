<!-- platon-workers:rules:start -->
## Platon Workers

This machine has Platon Workers: headless coding subagents (MCP tools named platon_*) that run on Platon Inference with the user's key. Delegate to them by default when a task matches these classes:

- Broad repository exploration or code search across many files -> platon_explore (read-only).
- Independent code review or a second opinion on a diff -> platon_review (read-only; the environment computes the diff).
- Well-specified mechanical implementation, refactors or test writing -> platon_execute.
- Self-contained analysis of local files or logs -> platon_delegate.

Do NOT delegate: trivial questions, single-file edits you can do faster yourself, tasks needing frequent user interaction, or anything whose spec you cannot write in one message.

How to delegate well:
- Write a complete, self-contained objective: goal, constraints, relevant paths, acceptance criteria. Workers cannot ask the user anything.
- Prefer platon_start + platon_status polling + platon_result for anything over ~2 minutes; keep at most 3 workers running in parallel.
- Reports separate environment facts (changed_files, command_results) from the model's own account (summary, findings, tests, confidence). Verify findings and diffs before relying on them.
- If a report returns status needs_input with a question, answer via platon_answer(task_id, ...) — the worker resumes with full context.
- If a worker fails or times out, retry once with a narrower objective; then do the work locally and note the failure.

Models are routed automatically by role and effort (platon-flash for most work, platon-pro for heavy judgement). Pin with: platon config set code.model <model>.
<!-- platon-workers:rules:end -->
