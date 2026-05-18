# Python Analysis & Visualization

The `gpufl` Python library provides tools for analyzing, reporting, and visualizing the structured logs (NDJSON) produced by the C++ library. It works with logs from both NVIDIA and AMD sessions.

## Report Generation

For a one-line text summary of a session — kernel hotspots, memory
transfers, system metrics — use `generate_report` or the
`TextReport` class. Both are covered in detail in the
[Report Generation guide](report-generation#python-api), which is also
the canonical reference for the C++ side.

This page focuses on the **interactive** Python analyzer and the
matplotlib visualization — the unique value the Python library adds
on top of plain reports.

## Analyzer (CLI Dashboard)

The `analyzer` module provides interactive terminal analysis using Rich-formatted output.

```python
from gpufl.analyzer import GpuFlightSession

session = GpuFlightSession("./logs", log_prefix="my_app")

# Executive Summary: Duration, Utilization, Peak VRAM
session.print_summary()

# Hierarchical Scope Analysis: Time spent in GFL_SCOPE blocks
session.inspect_scopes()

# Kernel Hotspots: Top expensive kernels with stack traces
session.inspect_hotspots(top_n=5, max_stack_depth=5)

# Stall Analysis (PC sampling data)
session.inspect_stalls()

# Profile Samples (SASS metrics or PC sampling)
session.inspect_profile_samples()

# Hardware Performance Counters (Range Profiler data)
session.inspect_perf_metrics()
```

:::tip Empty inspector? Read the hint.
`inspect_profile_samples()` and `inspect_perf_metrics()` print an
actionable hint when no matching records exist in the log — naming
the exact `profiling_engine` enum value, the `with gpufl.Scope(...)`
requirement (these samples flush on scope close), and the build /
hardware preconditions. Most "I see nothing" reports are explained
by that hint.
:::

## Visualization (Timeline)

The `viz` module creates interactive `matplotlib` plots correlating
kernel execution with system metrics.

:::warning Broken in v0.1.x — fixed in v1.0
`gpufl.viz` in releases `0.1.0` through `0.1.4` silently drops every
batch record from the NDJSON log (it was written against an older
per-event wire format and never updated for the columnar batches the
client emits today). The result is a nearly empty plot — typically
just one or two snapshot points at session start/stop.

A full rewrite of the data-ingestion layer lands in **v1.0.0**.
Until then, use the [analyzer](#analyzer-cli-dashboard) for
visualization-grade insight and skip `viz`.
:::

```python
import gpufl.viz as viz   # v1.0.0+ only

viz.init("./logs/*.log")
viz.show()
```

### Key Visualization Features (v1.0.0+)
- **GPU/Host utilization**: Correlate code execution with hardware load
- **Kernel occupancy**: See how well your kernels utilize the GPU
- **Interactive tooltips**: Hover over kernels to see their full name and metadata
- **VRAM tracking**: Monitor memory usage throughout the session
