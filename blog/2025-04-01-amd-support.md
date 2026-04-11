---
slug: amd-rocm-support
title: AMD ROCm Support
authors: [gpuflight]
tags: [release, amd, feature]
---

GPUFlight now supports AMD GPUs via ROCm, including HIP kernel tracing, system telemetry, occupancy analysis, ISA disassembly, and extended hardware metrics.

<!-- truncate -->

## What's New

- **AMD/ROCm backend**: Kernel tracing via rocprofiler-sdk, system metrics via ROCm SMI
- **Occupancy analysis**: Theoretical occupancy computed from VGPR usage, LDS, and wavefront limits
- **ISA disassembly**: Automatic RDNA ISA capture via llvm-objdump
- **Extended metrics**: Fan speed, junction/memory temperature, voltage, energy, PCIe bandwidth, ECC errors
- **Report generation**: `gpufl::generateReport()` produces a text summary after profiling
- **CPU iGPU filtering**: AMD APU integrated graphics are automatically excluded from telemetry
- **Vendor-neutral frontend**: Web UI adapts terminology (SASS/ISA, Warp/Wavefront) based on GPU vendor

## Supported Hardware

- **NVIDIA**: CUDA Toolkit with CUPTI (unchanged)
- **AMD**: ROCm 6.x with HIP, rocprofiler-sdk, and ROCm SMI

See the [AMD Integration Guide](/docs/guides/amd-integration) for details.
