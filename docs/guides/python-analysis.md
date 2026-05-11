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

## Visualization (Timeline)

The `viz` module creates interactive `matplotlib` plots to correlate kernel execution with system metrics.

```python
import gpufl.viz as viz

viz.init("./logs/*.log")
viz.show()
```

### Key Visualization Features
- **GPU/Host utilization**: Correlate code execution with hardware load
- **Kernel occupancy**: See how well your kernels utilize the GPU
- **Interactive tooltips**: Hover over kernels to see their full name and metadata
- **VRAM tracking**: Monitor memory usage throughout the session
