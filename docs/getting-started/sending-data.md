---
sidebar_position: 3
title: Sending data to the dashboard
---

# Sending data to the dashboard

`gpufl-client` always writes telemetry to a local NDJSON file
(via `FileLogSink`). What you choose is **how that data reaches the
dashboard**. There are two paths, and they're complementary —
file logs always work, the upload is what differs.

| You're working in… | Pick |
|---|---|
| Local dev, SSH session, Jupyter notebook | **Direct HTTP** (in-process upload) |
| Production, multi-process workloads, bandwidth-conscious | **Agent daemon** (compressed batches) |
| You don't know yet | **Direct HTTP** — easier to set up; switch later |

The two paths can also coexist: direct-HTTP for live latency, agent
for the durable record. Pick whichever matches your needs and skip
the rest.

## Path 1: Direct HTTP (in-process)

`HttpLogSink` runs a background thread inside your application
process. Every NDJSON line written by `FileLogSink` is also
queued for HTTP `POST` to your backend. Non-blocking; bounded
queue; 3-retry exponential backoff. If the backend is unreachable,
file writes continue and the agent (path 2) can back-fill later.

### Minimal setup

```cpp
#include "gpufl/gpufl.hpp"

int main() {
    gpufl::InitOptions opts;
    opts.app_name = "my_app";

    // Live upload — turn this on to attach HttpLogSink.
    opts.backend_url   = "https://api.gpuflight.com";
    opts.api_key       = std::getenv("GPUFL_API_KEY");
    opts.remote_upload = true;

    gpufl::init(opts);
    // ... your CUDA / HIP work ...
    gpufl::shutdown();
}
```

`backend_url` + `api_key` alone do nothing — you must set
`remote_upload = true` (or the env var below) for the HTTP sink to
attach. This is intentional: it lets you provide credentials for
remote-config fetches without committing to live upload.

### Environment variables

Three env vars get the direct-HTTP path working:

```bash
export GPUFL_BACKEND_URL=https://api.gpuflight.com
export GPUFL_API_KEY=gpfl_xxx
export GPUFL_REMOTE_UPLOAD=1
```

