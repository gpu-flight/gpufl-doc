---
sidebar_position: 1
---

# Introduction

**GPUFlight** is a lightweight, always-on GPU profiler and monitoring system designed for production environments. It supports both **NVIDIA CUDA** and **AMD ROCm** workloads, recording kernel behavior with minimal overhead.

Unlike traditional GPU profilers that require stopping or significantly slowing down the application, GPUFlight is designed for **production GPU monitoring**. It captures kernel telemetry and logical scopes into structured logs, providing deep insights into GPU workloads as they happen.

## Key Features

### Multi-Vendor GPU Support
- **NVIDIA**: Kernel interception via CUPTI, system telemetry via NVML
- **AMD**: Kernel tracing via rocprofiler-sdk, system telemetry via ROCm SMI
- **Automatic backend detection**: `BackendKind::Auto` selects the right backend at runtime

### Production-Ready Architecture
- Lock-free ring buffer for zero-contention kernel event capture
- Background collector thread with batched NDJSON log output
- Automatic log rotation and gzip compression
- Minimal overhead suitable for always-on deployment

### Logical Scoping
- `GFL_SCOPE("name")` macro to group kernels into application phases
- Nested scope support with automatic depth tracking
- Scope timing and GPU time attribution in reports

### Rich Kernel Metadata
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

### System Monitoring
- GPU utilization, temperature, power, VRAM usage, clock speeds
- Host CPU and RAM utilization
- **AMD extended metrics**: Fan speed, junction/memory temperature, voltage, energy consumption, PCIe bandwidth, ECC error counts

### Report Generation
- Automatic text report after profiling session
- Session summary, kernel hotspots, memory transfers, system metrics, scope timing
- Profile analysis with stall reasons and thread divergence
- Available from both C++ and Python

### Sidecar-Ready Logging
- Structured NDJSON output across three channels: device, scope, system
- Automatic file rotation with gzip compression
- Session-based filtering for multi-run log files

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

See the [Installation Guide](getting-started/installation) to get started.
