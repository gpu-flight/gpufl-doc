---
sidebar_position: 99
title: Sending data to the dashboard
---

# Sending data to the dashboard

This is the last Getting Started step: first install GPUFlight, then
capture a local trace or start a monitor, then choose how the local
NDJSON files reach the dashboard.

`gpufl-client` always writes telemetry to local NDJSON files (via
`FileLogSink`). What you choose is **how those files get shipped to
the backend**. The upload paths below share the same on-disk NDJSON
files as source of truth.

The main upload entry points are:

- `gpufl upload <log-dir>` for post-run CLI upload.
- Deferred upload APIs such as `gpufl::uploadLogs()` and
  `gpufl.upload_logs(...)` for applications that call the SDK directly.
- `gpufl monitor --upload` for native foreground telemetry plus live
  agent upload.
- Standalone `gpufl-agent` for deployed log tailing.
- Browser upload from the dashboard when you already have a session
  folder.

The native upload paths can coexist on the same NDJSON files: they
cooperate via the cursor file in the log directory.

:::note Deprecated `remote_upload=True`
The old live HTTP path was removed in v1.1. `remote_upload=True` remains
as a compatibility shim for one release, but new code should use deferred
upload APIs or an agent-based upload path. See
[Remote upload migration](../guides/remote-upload-migration) for exact
replacement snippets.
:::

## Path 1: In-process deferred upload

After your GPU workload finishes and `gpufl::shutdown()` has returned,
call `gpufl::uploadLogs(opts)` (C++) or `gpufl.upload_logs(...)`
(Python) — or just use the orchestrated `gpufl.session()` context
manager that does it for you.

The upload is **never** active during your workload. All network I/O
happens after shutdown, so transient cert errors, TLS failures, and
backend timeouts cannot affect the host process exit code or perceived
performance.

### Python — recommended (`gpufl.session()`)

```python
import gpufl

with gpufl.session(
    app_name="train",
    log_path="/tmp/runs/train",
    backend_url="https://api.gpuflight.com",
    api_key="gpfl_xxxxx",
    continuous_system_sampling=True,
    system_sample_rate_ms=100,
):
    # ... training, inference, whatever ...
    pass
# On __exit__: gpufl.shutdown() then gpufl.upload_logs() — automatically.
```

If you omit `backend_url` or `api_key`, the session stays fully offline
— `shutdown()` runs but no upload is attempted. The NDJSON files
remain on disk for later inspection or upload via the CLI.

### Python — explicit form

For finer control (e.g. you want to inspect the result):

```python
import gpufl

gpufl.init(app_name="train", log_path="/tmp/runs/train", ...)
# ... training ...
gpufl.shutdown()

result = gpufl.upload_logs(
    log_path="/tmp/runs/train",
    backend_url="https://api.gpuflight.com",
    api_key="gpfl_xxxxx",
)
print(f"Uploaded {result.events_uploaded} events "
      f"({result.bytes_uploaded / 1024 / 1024:.1f} MB) "
      f"in {result.elapsed_ms / 1000:.1f}s")
if not result.success:
    for w in result.warnings:
        print(f"  WARN: {w}")
```

### C++

```cpp
#include "gpufl/gpufl.hpp"
#include "gpufl/upload/upload_logs.hpp"

int main() {
    gpufl::InitOptions iopts;
    iopts.app_name    = "train";
    iopts.log_path    = "/tmp/runs/train";
    iopts.backend_url = "https://api.gpuflight.com";
    iopts.api_key     = "gpfl_xxxxx";
    gpufl::init(iopts);

    // ... GPU work ...

    gpufl::shutdown();

    // Upload happens here, post-shutdown. Returns synchronously.
    gpufl::UploadOptions uopts;
    uopts.log_path     = iopts.log_path;
    uopts.backend_url  = iopts.backend_url;
    uopts.api_key      = iopts.api_key;
    const auto result  = gpufl::uploadLogs(uopts);
    if (!result.success) {
        for (const auto& w : result.warnings) {
            std::cerr << "[upload] " << w << "\n";
        }
    }
    return 0;
}
```

### CLI — `gpufl upload`

For post-mortem recovery of a session whose upload failed, or to upload
a previously-offline run after the fact:

```bash
gpufl upload /tmp/runs/train \
    --backend-url=https://api.gpuflight.com \
    --api-key=gpfl_xxxxx
```

