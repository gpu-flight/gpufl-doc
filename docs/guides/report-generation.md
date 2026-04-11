---
sidebar_position: 5
---

# Report Generation

GPUFlight can generate a text-based performance report after a profiling session. The report summarizes kernel execution, memory transfers, system metrics, scope timing, and profile analysis.

## C++ API

After calling `shutdown()`, call `generateReport()`:

```cpp
gpufl::shutdown();

// Print to console
gpufl::generateReport();

// Save to file
gpufl::generateReport("report.txt");
```

The report automatically reads the log files from the most recent `init()` call and filters to the latest session.

## Python API

### Quick One-Liner

```python
from gpufl.report import generate_report

text = generate_report("./logs", log_prefix="my_app")
print(text)
```

### Using the TextReport Class

```python
from gpufl.report import TextReport
from gpufl.analyzer import GpuFlightSession

session = GpuFlightSession("./logs", log_prefix="my_app")
report = TextReport(session, top_n=10)
report.print()         # print to stdout
report.save("report.txt")  # save to file
```

## Report Sections

A typical report includes:

### Session Summary
Application name, session ID, duration, GPU device info (name, compute capability, SM/CU count).

### Kernel Execution Summary
Total kernels, unique kernels, total GPU time, GPU busy percentage, duration statistics (avg/median/min/max).

### Top Kernels by GPU Time
Ranked table showing each kernel's call count, total time, average time, and max time.

### Kernel Details
Per-kernel occupancy breakdown: grid/block dimensions, register/shared memory/warp occupancy, limiting resource.

### Memory Transfer Summary
Transfers grouped by direction (HtoD, DtoH), with byte counts and average throughput in GB/s.

### System Metrics
- **GPU**: Utilization, temperature, power, VRAM, clock speeds
- **AMD extended**: Junction/memory temp, fan speed, voltage, energy, PCIe bandwidth, ECC errors
- **Host**: CPU utilization, RAM usage

### Scope Summary
Scope timing (begin/end pairs) and GPU time attribution per scope.

### Profile / SASS Analysis
Stall reason distribution, per-kernel stall breakdown, SASS/ISA metric totals, and thread divergence analysis (warp/wavefront efficiency).

## Example Output

```
===============================================================================
                           GPU Flight Session Report
===============================================================================

===============================================================================
  Session Summary
===============================================================================
  Application:          my_app
  Session ID:           abc12345-...
  Duration:             2.34 s
  GPU Device:           NVIDIA GeForce RTX 3090
    Compute:            8.6
    SMs:                82

===============================================================================
  Kernel Execution Summary
===============================================================================
  Total Kernels:        42
  Unique Kernels:       3
  Total GPU Time:       1.23 s
  GPU Busy:             52.6%

===============================================================================
  Top 10 Kernels by Total GPU Time
===============================================================================
  #   Kernel                          Calls   Total       Avg         Max
  --------------------------------------------------------------------------
  1   matmul_kernel                      21   845.23 ms   40.25 ms   156.42 ms
  2   relu_kernel                        21   384.91 ms   18.33 ms    42.10 ms
```
