# Python Analysis & Visualization

The `gpufl` Python library provides tools for analyzing, reporting, and visualizing the structured logs (NDJSON) produced by the C++ library. It works with logs from both NVIDIA and AMD sessions.

## Report Generation

The quickest way to get a performance summary:

```python
from gpufl.report import generate_report

# Generate and print a text report
report = generate_report("./logs", log_prefix="my_app")
print(report)

# Or save to file
report = generate_report("./logs", log_prefix="my_app", output_path="report.txt")
```

The report includes:
- Session summary (duration, GPU device info)
- Kernel execution statistics (top kernels by GPU time)
- Kernel occupancy details (grid/block, registers, limiting resource)
- Memory transfer summary (HtoD/DtoH throughput)
- System metrics (GPU utilization, temperature, power, VRAM)
- Scope timing breakdown
- Profile/SASS analysis (stall reasons, thread divergence)

You can also use the `TextReport` class for more control:

```python
from gpufl.report import TextReport
from gpufl.analyzer import GpuFlightSession

session = GpuFlightSession("./logs", log_prefix="my_app")
report = TextReport(session, top_n=10)
print(report.generate())
report.save("report.txt")
```

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