Exit codes:

| Exit | Meaning |
|---|---|
| `0` | All events uploaded successfully |
| `1` | Partial success — some warnings (printed to stderr) |
| `2` | Full failure — auth error, missing dir, total timeout, etc. |

Env vars `GPUFL_BACKEND_URL` and `GPUFL_API_KEY` are accepted in place
of the flags.

#### Session selection

A log directory may contain more than one session if the same
`log_path` was reused across runs. Three modes select which:

| Invocation | What gets uploaded |
|---|---|
| `gpufl upload <path>` *(no flags)* | **The latest session only** — finds every `job_start` in the files, picks the one with the highest `ts_ns`, uploads only that. This is the default because the typical workflow is "I just ran a thing, ship it." |
| `gpufl upload <path> --session-id=<uuid>` | Only that session. Errors if not present in any file. |
| `gpufl upload <path> --all-sessions` | Every session in the directory, oldest first. Per-session lifecycle ordering — each session's `job_start → batches → shutdown` block ships intact before the next one starts. |

`--session-id` and `--all-sessions` are mutually exclusive.

#### Refusing accidental re-uploads (`--force`)

The cursor file (`<logdir>/.gpufl-upload-cursor.json`) records which
sessions completed a successful upload. By default:

- **Default / `--session-id` mode**: refuses to re-upload a completed
  session. Exits with code 2 and a message like
  `Session 7f3a... was already uploaded on 2026-05-26T15:30:00Z (1234 events). Pass force=true (CLI: --force) to re-upload.`
- **`--all-sessions` mode**: silently skips completed sessions and
  uploads only the pending ones. Useful for backfilling a half-finished
  upload — re-run and it picks up where it left off.

Pass `--force` to override both behaviors and ship every selected
session regardless of the cursor.

```bash
# Re-upload a session you've already shipped
gpufl upload /tmp/runs/train --session-id=7f3a... --force

# Force re-upload of every session in the directory
gpufl upload /tmp/runs/train --all-sessions --force
```

To force a fully fresh upload from scratch, delete the cursor file
instead of using `--force`:

```bash
rm /tmp/runs/.gpufl-upload-cursor.json
gpufl upload /tmp/runs/train
```

### What gets uploaded

Each session writes into its **own subdirectory** named after the
session id, so reusing the same `log_path` across runs never mixes two
sessions' files. For a session writing to `/tmp/runs/train`, the layout
on disk is:

```
/tmp/runs/train/
  <session_id>/
    device.log          (active, latest events)
    scope.log
    system.log
    device.1.log.gz     (rotated; oldest = highest N)
    device.2.log.gz
    ...
  .gpufl-upload-cursor.json   (shared across sessions in this dir)
```

On shutdown the still-active `*.log` files are gzip-compressed in
place, so a finished session's data ends up fully compressed.

`uploadLogs` walks each session subdirectory, sorts by (channel,
oldest-first within channel), then POSTs the NDJSON events to
`POST {backend_url}/api/v1/events/stream` (chunked, gzip-encoded).
Lifecycle ordering is preserved: `job_start` is sent first (so the
backend creates the session row), then all other events in file order,
then `shutdown` last.

### Cursor file — partial-resume protection

After a successful upload, gpufl writes
`<logdir>/.gpufl-upload-cursor.json` recording which sessions it has
already shipped. Re-running `gpufl upload` skips completed sessions and
picks up any that are still pending.

To force a full re-upload, delete the cursor file.

### Failure handling

`uploadLogs` is designed to **never** throw and **never** affect the
host process exit code:

| Failure | Behavior |
|---|---|
| One POST times out | Retry once (configurable). If still fails, warn and continue. |
| Total timeout (default 5 min) | Stop sending; return `success=false`. Local files untouched. |
| Backend returns 401 / 403 | Stop immediately. Return `success=false`. |
| NDJSON file corrupted / parse error | Skip that line, log a warning, continue. |
| `log_path` directory doesn't exist | Return `success=false`. No exception. |

Inspect `UploadResult.success` and `UploadResult.warnings` to know
what happened.

## Path 2: Live upload with `gpufl-agent`

For a local or SSH workflow where you want always-on GPU/host telemetry
and live dashboard updates, the native launcher can start both the
monitor and the agent:

