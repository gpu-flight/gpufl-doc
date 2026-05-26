# Docker & Kubernetes

Deploy GPUFlight in containerized workloads using environment
variables to configure live upload, profiling engine, and
remote configs — no code changes after your application's
initial `gpufl::init()`.

:::info Assumes your app calls `gpufl::init()`
The environment variables on this page configure an application
that already includes `gpufl-client` and calls `gpufl::init()` at
startup. They override `InitOptions` fields without a rebuild. If
you're integrating from scratch, see the
[Installation](../getting-started/installation) and
[Sending data](../getting-started/sending-data) guides first.
:::

## Environment Variables

In containers, `gpufl::init()` reads its config from `GPUFL_*` env
vars. For live upload, three are required:

| Variable | Purpose |
|----------|---------|
| `GPUFL_BACKEND_URL` | Backend host (e.g. `https://api.gpuflight.com`). Host-only. |
| `GPUFL_API_KEY` | Bearer token. |
| `GPUFL_REMOTE_UPLOAD` | Set to `1` to attach `HttpLogSink`. |

Common optional vars: `GPUFL_API_PATH` (reverse-proxy mounts),
`GPUFL_CONFIG_NAME` (remote-config fetch), `GPUFL_PROFILING_ENGINE`
(override engine). Full list and precedence rules:
[Environment variable overrides](../api-reference#env-var-overrides).

## Docker

:::tip Reference Dockerfile
A working example Dockerfile based on the NVIDIA CUDA devel image
(builds `gpufl` from source so NVML is linked correctly, runs
JupyterLab) lives in the client repo at
[`example/python/docker/Dockerfile`](https://github.com/gpu-flight/gpufl-client/blob/main/example/python/docker/Dockerfile).
It pins to a tagged client release and passes the CMake flags
(`-DNVML_LIBRARY=…`, `-DCUDAToolkit_ROOT=/usr/local/cuda`) needed
for reliable NVML detection inside `pip`'s isolated build env.
:::

### Basic Usage — direct HTTP upload

```bash
docker run --gpus all \
  -e GPUFL_BACKEND_URL=https://api.gpuflight.com \
  -e GPUFL_API_KEY=gpfl_xxxxx \
  -e GPUFL_REMOTE_UPLOAD=1 \
  my-training-image:latest
```

### Docker Compose

```yaml
services:
  training:
    image: my-training-image:latest
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    environment:
      - GPUFL_BACKEND_URL=https://api.gpuflight.com
      - GPUFL_API_KEY=gpfl_xxxxx
      - GPUFL_REMOTE_UPLOAD=1
```

### Toggling upload on / off

Flip `GPUFL_REMOTE_UPLOAD` to control whether telemetry leaves the
container. File logs (NDJSON) are always written either way:

```yaml
environment:
  - GPUFL_REMOTE_UPLOAD=0   # File logs only; no live upload
```

## Kubernetes

### Single Pod (direct HTTP upload)

The simplest pattern: each instrumented Pod uploads telemetry
directly via `HttpLogSink`. Good for development clusters and
small deployments.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-training
spec:
  containers:
    - name: training
      image: my-training-image:latest
      env:
        - name: GPUFL_BACKEND_URL
          value: "https://api.gpuflight.com"
        - name: GPUFL_REMOTE_UPLOAD
          value: "1"
        - name: GPUFL_API_KEY
          valueFrom:
            secretKeyRef:
              name: gpuflight-secret
              key: api-key
      resources:
        limits:
          nvidia.com/gpu: 1
```

### Store API Key as a Secret

```bash
kubectl create secret generic gpuflight-secret \
  --from-literal=api-key=gpfl_xxxxx
```

### DaemonSet (`gpufl-agent` — sidecar-based upload)

Run [`gpufl-agent`](https://github.com/gpu-flight/gpufl-agent)
once per GPU node. It's a JVM (Java 25) sidecar that tails
NDJSON files written by every instrumented Pod on the node and
publishes them via HTTP or Kafka. When using the agent, **do
not** set `GPUFL_REMOTE_UPLOAD` on the application Pods — leave
that off so they only write file logs, and let the agent handle
delivery.

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: gpufl-agent
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: gpufl-agent
  template:
    metadata:
      labels:
        app: gpufl-agent
    spec:
      nodeSelector:
        nvidia.com/gpu.present: "true"
      containers:
        - name: agent
          image: ghcr.io/gpu-flight/gpufl-agent:latest
          env:
            - name: GPUFL_SOURCE_FOLDERS
              value: "/var/log/gpuflight"
            - name: GPUFL_PUBLISHER_TYPE
              value: "http"
            - name: GPUFL_HTTP_HOST
              value: "https://api.gpuflight.com"
            - name: GPUFL_HTTP_API_VERSION   # defaults to v1; bump for future versions
              value: "v1"
            - name: GPUFL_HTTP_TOKEN
              valueFrom:
                secretKeyRef:
                  name: gpuflight-secret
                  key: api-key
            - name: GPUFL_CURSOR_FILE
              value: "/var/lib/gpufl-agent/cursor.json"
          volumeMounts:
            - name: gpufl-logs
              mountPath: /var/log/gpuflight
            - name: gpufl-cursor
              mountPath: /var/lib/gpufl-agent
          resources:
            limits:
              nvidia.com/gpu: 0   # Agent doesn't need a GPU device.
      volumes:
        - name: gpufl-logs
          hostPath:
            # Application Pods on this node mount the same hostPath as
            # their NDJSON log destination. The agent picks up new
            # content from any Pod that writes here.
            path: /var/log/gpuflight
            type: DirectoryOrCreate
        - name: gpufl-cursor
          hostPath:
            # Persisted across agent restarts so we resume tailing at
            # the right byte offset and never re-upload events.
            path: /var/lib/gpufl-agent
            type: DirectoryOrCreate
```

Then on every application Pod, mount the same `hostPath` and
point `gpufl::InitOptions::log_path` into it (e.g.
`/var/log/gpuflight/${HOSTNAME}.system.log`). Don't set
`GPUFL_REMOTE_UPLOAD` — file writes are all the agent needs.

### Which pattern to pick

- **Single Pod / direct HTTP**: simpler. Each Pod authenticates
  itself, no sidecar. Best for small clusters, dev environments.
- **DaemonSet / `gpufl-agent`**: durable delivery via persisted
  cursor file (no duplicate or lost events on restart), single
  egress point per node, one secret to rotate per cluster
  instead of per Pod, optional Kafka pipeline. Best for
  production at scale.

See [Sending data to the dashboard](../getting-started/sending-data)
and the [gpufl-agent guide](../guides/gpufl-agent) for the full
mental model.

### Helm Chart

A Helm chart for one-line deployment is on the roadmap. Follow
the [GitHub repository](https://github.com/gpu-flight/gpufl-client)
for updates. Until then, the YAML above is canonical.

## Framework-Agnostic

GPUFlight works at the CUDA driver level, so it's compatible with **any GPU framework** without framework-specific plugins:

- PyTorch
- TensorFlow
- JAX
- RAPIDS
- Custom CUDA/HIP kernels
- Any application that uses NVIDIA CUDA or AMD ROCm

No `import gpuflight` in your Python code. No framework integrations to configure. Just set the environment variable and GPUFlight observes all GPU activity automatically.

## Overhead

GPUFlight's **Continuous mode** is designed for always-on deployment. **Deep mode** is the opposite, intended for one-off kernel investigation during development and never enabled fleet-wide.

| Mode | Enum value | Typical overhead |
|------|-----------|-----------------|
| Monitoring only | `None` | Minimal |
| **Continuous** (production-safe) | `PcSampling` | Low; safe to run 24/7 |
| Range | `RangeProfiler` | Moderate, per scope |
| **Deep** (development only) | `PcSamplingWithSass` | **Significant kernel slowdown while the scope is active** |

The Deep-mode slowdown is intrinsic to SASS-level instrumentation. The same physics applies to any tool that collects per-instruction execution counts, including NVIDIA Nsight Compute (which addresses it with kernel replay, paying the cost as additional passes instead of slower passes). Use Deep mode for the specific kernel you are investigating, not for production fleet observability.

Actual numbers vary by hardware generation, driver version, kernel characteristics, and sampling configuration. Benchmark your own workload before committing to a deployment mode.

## What's Next

- [Scope Profiling Guide](../guides/scope-profiling) - Add optional code annotations for deeper insight
- [CUDA Integration Guide](../guides/cuda-integration) - NVIDIA-specific profiling engines and SASS disassembly
- [AMD Integration Guide](../guides/amd-integration) - AMD ROCm and HIP support
