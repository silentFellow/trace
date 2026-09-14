# Known Local Test Failures

Tracks `just test` / `go test ./...` failures observed on this local dev setup
(macOS + podman machine, mise-pinned Go 1.27.0) that are environment-specific,
not product bugs, and were deliberately left unfixed rather than chased down
immediately. Re-check these whenever CI passes but a local run doesn't.

## 1. TestContainers can't create a network on podman

**Symptom:** almost every `store/test` case that boots a real database via
TestContainers (MySQL, PostgreSQL, and the SQLite upgrade tests that launch a
previous-version Memos container) fails with:

```text
failed to create test network: reaper: new reaper: run container: container
create: unable to find network with name or ID bridge: network not found
```

**Root cause:** TestContainers' default network setup assumes a `bridge`
network exists the way Docker Desktop provides one. This podman machine
doesn't have an equivalent default network, so every container-backed test
cascades into "container failed to start in a previous test" failures.

**Affected tests:** effectively all of `store/test` for the `mysql` and
`postgres` drivers, plus `TestUpgradeFromPreviousStableRenamesShortcutsToMemoViews`,
`TestMigrationFromStableVersion`, and `TestMigrationFromV0262PreservesLegacyData`
on `sqlite` (these three boot a real container regardless of driver).

**Fix direction (not done):** either configure podman with a `bridge`-named
network TestContainers can find, or set `DOCKER_HOST`/Ryuk/network env vars
TestContainers respects for podman. Needs a machine-specific investigation,
not a code change.

## 2. `TestEntrypointDoesNotLoopWhenTargetUIDIsRoot` — signal: killed

**Symptom:** `scripts/entrypoint_test.go` fails with `signal: killed`.

**Root cause:** unconfirmed; likely the same container/process-management gap
as #1, or a resource limit in this podman machine's VM. Needs reproduction
with more logging before it's clear whether it's a real regression.

## 3. `TestDetectAttachmentMimeType/unknown_extension_falls_back_to_content_sniffing`

**Symptom:** `server/api/v1/attachment_mime_test.go` expects a PNG-sniff
fallback to yield `image/png`, gets `chemical/x-xyz` instead.

**Root cause:** unconfirmed; looks like a Go version or OS mime-registration
difference in this environment's content-sniffing path rather than an actual
detection bug, but hasn't been root-caused.

## Not affected

Pure in-memory Go tests (no TestContainers, no entrypoint script) pass:
`store`, `store/cache`, `store/db/{sqlite,mysql,postgres}` unit tests,
`internal/...`, and the SQLite-only `store/test` cases that don't spin a
container all pass under `just test-store` / `just test-internal`.
