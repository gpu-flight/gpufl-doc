---
sidebar_position: 3
title: Sending data to the dashboard
---

# Sending data to the dashboard

`gpufl-client` always writes telemetry to local NDJSON files (via
`FileLogSink`). What you choose is **how those files get shipped to
the backend**. There are two paths, and they share the same on-disk
NDJSON files as source of truth.

| You're working in… | Pick |
|---|---|
| Local dev, SSH session, Jupyter notebook, one-off CI runs | **In-process deferred upload** (this page) |
| Production, multi-process workloads, fleet of nodes | **`gpufl-agent`** (separate JVM service that tails NDJSON) |
| You don't know yet | **In-process deferred upload** — one library, no extra processes |

Both paths can coexist on the same NDJSON files — they cooperate via
the cursor file in the log directory.

:::note Live streaming was removed
Previous releases shipped an `HttpLogSink` that POSTed every NDJSON
line live during a session. That mechanism was retired because (a)
network errors during the session could affect the host workload's
exit code, (b) per-event HTTP added measurable jitter to PyTorch
training runs, and (c) the deferred path post-shutdown is functionally
equivalent for every use case we shipped. Customers who set
`remote_upload=True` from Python continue to work for one release via
an `atexit` shim that calls the new upload at interpreter exit.
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
    --backend-url https://api.gpuflight.com \
    --api-key gpfl_xxxxx
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
| `gpufl upload <path> --session-id <uuid>` | Only that session. Errors if not present in any file. |
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
gpufl upload /tmp/runs/train --session-id 7f3a... --force

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

For a session writing to `/tmp/runs/train`, the file layout on disk is:

```
/tmp/runs/train.device.log         (active, latest events)
/tmp/runs/train.scope.log
/tmp/runs/train.system.log
/tmp/runs/train.device.1.log.gz    (rotated; oldest = highest N)
/tmp/runs/train.device.2.log.gz
...
```

`uploadLogs` discovers all of these, sorts by (channel, oldest-first
within channel), then POSTs each NDJSON event to
`POST {backend_url}/api/v1/events/{eventType}`. Lifecycle ordering is
preserved: `job_start` is sent first (so the backend creates the
session row), then all other events in file order, then `shutdown`
last.

### Cursor file — partial-resume protection

After a successful upload, gpufl writes
`<logdir>/.gpufl-upload-cursor.json` listing every rotated file it
shipped. Re-running `gpufl upload` skips those files but always
re-uploads the active `.log` (which may have been appended to between
calls).

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

## Path 2: Agent daemon (`gpufl-agent`)

For production fleets where many GPU nodes write logs continuously,
deploying the standalone `gpufl-agent` JVM service is the
recommended path. It tails NDJSON files on disk, gzips compressed
batches (10–15× smaller than per-event uploads), and uploads on a
fixed cadence regardless of when your workloads start/stop.

This path is documented under
[Docker & Kubernetes](../deployment/docker-kubernetes). The
in-process upload (Path 1) and the agent (Path 2) share the same
cursor-file convention, so they can run concurrently on the same log
directory without sending duplicate data.

## When to use which

- **In-process deferred upload (Path 1)** — single-process workloads,
  dev / notebook / CI runs, anywhere you don't want a separate daemon.
  Recommended default.
- **Agent daemon (Path 2)** — multi-host fleets, long-running
  production services, ML training clusters where you want a uniform
  upload path independent of your workload's lifecycle.

You can switch between them — the on-disk NDJSON files are the source
of truth, so a run started under Path 1 can be re-uploaded by Path 2
later (or vice versa).

## Migration from `remote_upload=True`

Customers who previously enabled live streaming with
`remote_upload=True` (Python) or `opts.remote_upload = true` (C++)
should migrate to one of the deferred forms above.

### Python — one release of grace

```python
# Old (deprecated, but still works for one release):
gpufl.init(app_name="x", backend_url="...", api_key="...",
           remote_upload=True)
# ... work ...
gpufl.shutdown()
# (atexit handler runs upload_logs at interpreter exit)
```

You'll see a `DeprecationWarning` on `init()` and an `atexit`-scheduled
`upload_logs()` will run when the interpreter exits. To remove the
warning and gain explicit control over when upload happens, switch to:

```python
# New, recommended:
with gpufl.session(app_name="x", backend_url="...", api_key="..."):
    # ... work ...
# Upload runs at __exit__, explicitly.
```

### C++ — hard rename

`opts.remote_upload = true` no longer attaches an HTTP sink at the C++
level (it's a no-op for one release, then removed). Update C++ code to:

```cpp
gpufl::shutdown();

gpufl::UploadOptions uopts;
uopts.log_path    = opts.log_path;
uopts.backend_url = opts.backend_url;
uopts.api_key     = opts.api_key;
gpufl::uploadLogs(uopts);
```

The `backend_url` / `api_key` fields on `InitOptions` stay — they're
the canonical place to store the credentials and `uploadLogs` can
read them back if you wire it up that way.