```bash
export GPUFL_BACKEND_URL=https://api.gpuflight.com
export GPUFL_API_KEY=gpfl_xxxxx

gpufl monitor --name=inference-node --interval=1000 --upload
```

`gpufl monitor` writes telemetry-only logs: GPU utilization, memory,
temperature, power, clocks, CPU, and RAM. It does not attach CUPTI to
another running process and it does not replace `gpufl trace` for
kernel-level profiling.

With `--upload`, the monitor starts `gpufl-agent` as a managed child
process. The agent remains the live uploader: it tails the NDJSON files,
tracks offsets with a cursor file, handles rotation/restart recovery,
and sends compressed stream batches to the backend.

If the agent is not on `PATH`, point the monitor at the fat JAR:

```bash
gpufl monitor --upload \
  --agent-jar=/opt/gpufl-agent/gpufl-agent.jar
```

### Production agent daemon

For production fleets where many GPU nodes write logs continuously,
deploying the standalone `gpufl-agent` JVM service is the recommended
path. It tails NDJSON files on disk, gzips compressed batches
(10-15x smaller than per-event uploads), and uploads on a fixed cadence
regardless of when your workloads start/stop.

This standalone path is documented under
[Docker & Kubernetes](../deployment/docker-kubernetes). The
in-process upload (Path 1) and the agent (Path 2) share the same
cursor-file convention, so they can run concurrently on the same log
directory without sending duplicate data.

## Path 3: Browser upload from the dashboard

When installing gpufl isn't an option — an air-gapped GPU box, a trace
a colleague sent you, or a run you copied off a cluster — upload the
session folder straight from the dashboard. No CLI, no API key: your
browser login is the credential, and the upload speaks the exact same
chunked wire as `gpufl upload`, so everything lands identically.

You need the session folder gpufl wrote on disk (the layout shown in
[What gets uploaded](#what-gets-uploaded)) — either the whole log
directory (one subfolder per session) or a single `<session_id>/`
folder. Rotated `.log.gz` files are read in the browser as-is; nothing
needs unpacking first.

### Step 1 — open the Uploads page

![The Uploads page with the drop zone and the live ingest history](/img/upload/browser-upload-1-page.png)

Open **Uploads** in the left navigation, right under Sessions. The
table below the drop zone is the live ingest history — every chunk you
upload shows up there with its processing status.

### Step 2 — drop your session folder and review the plan

![Two sessions found, one pre-deselected because the cursor file marks it uploaded](/img/upload/browser-upload-2-plan.png)

Drag the folder onto the drop zone (or click **browse…** and pick the
directory). The plan lists every session found, with file count and
total size:

- Sessions the folder's `.gpufl-upload-cursor.json` marks as already
  uploaded are **unchecked by default** — the "already uploaded
  (cursor)" badge. Tick them only if you really want to re-send.
- Sessions the backend already has upload history for get an
  **"already on server"** warning. Uploading them again duplicates
  their events, so only do it deliberately.
- Files that aren't gpufl logs are skipped and listed, never sent.

Click **Upload** when the selection looks right.

### Step 3 — watch it ship

![Per-session progress bar with chunk count, and the first chunks already appearing in the history](/img/upload/browser-upload-3-progress.png)

Files upload in the same order the CLI uses — rotated files
oldest-first, the active log last, `shutdown` events held to the very
end so the backend sees a clean session lifecycle. Each ~5 MB chunk
becomes a history row the moment the backend accepts it. **Cancel**
stops after the current chunk.

### Step 4 — confirm in the history

![Upload finished: sent summary on the session, history rows draining from Received to Done](/img/upload/browser-upload-4-done.png)

When the session shows **sent · N chunks / M events**, everything was
accepted. The rows below drain from *Received* → *Processing* → *Done*
as the ingest worker processes them; a *Failed* row expands on click
with the reason. Once ingested, the session appears under **Sessions**
like any other run.

:::note
- Browser uploads count against your workspace's monthly traffic, the
  same as CLI uploads.
- Chunks are gzipped in the browser via `CompressionStream` — any
  current Chrome / Edge / Firefox 113+ / Safari 16.4+ works.
- Re-uploading a session currently duplicates its events. Trust the
  cursor / already-on-server warnings unless you know what you're doing.
:::
