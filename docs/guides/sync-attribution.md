---
sidebar_position: 7
title: Sync attribution — find the line of code that's blocking the GPU
---

# Sync attribution

> "My GPU utilization is 30%. Where is it stalling?"

Most profilers tell you a `cudaStreamSynchronize` took 73
seconds. They don't tell you **which line of your code called
it**. GPUFlight does — by capturing the CPU stack on every
synchronization event and correlating it back to source through
the same path that powers per-kernel attribution.

## What you see

When `enable_synchronization = true` and `enable_stack_trace = true`,
the dashboard's `SYNCHRONIZATION` insight category shows:

> **In-loop sync × 50 — likely blocking GPU pipelining**
> 73.58s blocked across 50 calls
> at `03_pytorch_benchmark.py:90` in `train_step()`
> Move the sync outside the loop or capture the loop body into a
> CUDA graph.

Click the source-line chip and you land on the kernel detail at
that line. No more "the profiler tells me it's slow but not
where."

## Setup

Two flags. Both are on the default-on path for production-style
profiling, but make sure you have stack-trace capture explicitly
enabled — it's `false` by default to keep the per-launch overhead
near-zero for users who don't need it.

```cpp
gpufl::InitOptions opts;
opts.app_name = "my_app";

opts.enable_synchronization = true;   // capture cudaStream/Device/EventSynchronize
opts.enable_stack_trace     = true;   // capture CPU stacks at sync points

opts.backend_url = "https://api.gpuflight.com";
opts.api_key     = std::getenv("GPUFL_API_KEY");

gpufl::init(opts);

// ... run your workload, exit scopes, etc. ...

gpufl::shutdown();

// Deferred upload — runs post-shutdown, never during the workload.
gpufl::UploadOptions uopts;
uopts.log_path    = opts.log_path;
uopts.backend_url = opts.backend_url;
uopts.api_key     = opts.api_key;
gpufl::uploadLogs(uopts);
```

That's it. Run your workload. The dashboard's **Insights** panel
will surface a `SYNCHRONIZATION` category card if there's
anything actionable.

## What gets captured

For every `cudaStreamSynchronize`, `cudaDeviceSynchronize`,
`cudaEventSynchronize`, or `cudaStreamWaitEvent` your application
makes:

1. **Wall-clock duration** — how long the host was blocked.
2. **CPU stack at the sync site** — the call stack at the moment
   the sync was issued, captured via the platform's standard
   stack-walk facility (`CaptureStackBackTrace` on Windows,
   `backtrace` on Linux).
3. **Source attribution** — file paths and line numbers from
   debug info (when available — compile with `-g` in C++, or
   from the Python interpreter's stack for PyTorch).
4. **Correlation to surrounding kernel work** — the events
   between consecutive syncs, so the in-loop detector can tell
   "you sync'd 50 times, with kernel work between each pair" —
   the textbook anti-pattern of synchronizing inside a hot loop.

## The two insight rules

### 1. Sync attribution

Groups all sync events by source line and reports the hot lines:

> **`ContextSynchronize × 50 @ 03_pytorch_benchmark.py:90 ·
> 73.58s (95.0% of session)`**

Severity is `HIGH` if the line is responsible for >50% of session
wall time, `MEDIUM` for >10%, otherwise `LOW`. This always fires
when stack-trace capture is on and there's any sync activity.

### 2. In-loop sync detector

A more specific rule for the most common anti-pattern: a sync
inside a loop with kernel work between calls. Fires when:

- ≥3 syncs come from the same source line, AND
- The median number of distinct kernel correlations between
  consecutive syncs from that line is ≥3.

> **`In-loop sync × 50 — likely blocking GPU pipelining`**
> Move the sync outside the loop or capture the loop body into
> a CUDA graph (replay amortizes launch overhead).

When you see this insight, the standard fixes are:

- **Move the sync to after the loop**, if you only need the
  results once at the end.
- **Capture the loop body into a CUDA graph** with
  `cudaGraphLaunch` — replay amortizes both kernel launch
  overhead and host-side coordination. See NVIDIA's
  [CUDA graphs documentation](https://docs.nvidia.com/cuda/cuda-c-programming-guide/index.html#cuda-graphs).

## Cost

Stack capture is the dominant cost — typically 1–3 µs per sync
on a modern x86_64 host. For a workload with 1,000 syncs/sec, that's
~0.3% CPU overhead. The stack frames themselves are interned in a
process-wide registry and emitted as deduplicated NDJSON, so the
network and storage cost grows with **distinct call sites**, not
with sync volume.

If you're profiling a workload with millions of syncs (rare —
that's usually the bug you're trying to find), disable
`enable_stack_trace` and you'll still get the totals from
`enable_synchronization` alone.

## What's not captured

- **AMD/ROCm syncs.** Stack-trace capture on syncs is a CUPTI-
  callback path today; the AMD backend's rocprofiler-sdk
  equivalent is on the roadmap. AMD users can still use
  `enable_synchronization` for total host-block time, just not
  per-line attribution yet.
- **Internal driver syncs.** A few sync calls happen inside
  CUDA's own runtime (e.g. context teardown). Those don't have a
  user-frame stack and surface with the lowest user frame
  marked `<driver-internal>`.

## Related guides

- [Scope Profiling](scope-profiling) — wrap regions of your code
  with named scopes so you can see "all syncs inside `forward_pass`
  totaled X seconds."
- [Sending data to the dashboard](../getting-started/sending-data) —
  ensure your telemetry is reaching the cloud (otherwise the
  insights aren't generated).
