---
sidebar_position: 3
title: Capturing traces
---

# Capturing traces with `gpufl trace`

`gpufl trace` is the fastest way to try GPUFlight on an existing
CUDA program. You do not need to link the SDK or edit application code.
The launcher starts your program with GPUFlight injected, writes local
NDJSON logs, and can optionally upload the result when the process exits.

A trace session captures the launched process. For an application that
already embeds GPUFlight and calls `gpufl::init()` itself, run the
application normally and configure the embedded SDK path instead of
assuming it can also be wrapped by `gpufl trace`.

## Basic run

```bash
gpufl trace -- python train.py
```

On Windows:

```powershell
gpufl.exe trace -- python train.py
```

GPUFlight creates a local session directory under `~/.gpufl/traces/`
on Linux/macOS or `%USERPROFILE%\.gpufl\traces\` on Windows. The
directory contains one subfolder per session id, with `device.log`,
`scope.log`, and `system.log` files.

## Name and output directory

```bash
gpufl trace --name=resnet50-smoke --output=./runs/resnet50 -- python train.py
```

The output directory is the source of truth. You can inspect it locally,
upload it later with `gpufl upload`, or let `gpufl-agent` tail it in a
production setup.

## Pick capture passes

By default, `gpufl trace` runs one `Trace` pass, which captures kernel,
memcpy/memset, synchronization, launch details, and system metrics.
For explicit control, pass `--passes`:

```bash
# Same as the default.
gpufl trace --passes=Trace -- python train.py

# Timeline plus PM hardware-counter sampling in isolated passes.
gpufl trace --passes=Trace,PmSampling -- python train.py

# Deep shorthand: Trace,PcSampling,SassMetrics.
gpufl trace --passes=Deep -- python train.py
```

`PcSampling`, `SassMetrics`, `PmSampling`, and Range Profiler engines
use NVIDIA performance-counter APIs. On Linux, NVIDIA may restrict
those counters to administrator users until you relax the driver setting.
See [Linux Configuration](linux-config).

For monitoring-only GPU/host telemetry, use `gpufl monitor` instead of
`gpufl trace`.

## Add application context with NVTX

Raw kernel names are often not enough, especially for LLM inference or
large training scripts where the same kernels repeat across many phases.
When using `gpufl trace`, the lightweight way to add structure is NVTX:

```cpp
#include <nvtx3/nvToolsExt.h>

nvtxRangePushA("prefill");
run_prefill();
nvtxRangePop();

nvtxRangePushA("decode");
run_decode();
nvtxRangePop();
```

NVTX ranges let the trace show application phases without linking the
GPUFlight SDK. If your application embeds GPUFlight directly, you can
also use `GFL_SCOPE` / `gpufl.Scope` for GPUFlight-owned scope events.

## Multi-pass profiling

Some CUPTI engines cannot safely run together in one CUDA context.
`gpufl trace` handles this by running the same command several times,
one engine per pass, then tagging the passes so the backend can merge
them into one analysis.

```bash
gpufl trace --passes=Trace,PcSampling,RangeProfilerKernelReplay -- python train.py
```

Think of the merged result as a union of capabilities:

- `Trace` owns canonical kernel timing and launch metadata.
- `PcSampling` adds stall samples that do not overlap with trace timing.
- `RangeProfilerKernelReplay` adds per-kernel hardware counters.

Multi-pass profiling requires the command to run more than once. It is
not a live attach mode for an already-running service.

## Upload after capture

For a one-off run:

```bash
gpufl trace --upload -- python train.py
```

`--upload` requires:

```bash
export GPUFL_BACKEND_URL=https://api.gpuflight.com
export GPUFL_API_KEY=gpfl_xxxxx
```

You can also upload later:

```bash
gpufl upload ./runs/resnet50
```

See [Sending data to the dashboard](sending-data) for all upload paths,
including `gpufl-agent`, browser upload, and `gpufl monitor --upload`.

## Limits

Multi-pass trace runs the command more than once, so it only makes
sense for workloads that can be replayed. `gpufl monitor` is the
separate command for GPU/host telemetry and does not attach CUPTI to
another running process.
