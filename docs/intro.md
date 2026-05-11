---
sidebar_position: 1
---

# Introduction

**GPUFlight** is a **low-overhead, always-on** GPU profiler and monitoring system with a **cloud dashboard**. Built on CUPTI (NVIDIA) and rocprofiler-sdk (AMD), it captures kernel telemetry, SASS-level instruction analysis, and system metrics with under 2% overhead in monitoring mode — so you can profile continuously in production, not just during development.

Unlike traditional GPU profilers that require stopping or significantly slowing your application (e.g., NVIDIA Nsight with 20-200x overhead), GPUFlight is designed for **continuous, production-grade monitoring**. It captures kernel telemetry, SASS-level instruction analysis, and system metrics — all streamed to a web dashboard for real-time and historical analysis.

## Two Levels of Integration

GPUFlight offers two levels of integration depending on how deep you want to go:

### Level 1: Zero-Code Profiling

**No code changes required.** Add GPUFlight as a sidecar or set an environment variable — get full GPU profiling immediately.

What you get with zero code changes:
- GPU utilization, memory, temperature, power monitoring
- CUDA kernel event capture (timing, occupancy, grid/block dimensions)
- SASS/ISA instruction-level disassembly and stall analysis
- Memory copy event tracking (H2D, D2H, D2D)
- CPU and RAM metrics
- Cloud dashboard with real-time and historical views

```bash
# Docker - just add environment variables
GPUFL_ENABLED=true
GPUFL_API_KEY=gf_xxxxx
```

See the [Docker & Kubernetes Guide](deployment/docker-kubernetes) for deployment details.

### Level 2: Scope Annotations (Optional)

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

What scope annotations add:
- Named timing regions in the timeline view
- Nested scope hierarchy (e.g., "epoch > batch > forward_pass")
- Correlation between your high-level code and low-level kernel events
- Per-scope GPU time attribution in reports

See the [Scope Profiling Guide](guides/scope-profiling) for details.

## How data reaches the dashboard

`gpufl-client` always writes telemetry to a local NDJSON file.
Two optional paths get that data to the cloud:

- **Direct HTTP upload (in-process).** Set
  `opts.remote_upload = true` (or `GPUFL_REMOTE_UPLOAD=1`) and
  `HttpLogSink` runs in a background thread inside your
  application — every event is POSTed live. Best for local dev,
  SSH sessions, and Jupyter notebooks.
- **Agent daemon (`gpufl-monitor`).** Run the separate
  `gpufl-monitor` binary on the host; it tails NDJSON files and
  uploads compressed batches (10–15× smaller than per-event
  uploads). Best for production, multi-process workloads, and
  bandwidth-conscious deployments.

Both paths can coexist. See [Sending data to the dashboard](getting-started/sending-data)
for the full mental model and a decision table.

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
- Accessible from any browser — no desktop app required

### Production-Ready Architecture
- Lock-free ring buffer for zero-contention kernel event capture
- Background collector thread with batched output
- Minimal overhead suitable for always-on deployment
- Docker and Kubernetes native deployment

### CUDA Kernel Profiling
- Kernel names, grid/block dimensions, register counts, shared memory
- Occupancy analysis with per-resource breakdown (registers, shared memory, warps/wavefronts)
- Limiting resource identification
- CPU stack traces (NVIDIA)

### Profiling Engines (NVIDIA)
- **PC Sampling**: Stall-reason sampling at the program counter level
- **SASS Metrics**: Per-instruction execution counts and memory access patterns
- **Range Profiler**: Hardware performance counters via NVIDIA PerfWorks
- **PC Sampling + SASS**: Combined mode for comprehensive instruction-level analysis

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
    opts.sampling_auto_start = true;
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
