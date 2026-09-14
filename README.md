> ✨ This is a fork of [usememos/memos](https://github.com/usememos/memos).

# Trace

<img src="./web/public/logo.webp" alt="" width="96" align="right">

**Fast enough for every thought. Private enough for all of them.**

Trace is an open-source, self-hosted home for short-form thinking. Daily notes, links, work logs, and snippets flow into a chronological Markdown timeline—on infrastructure you control, without the overhead of an all-in-one workspace.

**[Run with Docker](#quick-start)**

<!-- TODO(rebrand): no Trace-branded docs site exists yet. Add one, then restore a "Read the docs" link here. See docs/rebranding-todo.md. -->

[![GitHub stars](https://img.shields.io/github/stars/silentFellow/trace?style=flat-square&logo=github&label=Stars)](https://github.com/silentFellow/trace)
[![Latest release](https://img.shields.io/github/v/release/silentFellow/trace?style=flat-square&label=Release)](https://github.com/silentFellow/trace/releases)
[![Docker pulls](https://img.shields.io/docker/pulls/silentfellow/trace?style=flat-square&logo=docker)](https://hub.docker.com/r/silentfellow/trace)
[![MIT license](https://img.shields.io/github/license/silentFellow/trace?style=flat-square)](LICENSE)

<!-- TODO(rebrand): the upstream demo screenshot was removed since it shows Memos, not Trace. Add a real Trace screenshot here. See docs/rebranding-todo.md. -->

## Why Trace?

- **Capture quickly** — Write in Markdown, attach media, and save without choosing a title, folder, or template.
- **Organize lightly** — Revisit notes through the timeline, search, tags, and pins.
- **Share selectively** — Keep memos private or publish only what you choose.
- **Keep control** — Self-host Trace with [MIT-licensed source](LICENSE).

## Quick Start

Run Trace with Docker:

```bash
docker run -d \
  --name trace \
  -p 5230:5230 \
  -v ~/.trace:/var/opt/memos \
  silentfellow/trace:stable
```

## Get Help

Found a bug or have a question? [Open an issue](https://github.com/silentFellow/trace/issues).
