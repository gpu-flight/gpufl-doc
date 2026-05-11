# C++ Integration Guide

This guide covers how to use GPUFlight in your CUDA or HIP C++ application.

## Basic Usage

```cpp
#include <gpufl/gpufl.hpp>

int main() {
    gpufl::InitOptions opts;
    opts.app_name = "my_app";
    opts.log_path = "my_app.log";          // log files: my_app.device.log, my_app.scope.log, my_app.system.log
    opts.sampling_auto_start = true;       // start system metric sampling immediately
    opts.system_sample_rate_ms = 50;       // sample GPU/CPU metrics every 50ms
    opts.enable_kernel_details = true;     // capture grid/block, occupancy, registers
    // opts.backend = gpufl::BackendKind::Auto;  // auto-detect NVIDIA or AMD (default)

    gpufl::init(opts);

    // ... your GPU code ...

    gpufl::shutdown();

    // Print a performance summary report to console
    gpufl::generateReport();

    // Or save to a file
    // gpufl::generateReport("report.txt");

    return 0;
}
```

## InitOptions

The example above shows the most commonly used fields. For the full
field reference — every option with type, default, and notes —
see [`InitOptions` field reference](../api-reference#initoptions-fields).

## Logical Scoping

Group kernel launches into named phases using `GFL_SCOPE`:

```cpp
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

Scopes can be nested. All kernels launched within a scope are attributed to that scope in the report and logs.

## System Monitoring

Start and stop system metric collection independently:

```cpp
gpufl::systemStart("training_phase");
// ... GPU work ...
gpufl::systemStop("training_phase");
```

When `sampling_auto_start` is enabled, system monitoring runs for the entire session.

## Profiling Engines (NVIDIA)

Select a profiling engine via `InitOptions::profiling_engine`. See
[Profiling engines](../api-reference#profiling-engines-nvidia) for the
overhead comparison and when to pick each, and the
[CUDA integration guide](cuda-integration#profiling-engines) for the
per-engine deep dive with example code.

## Report Generation

After `shutdown()`, generate a summary report:

```cpp
gpufl::shutdown();

// Print to console (stdout)
gpufl::generateReport();

// Save to file
gpufl::generateReport("report.txt");
```

The report includes kernel hotspots, memory transfers, system metrics, scope timing, and profile analysis.

## How it Works

1. **Kernel Interception**: CUPTI callbacks (NVIDIA) or rocprofiler-sdk buffer tracing (AMD) intercept kernel launches.
2. **Lock-Free Logging**: Kernel metadata is pushed into a lock-free ring buffer.
3. **Background Collection**: A separate thread drains the ring buffer and writes batched NDJSON logs.
4. **ISA Capture**: GPU code objects are captured and disassembled (SASS for NVIDIA, RDNA ISA for AMD).
