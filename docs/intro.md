---
sidebar_position: 1
---

# Introduction

**GPUFlight** is a GPU profiler and monitoring system that scales with your kernel from development to production. Built on CUPTI (NVIDIA) and rocprofiler-sdk (AMD), it captures kernel telemetry, SASS-level instruction analysis, and system metrics, all streamed to a cloud dashboard.

Two engines anchor the workflow:

- **`Deep`** for development. Per-instruction SASS metrics, memory coalescing analysis, divergence analysis, full source correlation. Use it when you are writing or tuning a specific kernel.
- **`PcSampling`** for production. Low-overhead stall-reason sampling, safe to leave on across a fleet 24/7. Use it for always-on observability, regression detection, and long-tail outlier hunting.

The engine is a deployment-time switch, not a different tool. The same SDK, same scopes, same dashboard, same data model work on both sides. Set `GPUFL_PROFILING_ENGINE=PcSampling` in your production environment and the same binary that ran `Deep` locally drops to PC sampling on the fleet. No rebuild. (And `Monitor` — the default — is lighter still: GPU/host health metrics with no CUPTI at all.)

## Ways to use GPUFlight

GPUFlight has several entry points. They are separate workflows, not a
stack of levels where one choice automatically includes the next.

### Native foreground monitor

Use `gpufl monitor` when you want machine-level GPU and host telemetry
from a terminal session:

```bash
gpufl monitor --interval=1000
```

This does not trace kernels and it does not require Docker. It samples
system metrics such as GPU utilization, memory, temperature, power,
clocks, CPU, and RAM. With `--upload`, the command also starts
`gpufl-agent` as a managed child process so those local logs can stream
to the dashboard:

```bash
gpufl monitor --interval=1000 --upload
```

### Docker sidecar monitor

Use the Docker/supervisor path when monitoring should run as
infrastructure next to the workload:

```bash
docker compose -f docker-compose.monitor.yml up -d
```

This path runs the standalone `gpufl-monitor` daemon and the standalone
`gpufl-agent` uploader. It is operationally different from
`gpufl monitor`: the native command is a foreground CLI session, while
the Docker path is a deployed service/sidecar pattern.

