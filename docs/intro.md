---
sidebar_position: 1
---

# Introduction

**GPUFlight** is a GPU profiler and monitoring system that scales with your kernel from development to production. Built on CUPTI (NVIDIA) and rocprofiler-sdk (AMD), it captures kernel telemetry, SASS-level instruction analysis, and system metrics, all streamed to a cloud dashboard.

Two engines anchor the workflow:

- **`Deep`** for development. Per-instruction SASS metrics, memory coalescing analysis, divergence analysis, full source correlation. Use it when you are writing or tuning a specific kernel.
- **`PcSampling`** for production. Low-overhead stall-reason sampling, safe to leave on across a fleet 24/7. Use it for always-on observability, regression detection, and long-tail outlier hunting.

The engine is a deployment-time switch, not a different tool. The same SDK, same scopes, same dashboard, same data model work on both sides. Set `GPUFL_PROFILING_ENGINE=PcSampling` in your production environment and the same binary that ran `Deep` locally drops to PC sampling on the fleet. No rebuild. (And `Monitor` — the default — is lighter still: GPU/host health metrics with no CUPTI at all.)

## Three Levels of Integration

GPUFlight offers three levels of integration. Pick the deepest level you're willing to integrate — each level adds capabilities on top of the previous one.

### Level 1: Zero-Code Monitoring (sidecar)

**No code changes required, no SDK in your app.** Run the `gpufl-monitor` daemon as a sidecar container on the same host as your GPU workload. It samples system metrics directly from NVML (NVIDIA) or ROCm SMI (AMD) and ships them to the cloud dashboard.

What you get at Level 1:
- GPU utilization, VRAM, temperature, power, clock speeds
- Host CPU and RAM metrics
- AMD extended metrics: fan speed, junction/memory temperature, voltage, energy, PCIe bandwidth, ECC error counts
- Real-time and historical dashboard views

What Level 1 **does not** give you (these require Level 2):
- CUDA/HIP kernel event capture (timing, occupancy, grid/block dimensions)
- SASS/ISA instruction-level disassembly and stall analysis
- Memory copy event tracking (H2D, D2H, D2D)
- CPU stack traces

```bash
# Sidecar — no changes to your application at all
docker compose -f docker-compose.monitor.yml up -d
```

See the [Docker & Kubernetes Guide](deployment/docker-kubernetes) and the
[`gpufl-monitor` daemon README](https://github.com/gpu-flight/gpufl-client/tree/main/daemon)
for deployment details.

### Level 2: Embedded Integration

**Link `gpufl-client` into your application and call `gpufl::init()` once at startup.** This is where the kernel-level features turn on, because GPUFlight needs to attach CUPTI (NVIDIA) or rocprofiler-sdk (AMD) inside your process to intercept GPU activity.

```cpp
#include <gpufl/gpufl.hpp>

int main() {
    gpufl::InitOptions opts;
    opts.app_name = "my_app";
    opts.continuous_system_sampling = true;
    gpufl::init(opts);

    // ...your existing CUDA/HIP code, unchanged...

    gpufl::shutdown();
}
```

After the one-time integration above, all runtime behavior — upload, profiling engine, sampling rate, remote-config name — is controlled by `GPUFL_*` environment variables. No rebuild needed to change configuration.

What Level 2 adds on top of Level 1:
- CUDA/HIP kernel event capture (timing, occupancy, grid/block dimensions, register usage, shared memory)
- SASS/ISA instruction-level disassembly and stall analysis
- Memory copy event tracking (H2D, D2H, D2D)
- CPU stack traces (NVIDIA)
- Profiling engines: PC Sampling, SASS Metrics, Range Profiler, PC Sampling + SASS

See the [Installation Guide](getting-started/installation) to get started.

### Level 3: Scope Annotations (Optional, on top of Level 2)

**Add a few lines of code** to connect your application logic to GPU behavior. Scope annotations let you label phases of your pipeline so you can see exactly which part of your code is responsible for which GPU activity.

```cpp
#include <gpufl/gpufl.hpp>

void train_step() {
    GFL_SCOPE("forward_pass") {
        conv_kernel<<<grid, block>>>(...);
        relu_kernel<<<grid, block>>>(...);
    }

    GFL_SCOPE("backward_pass") {
        grad_kernel<<<grid, block>>>(...);
        update_kernel<<<grid, block>>>(...);
    }
}
```

What scope annotations add on top of Level 2:
- Named timing regions in the timeline view
- Nested scope hierarchy (e.g., "epoch > batch > forward_pass")
- Correlation between your high-level code and low-level kernel events
- Per-scope GPU time attribution in reports

See the [Scope Profiling Guide](guides/scope-profiling) for details.

## How data reaches the dashboard

`gpufl-client` always writes telemetry to local NDJSON files during a
session. Two paths ship those files to the backend, and they share the
same on-disk source of truth:

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

Both paths can coexist. See [Sending data to the dashboard](getting-started/sending-data)
for the full guide.

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
