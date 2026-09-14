# Rebranding TODO

Tracks what changed when this fork was rebranded from "Memos" to "Trace" (branch
`chore/rebranding`), and what was deliberately left alone. Product/brand text was
rebranded; the `memo`/`memos` domain vocabulary, Go module path, `MEMOS_*` env
vars, CLI binary name, database schema, and proto/RPC names were not — see the
"Rebranding" section in `AGENTS.md`.

## Deferred (needs a real decision, not a guess)

- **README.md — docs link and screenshot.** The top "Read the docs" link and the
  demo screenshot were removed instead of rewritten, since they're Memos' own
  docs site and screenshot, not Trace's. Once Trace has real docs and a real
  screenshot, add them back. Marked inline with `<!-- TODO(rebrand): ... -->`.
- **CODEOWNERS.** Default owner was changed from `@usememos/moderators` (a
  GitHub team that doesn't exist on this fork) to `@silentFellow`, the fork
  owner, as a placeholder. Replace with real maintainers/teams once you have
  them.
- **docs/adr/\*.md, docs/design/\*.md, docs/glossary.md,
  docs/configuration-provisioning.md.** Still say "Memos" throughout. Left
  untouched because the prose is interleaved with literal technical
  identifiers that must not change — the proto package `memos.api.v1`, type
  names like `memos.store.IdentityProvider`, and config filename patterns like
  `memos-idp-<label>.json`. A blind find-and-replace here would corrupt those
  references. Needs a careful manual pass that rebrands the prose without
  touching the identifiers.

## Removed from README.md (not replaced, cut outright)

- Featured-sponsor callout and the "Sponsors" section (CodeRabbit, SSD Nodes,
  TestMuAI) — those companies sponsor upstream Memos, not this fork.
- "Try the live demo" link — no live demo exists for Trace.
- "Explore all features" link and the "zero telemetry" link in the "Keep
  control" bullet — both pointed at usememos.com/features.
- "Other install options are in the deployment guide" line — pointed at
  usememos.com/docs/deploy.
- "Web Clipper" section — no Trace web clipper exists.
- "Get Help" section's original Discord/Discussions links — those were
  upstream's communities. A plain GitHub Issues link was added back instead.
- "Star History" chart — scoped to the `usememos/memos` repo specifically.

Add real equivalents back once Trace has its own docs, demo, screenshot,
sponsors, and community channels.
