---
sidebar_position: 8
title: gpufl-agent — log-tailing sidecar
---

# `gpufl-agent`

`gpufl-agent` is a JVM (Java 25) sidecar that tails the NDJSON
log files written by `gpufl-client` and publishes them to your
backend over HTTP — or to Kafka, with optional S3-compatible
archiving. It runs once per host and serves every
`gpufl-client`-instrumented process on that host.

If you've read [Sending data to the dashboard](../getting-started/sending-data),
you know **when** to pick the agent over direct HTTP. This guide
covers **how** — install, configure, and operate.

## When to pick the agent

- Production deployments where you want delivery durable across
  app restarts and host reboots
- Multi-process / containerized workloads where you don't want
  to embed credentials in every Pod
- Kafka-based telemetry pipelines (the agent has a built-in
  Kafka publisher)
- Long-term archival to S3-compatible storage
  (DigitalOcean Spaces, MinIO, Wasabi, AWS S3, etc.)

For local dev, SSH sessions, and Jupyter notebooks, the
in-process [deferred upload](../getting-started/sending-data#path-1-in-process-deferred-upload)
is friction-free and probably what you want.

## Install

The agent is distributed as a Docker image and as a fat JAR.

### Docker (recommended)

```bash
docker pull ghcr.io/gpu-flight/gpufl-agent:latest
```

The published image is built from a multi-stage Dockerfile —
final layer is just `scratch` + the JAR at `/app/gpufl-agent.jar`,
so the image is ~70 MB.

Run it with your config supplied via env vars (see
[Configuration](#configuration) below):

```bash
docker run -d --name gpufl-agent \
  -v /var/log/gpuflight:/var/log/gpuflight \
  -e GPUFL_SOURCE_FOLDERS=/var/log/gpuflight \
  -e GPUFL_PUBLISHER_TYPE=http \
  -e GPUFL_HTTP_HOST=https://api.gpuflight.com \
  -e GPUFL_HTTP_TOKEN=$GPUFL_API_KEY \
  ghcr.io/gpu-flight/gpufl-agent:latest
```

### Java directly (no Docker)

For environments where Docker isn't available — bare-metal
Linux servers, locked-down CI runners, your laptop without
Docker Desktop — run the agent as a plain JVM process.

#### Prerequisites

- **Java 25** runtime. Check with `java --version`. If your
  system Java is older, install Temurin (Eclipse Adoptium)
  or use Gradle's auto-download (it'll fetch a JDK for the
  build, but `java -jar` at runtime needs Java 25 too).

  - macOS: `brew install --cask temurin@25`
  - Ubuntu / Debian: download from [adoptium.net](https://adoptium.net/temurin/releases/?version=25)
  - Windows: download the MSI from adoptium.net

#### Build the fat JAR

```bash
git clone https://github.com/gpu-flight/gpufl-agent
cd gpufl-agent
./gradlew shadowJar
# → build/libs/gpuflight-agent-1.0-SNAPSHOT-all.jar
```

Gradle's toolchain config auto-downloads Java 25 for the build
itself — you don't need a system Java 25 to run `./gradlew`.

#### Run it (foreground)

Quick test — runs in your terminal, Ctrl-C to stop:

```bash
java -jar build/libs/gpuflight-agent-1.0-SNAPSHOT-all.jar \
  --folders=/var/log/gpuflight \
  --type=http \
  --host=https://api.gpuflight.com \
  --token=$GPUFL_API_KEY
```

CLI flags map 1:1 to env vars — every `--flag=value` has a
matching `GPUFL_*` env var (see [Configuration](#configuration)).

#### Install for production (systemd)

For long-running deployments, run the agent under systemd so
it auto-restarts on crash and starts on boot.

```bash
# 1. Copy the JAR to a stable location
sudo mkdir -p /opt/gpufl-agent
sudo cp build/libs/gpuflight-agent-1.0-SNAPSHOT-all.jar \
        /opt/gpufl-agent/gpufl-agent.jar

# 2. Create a service user (no shell, no home)
sudo useradd --system --no-create-home --shell /usr/sbin/nologin gpufl-agent

# 3. Create config + cursor directories
sudo mkdir -p /etc/gpuflight /var/lib/gpufl-agent
sudo chown gpufl-agent:gpufl-agent /var/lib/gpufl-agent

# 4. Drop credentials in a root-only env file
sudo tee /etc/gpuflight/agent.env > /dev/null <<'EOF'
GPUFL_SOURCE_FOLDERS=/var/log/gpuflight
GPUFL_PUBLISHER_TYPE=http
GPUFL_HTTP_HOST=https://api.gpuflight.com
GPUFL_HTTP_API_VERSION=v1
GPUFL_HTTP_TOKEN=gpfl_xxx
GPUFL_CURSOR_FILE=/var/lib/gpufl-agent/cursor.json
EOF
sudo chmod 600 /etc/gpuflight/agent.env
sudo chown gpufl-agent:gpufl-agent /etc/gpuflight/agent.env
```

Then create the systemd unit:

```ini title="/etc/systemd/system/gpufl-agent.service"
[Unit]
Description=GPUFlight log-tailing agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=gpufl-agent
Group=gpufl-agent
EnvironmentFile=/etc/gpuflight/agent.env
ExecStart=/usr/bin/java -jar /opt/gpufl-agent/gpufl-agent.jar
Restart=on-failure
RestartSec=5s

# Hardening — gpufl-agent only needs to read log files and write
# its cursor file. No network filesystem mounts, no privilege.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/gpufl-agent /var/log/gpuflight

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gpufl-agent
sudo systemctl status gpufl-agent
sudo journalctl -u gpufl-agent -f      # tail the agent's own logs
```

The application user (whoever runs `gpufl-client`) needs write
access to `/var/log/gpuflight`; the `gpufl-agent` system user
needs read access. Adjust group ownership accordingly:

```bash
sudo mkdir -p /var/log/gpuflight
sudo chgrp gpufl-agent /var/log/gpuflight
sudo chmod 2770 /var/log/gpuflight     # setgid so new files inherit the group
sudo usermod -a -G gpufl-agent <your-app-user>
```

#### Windows (no Docker, no systemd)

[NSSM](https://nssm.cc/) wraps the JAR as a Windows service:

```powershell
nssm install gpufl-agent ^
  "C:\Program Files\Eclipse Adoptium\jdk-25\bin\java.exe" ^
  "-jar" "C:\opt\gpufl-agent\gpufl-agent.jar"
nssm set gpufl-agent AppEnvironmentExtra ^
  "GPUFL_SOURCE_FOLDERS=C:\ProgramData\gpuflight\logs" ^
  "GPUFL_PUBLISHER_TYPE=http" ^
  "GPUFL_HTTP_HOST=https://api.gpuflight.com" ^
  "GPUFL_HTTP_TOKEN=gpfl_xxx"
nssm start gpufl-agent
```

Or just `java -jar` from a script that runs at startup —
production-grade isolation is what NSSM gives you.

### Verify it's running

The agent prints discovered sources and the active publisher to
stdout on startup:

```
[agent] Publisher: HttpPublisher
[agent] Source: folder=/var/log/gpuflight types=[device, scope, system]
[agent] Discovered session "9f3a1c2e-..." in /var/log/gpuflight
```

If you see `❌ No log sources configured` or `❌ Unknown publisher
type`, you're missing required config — see the next section.

## Configuration

Three ways to configure, in order of precedence:

1. **CLI flags** (`--folder=...`)
2. **Env vars** (`GPUFL_SOURCE_FOLDER=...`)
3. **JSON config file** (`--config=/etc/gpuflight/agent.json`)

CLI flags override env vars; the JSON config replaces all the
above when supplied.

### Sources (required — at least one)

The agent reads the NDJSON files written by `gpufl-client`. Since
v1.2 each run lives in its **own per-session subdirectory**:
`<folder>/<session_id>/<channel>.log[.N.log[.gz]]`, where `<channel>`
is one of `device`, `scope`, or `system`. The agent scans each
watched folder every 2 seconds and auto-discovers session
subdirectories — including ones that start after the agent boots —
so there is no filename prefix to configure.

| Flag / env | Purpose |
|---|---|
| `--folder=PATH` / `GPUFL_SOURCE_FOLDER` | A single watched folder containing session subdirectories. |
| `--folders=P1,P2,...` / `GPUFL_SOURCE_FOLDERS` | Comma-separated list of watched folders. Each is auto-scanned for session subdirectories. |

Use `--folders` when several hosts/apps share a parent log
directory; use `--folder` for a single one.

| Flag / env | Default | Purpose |
|---|---|---|
| `--log-types=A,B,...` / `GPUFL_LOG_TYPES` | `device,scope,system` | Channels to tail. |
| `--cursor-file=PATH` / `GPUFL_CURSOR_FILE` | `./cursor.json` | Where to persist read offsets across restarts. |

:::note Rotated + compressed files
The agent transparently follows rotated channel files
(`<channel>.1.log`, `<channel>.2.log.gz`, …) and the
gzip-compressed terminal file a finished session leaves behind
(`<channel>.log.gz`). It resumes correctly across restarts even
if a file was rotated or compressed while the agent was offline.

Pre-v1.2 flat files (`<prefix>.<channel>.log` at the top level)
are no longer read — the agent warns once per folder and skips
them. Move old logs into session subdirectories or keep a v1.1
agent for them.
:::

### Publisher (required — `http` or `kafka`)

| Flag / env | Required for | Purpose |
|---|---|---|
| `--type=http\|kafka` / `GPUFL_PUBLISHER_TYPE` | both | Pick the publisher. |

#### HTTP publisher

| Flag / env | Default | Purpose |
|---|---|---|
| `--host=URL` / `GPUFL_HTTP_HOST` | (required) | Backend scheme+host, e.g. `https://api.gpuflight.com`. The agent appends `/api/{version}/events/<type>` automatically — do **not** include the path. |
| `--api-version=V` / `GPUFL_HTTP_API_VERSION` | `v1` | Backend API version. Bump when the backend cuts v2 etc. |
| `--token=TOKEN` / `GPUFL_HTTP_TOKEN` | (none) | Bearer token. Sent as `Authorization: Bearer <token>`. |
| `--timeout=SEC` / `GPUFL_HTTP_TIMEOUT_SEC` | `10` | Per-request timeout. |

The HTTP publisher batches lines and POSTs them to
`{host}/api/{version}/events/<type>` with `Content-Type: application/x-ndjson`.

#### Kafka publisher

| Flag / env | Default | Purpose |
|---|---|---|
| `--brokers=HOST:PORT,...` / `GPUFL_KAFKA_BROKERS` | (required) | Bootstrap servers. |
| `--topic-prefix=PREFIX` / `GPUFL_KAFKA_TOPIC_PREFIX` | `gpu-trace` | Topics are `{prefix}-{logtype}` — e.g. `gpu-trace-device`. |
| `--compression=TYPE` / `GPUFL_KAFKA_COMPRESSION` | `snappy` | `none` / `gzip` / `snappy` / `lz4` / `zstd`. |
| `--kafka-linger-ms=MS` / `GPUFL_KAFKA_LINGER_MS` | `100` | Producer batching window. Higher = better throughput, more latency. |

### Archiver (optional — disabled if `--archiver-endpoint` absent)

When configured, the archiver uploads each consumed log file to
S3-compatible storage. Useful for long-term retention or replay.

| Flag / env | Default | Purpose |
|---|---|---|
| `--archiver-endpoint=URL` / `GPUFL_ARCHIVER_ENDPOINT` | — | S3-compatible endpoint. Setting this enables the archiver. |
| `--archiver-bucket=NAME` / `GPUFL_ARCHIVER_BUCKET` | — | Bucket name. |
| `--archiver-region=REGION` / `GPUFL_ARCHIVER_REGION` | — | Region (provider-specific). |
| `--archiver-access-key=KEY` / `GPUFL_ARCHIVER_ACCESS_KEY` | — | Access key. |
| `--archiver-secret-key=KEY` / `GPUFL_ARCHIVER_SECRET_KEY` | — | Secret key. |
| `--archiver-prefix=PATH` / `GPUFL_ARCHIVER_PREFIX` | `raw-events/` | Object key prefix. |
| `--archiver-delete=BOOL` / `GPUFL_ARCHIVER_DELETE` | `false` | Delete local file after successful upload. |

### JSON config file

For complex setups or version-controlled configuration:

```bash
java -jar gpufl-agent.jar --config=/etc/gpuflight/agent.json
```

```json title="/etc/gpuflight/agent.json"
{
  "sources": [
    { "folder": "/var/log/gpuflight" },
    { "folder": "/opt/myapp/logs" }
  ],
  "publisher": {
    "type": "http",
    "hostUrl": "https://api.gpuflight.com",
    "apiVersion": "v1",
    "authToken": "gpfl_xxx"
  },
  "archiver": {
    "endpoint":  "https://nyc3.digitaloceanspaces.com",
    "bucket":    "gpuflight-prod-logs",
    "region":    "nyc3",
    "accessKey": "DO00...",
    "secretKey": "...",
    "prefix":    "raw-events/",
    "delete":    true
  }
}
```

## How it works

```
gpufl-client (your app)               gpufl-agent (sidecar)         backend
─────────────────────────             ──────────────────────        ──────────
writes NDJSON to            ───►      Tails <session_id>/{device,
/var/log/gpuflight/                   scope,system}.log via virtual
  <session_id>/                       threads, one per channel
                                          │
                                          │  batches lines
                                          ▼
                                      HttpPublisher              ─► POST /api/v1/events/
                                      (or KafkaPublisher)        ─► topic: gpu-trace-device

                                      Archiver (optional)         ─► PUT s3://bucket/raw-events/...
                                          │
                                          ▼ (after successful upload)
                                      cursor.json updated
```

Key properties:

- **One virtual thread per source × type.** Java 25's virtual
  threads keep the per-file resource cost near zero, so the
  agent can tail dozens of log files without OS-thread bloat.
- **Cursor-based incremental reads.** `cursor.json` records, per
  `(session_id, channel)` stream, the rotated-file index, byte
  offset, and a content signature of the file. On restart the
  agent re-locates each file by that signature and resumes from
  the recorded offset — no duplicates, no gaps, even if a file
  was rotated or compressed while the agent was down.
- **Per-channel publishing.** Each NDJSON channel
  (`device` / `scope` / `system`) is handled independently. A
  slow Kafka topic doesn't block the others.
- **Device-metric deduplication.** A built-in deduplicator on
  the `system` channel collapses repeated identical
  `device_metric_batch` events (common when GPU utilization is
  steady), reducing publisher volume.
- **Archiver runs after consumption.** A consumed log file is
  enqueued to the archiver only after the publisher has
  acknowledged its lines, so you never archive partial data.

## Operational notes

### Restarting the agent

The cursor file makes restarts safe — the agent resumes exactly
where it stopped. Bind-mount `cursor.json` to a persistent volume
(see the
[Kubernetes DaemonSet example](../deployment/docker-kubernetes#daemonset-gpufl-agent--sidecar-based-upload))
so it survives container recreation.

### Log rotation

`gpufl-client` owns rotation: the active `<channel>.log` rolls to
`<channel>.1.log` (optionally `.gz`), and on shutdown the active
file is compressed in place to `<channel>.log.gz`. The agent
detects these transitions automatically — it follows the rotated
index forward and reads gzip-compressed files transparently,
carrying the byte offset across the switch. You don't configure
anything; just point the agent at the parent folder.

### Multiple agents

Don't run two agents tailing the same folder with the same
cursor file — they'll race on the cursor and you'll see
duplicates. If you need redundancy, point each agent at its own
cursor file path.

### Failure modes

| Failure | Behavior |
|---|---|
| Backend HTTP returns 5xx | Lines are kept in the in-memory batch and retried on the next publish cycle. Cursor is **not** advanced. |
| Backend HTTP returns 4xx (auth) | Logged loudly. Cursor is **not** advanced; the failure repeats until you fix auth. |
| Kafka broker unreachable | KafkaProducer's internal buffer fills; if it overflows, lines are dropped (Kafka producer semantics). |
| Disk fills | `FileLogSink` (the application side) handles its own rotation. The agent just keeps reading whatever's on disk. |
| Agent crashes mid-line | Cursor only advances after a complete line is published. Worst case: re-publish one line on restart. The backend de-duplicates by event ID. |

## Source

[github.com/gpu-flight/gpufl-agent](https://github.com/gpu-flight/gpufl-agent) —
issues and PRs welcome. Java 25, Gradle, no external runtime
dependencies (uses HttpClient and Apache Kafka client).

## Related

- [Sending data to the dashboard](../getting-started/sending-data) —
  agent vs. direct HTTP decision.
- [Docker & Kubernetes](../deployment/docker-kubernetes) —
  full DaemonSet example.
- [Sync attribution](sync-attribution) — the differentiating
  feature that needs telemetry to be uploaded for the dashboard
  to surface it.