See the [Docker & Kubernetes Guide](deployment/docker-kubernetes) and the
[`gpufl-monitor` daemon README](https://github.com/gpu-flight/gpufl-client/tree/main/daemon)
for deployment details.

### Launch-time trace

Use `gpufl trace` when you want kernel-level profiling for a program you
can launch from the command line:

```bash
gpufl trace -- python train.py
```

`gpufl trace` injects GPUFlight into the launched process and records
kernel timing, launch configuration, memory copies, synchronization, and
system metrics without source changes. It is meant for launch-time
profiling of an existing program. If your application already embeds
GPUFlight and calls `gpufl::init()` itself, run that application normally
and configure the embedded SDK path; wrapping the same program again
with `gpufl trace` is not guaranteed to be a supported combination.

For clearer trace analysis, add NVTX ranges to the application. NVTX is
a lightweight way to label phases such as `prefill`, `decode`,
`batch_0`, or `optimizer_step` without adopting the embedded GPUFlight
scope API.

See [Capturing traces](getting-started/capturing-traces) for the trace
workflow.

### Embedded SDK

Use the embedded SDK when you own the application code and want
GPUFlight initialized directly inside the process:

```cpp
#include <gpufl/gpufl.hpp>

int main() {
    gpufl::InitOptions opts;
    opts.app_name = "my_app";
    opts.continuous_system_sampling = true;
    gpufl::init(opts);

    // ...your existing CUDA/HIP code...

    gpufl::shutdown();
}
```

After the one-time integration above, runtime behavior such as upload,
profiling engine, sampling rate, and remote-config name can be controlled
through `GPUFL_*` environment variables.

### Application annotations

Annotations are a separate way to add meaning to the trace. They are not
"level 3" of the monitor/trace stack.

- Use **NVTX ranges** when you are profiling with `gpufl trace` and want
  high-level regions without linking the GPUFlight SDK.
- Use **`GFL_SCOPE` / `gpufl.Scope`** when the application embeds
  GPUFlight and you want GPUFlight-owned scope events.

Both approaches help connect raw kernel activity to application phases.
Use them for the higher-level "why", not the low-level "what".

See the [Scope Profiling Guide](guides/scope-profiling) for embedded
GPUFlight scopes.

## How data reaches the dashboard

`gpufl-client` always writes telemetry to local NDJSON files during a
session. Upload tools ship those files to the backend, and they share
the same on-disk source of truth:

- **In-process deferred upload.** After `gpufl::shutdown()` returns,
  call `gpufl::uploadLogs(opts)` in C++ or `gpufl.upload_logs(...)` in
  Python — or wrap the whole thing in `with gpufl.session(...)` and the
  Python side runs the upload automatically on exit. All HTTP runs
  post-shutdown, so network failures cannot affect the GPU workload's
  exit code. Best for local dev, SSH sessions, and Jupyter notebooks.
- **Agent daemon (`gpufl-agent`).** Run the standalone JVM service on
  the host; it tails NDJSON files and uploads compressed batches
  (10–15× smaller than per-event uploads). Best for production fleets
  where many GPUs are emitting concurrently.
- **Native monitor upload.** Run `gpufl monitor --upload` for
  telemetry-only machine monitoring; it writes local logs and starts
  `gpufl-agent` for live upload.
- **Browser upload.** Drop a session folder into the dashboard when
  you copied logs from another machine or do not have CLI credentials
  on that host.

See [Sending data to the dashboard](getting-started/sending-data) for
the full guide.

## Key Features

### Multi-Vendor GPU Support
- **NVIDIA**: Kernel interception via CUPTI, system telemetry via NVML
- **AMD**: Kernel tracing via rocprofiler-sdk, system telemetry via ROCm SMI
- **Automatic backend detection**: `BackendKind::Auto` selects the right backend at runtime

### Cloud Dashboard
- Real-time GPU monitoring across all your devices
- Historical kernel timeline and performance trends
- SASS disassembly viewer with stall reason highlighting
- Occupancy analysis with per-resource breakdown
- Accessible from any browser, no desktop app required

### Production-Ready Architecture
- Lock-free ring buffer for zero-contention kernel event capture
- Background collector thread with batched output
- `PcSampling` runs at low overhead, safe for always-on deployment
- Docker and Kubernetes native deployment

### CUDA Kernel Profiling
- Kernel names, grid/block dimensions, register counts, shared memory
- Occupancy analysis with per-resource breakdown (registers, shared memory, warps/wavefronts)
- Limiting resource identification
- CPU stack traces (NVIDIA)

### Profiling Engines (NVIDIA)
- **`Monitor`** (default): GPU/host health metrics only — no CUPTI. Lowest overhead.
- **`Trace`**: Activity trace — kernels, memcpy, sync — with timing and launch config. No sampling.
- **`PcSampling`**: Stall-reason sampling at the program counter level. Low overhead, production-safe.
- **`SassMetrics`**: Per-instruction execution counts, memory coalescing efficiency, divergence analysis.
- **`RangeProfiler`**: Hardware performance counters via NVIDIA PerfWorks for per-scope metric exports. Moderate per-scope overhead.
- **`Deep`**: `PcSampling` + `SassMetrics` together — the full development-time profile. Significant kernel slowdown while the scope is active.

### ISA Disassembly
- **NVIDIA**: SASS disassembly via `nvdisasm`
- **AMD**: RDNA ISA disassembly via `llvm-objdump`
- Automatic capture and disassembly of GPU code objects
- Source line to GPU instruction correlation

### System Monitoring
- GPU utilization, temperature, power, VRAM usage, clock speeds
- Host CPU and RAM utilization
- **AMD extended metrics**: Fan speed, junction/memory temperature, voltage, energy consumption, PCIe bandwidth, ECC error counts

### Report Generation
- Automatic text report after profiling session
- Session summary, kernel hotspots, memory transfers, system metrics, scope timing
- Profile analysis with stall reasons and thread divergence
- Available from both C++ and Python

## Quick Start

```cpp
#include <gpufl/gpufl.hpp>

int main() {
    gpufl::InitOptions opts;
    opts.app_name = "my_app";
    opts.continuous_system_sampling = true;
    opts.system_sample_rate_ms = 50;
    gpufl::init(opts);

    GFL_SCOPE("training") {
        // GPU kernels here
    }

    gpufl::shutdown();
    gpufl::generateReport();  // prints performance summary to console
}
```

See the [Installation Guide](getting-started/installation) to get started, or the [Docker & Kubernetes Guide](deployment/docker-kubernetes) for containerized deployment.
