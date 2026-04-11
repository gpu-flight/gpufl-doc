---
sidebar_position: 2
---

# AMD / ROCm Integration

GPUFlight supports AMD GPUs via ROCm, including HIP kernel tracing, system telemetry, occupancy analysis, and ISA disassembly.

## Prerequisites

- ROCm 6.x or later
- HIP runtime
- ROCm SMI library
- rocprofiler-sdk
- CMake 3.28+

## Build Setup

```cmake
include(FetchContent)

FetchContent_Declare(
    gpufl
    GIT_REPOSITORY https://github.com/gpu-flight/gpufl-client.git
    GIT_TAG        main
)

set(GPUFL_ENABLE_AMD ON CACHE BOOL "" FORCE)
set(GPUFL_ENABLE_NVIDIA OFF CACHE BOOL "" FORCE)

FetchContent_MakeAvailable(gpufl)

hip_add_executable(my_app my_app.cpp)
target_link_libraries(my_app PRIVATE gpufl::gpufl hip::host)
```

## HIP Example

```cpp
#include <gpufl/gpufl.hpp>
#include <hip/hip_runtime.h>

__global__ void scaleKernel(int* data, int scale, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) data[idx] *= scale;
}

int main() {
    gpufl::InitOptions opts;
    opts.app_name = "hip_demo";
    opts.sampling_auto_start = true;
    opts.system_sample_rate_ms = 50;
    opts.enable_kernel_details = true;
    gpufl::init(opts);

    int* d_data;
    hipMalloc(&d_data, N * sizeof(int));

    GFL_SCOPE("scale_loop") {
        for (int i = 0; i < 50; ++i) {
            scaleKernel<<<N/256, 256>>>(d_data, 2, N);
        }
        hipDeviceSynchronize();
    }

    hipFree(d_data);
    gpufl::shutdown();
    gpufl::generateReport();
}
```

## Extended AMD Metrics

GPUFlight collects additional metrics on AMD GPUs via ROCm SMI:

| Metric | Description |
|--------|-------------|
| Junction Temperature | GPU junction (hotspot) temperature |
| Memory Temperature | VRAM temperature |
| Fan Speed | Fan speed percentage |
| Voltage | GFX voltage in millivolts |
| Energy | Cumulative energy consumption |
| PCIe Bandwidth | Combined PCIe read+write throughput |
| ECC Errors | Correctable and uncorrectable error counts |

These appear automatically in the system metrics section of the report when available.

## Occupancy on AMD

GPUFlight computes theoretical occupancy for AMD kernels using:
- **Wavefront size** (typically 32 for RDNA, 64 for CDNA)
- **Max wavefronts per CU** from the GPU architecture
- **VGPR usage** per kernel (from rocprofiler code object metadata)
- **LDS (shared memory) usage** per workgroup

The limiting resource is identified as "waves", "registers", or "shared_mem".

:::note
AMD occupancy uses architecture VGPR count only (not combined SGPR+VGPR). SGPRs have a separate allocation pool and don't limit VGPR occupancy.
:::

## ISA Disassembly

AMD ISA disassembly is captured automatically when GPU code objects are loaded. GPUFlight:
1. Captures the ELF code object during the `CODE_OBJECT_LOAD` callback
2. Computes a CRC32 for deduplication
3. Disassembles using `llvm-objdump` (from the ROCm LLVM toolchain)
4. Emits per-function instruction listings with PC offsets

The disassembly appears in the web UI under the "ISA" column (vs "SASS" for NVIDIA).

## Known Limitations

- **No PC sampling on RDNA consumer GPUs**: PC sampling requires MI200+ (CDNA) hardware
- **No SASS-equivalent metrics**: Instruction-level metric collection is not yet available via rocprofiler-sdk for RDNA
- **CPU iGPU filtering**: Systems with AMD APUs (Ryzen with integrated graphics) are automatically filtered out of telemetry to avoid polluted metrics
