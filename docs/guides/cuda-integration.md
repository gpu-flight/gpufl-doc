---
sidebar_position: 1
---

# NVIDIA / CUDA Integration

GPUFlight supports NVIDIA GPUs via CUDA, providing kernel interception through CUPTI, system telemetry via NVML, multiple profiling engines, SASS disassembly, and source-to-assembly correlation.

## Prerequisites

- CUDA Toolkit 13.x or later (including CUPTI)
- NVML (ships with the NVIDIA driver)
- CMake 3.31+
- C++17 compiler

## Build Setup

Fetch the library via CMake `FetchContent` (see
[Installation](../getting-started/installation) for the canonical
boilerplate), then link your CUDA target:

```cmake
add_executable(my_app main.cu)
target_link_libraries(my_app PRIVATE gpufl::gpufl CUDA::cudart)
```

NVIDIA backends are enabled by default (`GPUFL_ENABLE_NVIDIA=ON`), so
no extra flags are needed for a CUDA-only build.

## CUDA Example

```cpp
#include <gpufl/gpufl.hpp>
#include <cuda_runtime.h>

__global__ void matmul(const float* A, const float* B, float* C, int N) {
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int col = blockIdx.x * blockDim.x + threadIdx.x;
    if (row < N && col < N) {
        float sum = 0;
        for (int k = 0; k < N; ++k) sum += A[row*N+k] * B[k*N+col];
        C[row*N+col] = sum;
    }
}

int main() {
    gpufl::InitOptions opts;
    opts.app_name = "matmul_demo";
    opts.continuous_system_sampling = true;
    opts.system_sample_rate_ms = 50;
    opts.enable_kernel_details = true;
    opts.profiling_engine = gpufl::ProfilingEngine::SassMetrics;
    gpufl::init(opts);

    float *d_A, *d_B, *d_C;
    cudaMalloc(&d_A, N*N*sizeof(float));
    cudaMalloc(&d_B, N*N*sizeof(float));
    cudaMalloc(&d_C, N*N*sizeof(float));

    GFL_SCOPE("matmul_benchmark") {
        dim3 block(16, 16);
        dim3 grid((N+15)/16, (N+15)/16);
        matmul<<<grid, block>>>(d_A, d_B, d_C, N);
        cudaDeviceSynchronize();
    }

    cudaFree(d_A); cudaFree(d_B); cudaFree(d_C);
    gpufl::shutdown();
    gpufl::generateReport();
}
```

## Profiling Engines

NVIDIA GPUs support multiple profiling engines selected via
`InitOptions::profiling_engine`. See
[Profiling engines](../api-reference#profiling-engines-nvidia) for an
at-a-glance comparison of overhead and use case; this section is the
deep dive on each engine with example code.

### Monitor (the default)

```cpp
opts.profiling_engine = gpufl::ProfilingEngine::Monitor;
```

Captures system metrics only (utilization, temperature, power, memory) via NVML — **no CUPTI at all**, so negligible overhead and no kernel-level data. This is the default. Use it for fleet health visibility without any kernel instrumentation. For kernel timing without sampling, step up to `Trace`; for stall data, use `PcSampling`.

### Trace (kernel timing, no sampling)

```cpp
opts.profiling_engine = gpufl::ProfilingEngine::Trace;
```

Captures the CUPTI activity trace — every kernel (name, duration, stream, grid/block, registers, occupancy), plus memcpy/memset and sync events — but no PC sampling or SASS instrumentation. The "what ran and how long" view at low overhead.

### PC Sampling

```cpp
opts.profiling_engine = gpufl::ProfilingEngine::PcSampling;
```

Samples the program counter at regular intervals to identify stall reasons (memory dependency, execution dependency, pipe busy, etc.). Provides statistical instruction-level hotspot data.

### SASS Metrics

```cpp
opts.profiling_engine = gpufl::ProfilingEngine::SassMetrics;
```

Instruments kernel instructions to count exact execution and memory access patterns per instruction. Captures:
- `smsp__sass_inst_executed` — warp instruction count per PC
- `smsp__sass_thread_inst_executed` — thread instruction count per PC
- `smsp__sass_sectors_mem_global` — global memory sectors accessed
- `smsp__sass_sectors_mem_global_ideal` — ideal (coalesced) memory sectors

The ratio of thread instructions to warp instructions reveals **thread divergence** at each instruction.

### Range Profiler

```cpp
opts.profiling_engine = gpufl::ProfilingEngine::RangeProfiler;
```

Collects hardware performance counters per scope via NVIDIA PerfWorks. Provides:
- SM throughput percentage
- L1/L2 cache hit rates
- DRAM read/write bytes
- Tensor core active percentage

### Deep (PC Sampling + SASS)

```cpp
opts.profiling_engine = gpufl::ProfilingEngine::Deep;
```

Runs both PC sampling and SASS metrics in a single session using software lazy patching. Provides the most comprehensive instruction-level analysis.

## SASS Disassembly

When kernels are loaded, GPUFlight automatically captures CUBIN binaries and disassembles them using `nvdisasm`. This provides:
- Per-function SASS instruction listings with PC offsets
- Source-to-assembly correlation via CUPTI APIs

The disassembly appears in the web UI under the "SASS" column and in the device log as `cubin_disassembly` records.

## Occupancy Analysis

NVIDIA occupancy is computed using `cudaOccupancyMaxActiveBlocksPerMultiprocessor()` with per-resource breakdown:

| Resource | How It's Computed |
|----------|-------------------|
| **Warp occupancy** | Max warps per SM / warps per block |
| **Register occupancy** | Register file size / registers per block |
| **Shared memory occupancy** | Shared memory per SM / shared memory per block |
| **Block occupancy** | Max blocks per SM hardware limit |

The **limiting resource** (warps, registers, shared_mem, or blocks) is identified and reported.

## System Metrics (NVML)

GPUFlight collects via NVML:
- GPU and memory utilization (%)
- Temperature (C)
- Power consumption (W)
- VRAM usage (MiB)
- Graphics, SM, and memory clock speeds (MHz)
- Power and thermal throttling status
- NVLink throughput (if available)
- PCIe throughput

## Linux Permissions

Non-root CUPTI profiling requires relaxing the NVIDIA driver security restriction. See [Linux Configuration](../getting-started/linux-config) for setup instructions.