Plus `GPUFL_API_PATH` for reverse-proxy mounts and `GPUFL_CONFIG_NAME`
to pull a named [remote config](#remote-configs). For the complete
list and how env vars interact with programmatic `InitOptions`, see
[Environment variable overrides](../api-reference#env-var-overrides).

### What gets sent

Every NDJSON event you'd normally see in your local log file:
kernel events, memcpy events, scope events, system metrics,
SASS samples, source-correlation data, etc. Each request carries
identification headers so the backend knows which client version
sent it:

```
User-Agent: gpufl/0.1.4
X-GpuFlight-Client-Version: 0.1.4
X-GpuFlight-Wire-Version: 1
Authorization: Bearer gpfl_xxx
```

(The `X-GpuFlight-Client-Version` reflects whatever client release
is installed; the `Wire-Version` is the schema version of the JSON
payloads — bumped only on breaking changes to the columnar format,
still `1` as of `0.1.4`.)

### When this is the right choice

- **Iterative development.** You change code, run, want to see
  results in the dashboard within seconds.
- **Notebooks and SSH sessions.** No daemon to install or keep
  alive — just run your script.
- **You don't have a separate ops team.** One process, one binary.

### Limits

- **Compression is per-event.** HTTP request bodies are small
  (200 B – 2 KB), and `deflate` can't span requests. Effective
  ratio is ~5×. For high-volume continuous monitoring, the agent
  daemon (path 2) compresses 10–15× by batching whole files.
- **No buffering across restarts.** If the backend is down when
  your process exits, queued events that didn't make it into a
  POST are lost (the file NDJSON is not — that survives, and
  the agent can replay it).

## Path 2: `gpufl-agent` (JVM sidecar)

[`gpufl-agent`](https://github.com/gpu-flight/gpufl-agent) is a
separate JVM (Java 25) project that tails the NDJSON files
written by `FileLogSink` and publishes them via HTTP or Kafka,
with optional S3-compatible archiving. It runs once per host
(systemd unit, Docker container, or Kubernetes DaemonSet) and
collects from every `gpufl-client`-instrumented process on
that host.

See the dedicated [gpufl-agent guide](../guides/gpufl-agent) for
deeper architecture (cursors, archiver, log discovery, virtual
threads). This section covers the minimum to get you uploading.

### When this is the right choice

- **Production deployments.** Multiple processes, restarts, host
  reboots — you want delivery durable across all of them. The
  agent maintains a cursor per file so it never re-uploads or
  loses data on restart.
- **Multi-process / containerized workloads.** One agent per node
  collects from every container that mounts the same log
  volume; no per-Pod backend credentials.
- **Kafka pipelines.** The agent has a Kafka publisher built in
  (`--type=kafka` / `GPUFL_PUBLISHER_TYPE=kafka`) for shops that
  fan telemetry through their own pipeline.
- **Long-term archiving.** Optional S3-compatible archiver
  (`GPUFL_ARCHIVER_*` env vars) uploads consumed log files to a
  bucket for compliance/replay before optionally deleting the
  local copy.

### Application side

Your application doesn't change much — just write NDJSON
somewhere the agent can read it. `remote_upload` stays off
(file writes are all the agent needs):

```cpp
gpufl::InitOptions opts;
opts.app_name = "my_app";
opts.log_path = "/var/log/gpuflight/my_app.system.log";
gpufl::init(opts);
```

`FileLogSink` writes three NDJSON channels per session:
`{prefix}.device.log`, `{prefix}.scope.log`, `{prefix}.system.log`.
The agent auto-discovers any `*.{device,scope,system}.log` file
in folders you point it at, so you don't have to enumerate
prefixes — drop your logs in a directory and the agent picks
them up.

### Run the agent — Docker

The published image is the simplest path:

```bash
docker run -d --name gpufl-agent \
  -v /var/log/gpuflight:/var/log/gpuflight \
  -e GPUFL_SOURCE_FOLDERS=/var/log/gpuflight \
  -e GPUFL_PUBLISHER_TYPE=http \
  -e GPUFL_HTTP_URL=https://api.gpuflight.com/api/v1/events/ \
  -e GPUFL_HTTP_TOKEN=$GPUFL_API_KEY \
  ghcr.io/gpu-flight/gpufl-agent:latest
```

`GPUFL_SOURCE_FOLDERS` is a comma-separated list of folders to
auto-discover. The agent scans each for `*.{device,scope,system}.log`
and tails everything it finds.

### Run the agent — JAR (no Docker)

Build the fat JAR with Gradle (Java 25 is required):

```bash
git clone https://github.com/gpu-flight/gpufl-agent
cd gpufl-agent
./gradlew shadowJar
# → build/libs/gpuflight-agent-1.0-SNAPSHOT-all.jar
```

Run it pointed at your log directory:

```bash
java -jar build/libs/gpuflight-agent-1.0-SNAPSHOT-all.jar \
  --folders=/var/log/gpuflight \
  --type=http \
  --url=https://api.gpuflight.com/api/v1/events/ \
  --token=$GPUFL_API_KEY
```

### Environment variables

The agent uses its own `GPUFL_*` namespace — separate from the
client's `InitOptions` env vars. The minimum HTTP setup:

| Variable | Purpose |
|---|---|
| `GPUFL_SOURCE_FOLDERS` | Comma-separated list of log directories to auto-discover. |
| `GPUFL_PUBLISHER_TYPE` | `http` or `kafka`. |
| `GPUFL_HTTP_URL` | Full backend events URL — include the path: `https://api.gpuflight.com/api/v1/events/`. |
| `GPUFL_HTTP_TOKEN` | Bearer token. |

Full reference (cursor file, log-type filter, Kafka, S3 archiver) is
in the [gpufl-agent guide](../guides/gpufl-agent#configuration).

### Run the agent — JSON config file

For more complex setups (multiple sources, archiver enabled,
both HTTP and Kafka), point the agent at a JSON config:

```bash
java -jar gpuflight-agent.jar --config=/etc/gpuflight/agent.json
```

```json title="/etc/gpuflight/agent.json"
{
  "sources": [
    { "folder": "/var/log/gpuflight", "filePrefix": "production_app" }
  ],
  "publisher": {
    "type": "http",
    "endpointUrl": "https://api.gpuflight.com/api/v1/events/",
    "authToken": "gpfl_xxx"
  }
}
```

### How it works

1. Your application writes NDJSON via `FileLogSink` to its
   configured `log_path`.
2. `gpufl-agent` scans `GPUFL_SOURCE_FOLDERS` (or the explicit
   `GPUFL_SOURCE_FOLDER`) on startup, discovering all
   `{prefix}.{device|scope|system}.log` files.
3. For each file, a virtual thread tails it incrementally,
   tracking byte offset in `cursor.json`.
4. New lines are batched and POSTed to `GPUFL_HTTP_URL` (or
   produced to Kafka if `--type=kafka`).
5. On crash or restart, the cursor file lets the agent resume
   exactly where it left off — no duplicates, no gaps.

### Both paths together

You can run both: direct HTTP for live latency, agent for the
durable record. Agent + Kafka pipeline lets you replay or
multiplex telemetry to other systems beyond the GPUFlight
backend (e.g., your own analytics warehouse). The backend
deduplicates by event ID, so concurrent paths are safe.

## Remote configs

When `config_name` is set in `InitOptions` (or via
`GPUFL_CONFIG_NAME`), the client fetches a named profiling
configuration from your backend at startup before applying any
local settings. Useful for changing what your fleet captures
without redeploying:

```cpp
opts.backend_url = "https://api.gpuflight.com";
opts.api_key     = "gpfl_xxx";
opts.config_name = "production";   // → GET /api/v1/config?config=production
gpufl::init(opts);
```

Manage configs in the dashboard at **Settings → Agent Profiles**.
Set defaults like profiling engine, sample rates, what to
capture. Agents pull the config on init; restart your service
to pick up changes.

## Behind a reverse proxy

If your backend isn't mounted at the root, set `api_path` to the
prefix:

```cpp
opts.backend_url = "https://my-corp.example.com";
opts.api_path    = "/profiler/api/v1";
```

The client will POST to `https://my-corp.example.com/profiler/api/v1/events/...`.
Normalization handles trailing/leading slashes; pass whatever's
natural and it'll be cleaned up. Or set `GPUFL_API_PATH` in the
environment.

The default (when `api_path` is empty) is `/api/v1`.
