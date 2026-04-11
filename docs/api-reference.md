---
sidebar_position: 4
---

# API Reference

## C++ API

### Header

```cpp
#include <gpufl/gpufl.hpp>
```

### Initialization

```cpp
namespace gpufl {

struct InitOptions {
    std::string app_name = "gpufl";
    std::string log_path = "";               // defaults to "<app_name>.log"
    int system_sample_rate_ms = 0;           // 0 = disabled
    int kernel_sample_rate_ms = 0;
    BackendKind backend = BackendKind::Auto; // Auto, Nvidia, Amd, None
    bool sampling_auto_start = false;
    bool enable_kernel_details = false;
    bool enable_debug_output = false;
    bool enable_stack_trace = true;
    ProfilingEngine profiling_engine = ProfilingEngine::PcSampling;
};

bool init(const InitOptions& opts);
void shutdown();
void generateReport(const std::string& output_path = "");
}
```

### Scoping

```cpp
// Macro-based (recommended)
GFL_SCOPE("name") {
    // kernels launched here are attributed to "name"
}

// Object-based
{
    gpufl::ScopedMonitor scope("name");
    // ...
}

// Lambda-based
gpufl::monitor("name", [&]() {
    // ...
});
```

### System Monitoring

```cpp
gpufl::systemStart("phase_name");
// ... GPU work ...
gpufl::systemStop("phase_name");
```

### Backend Kind

```cpp
enum class BackendKind { Auto, Nvidia, Amd, None };
```

### Profiling Engine (NVIDIA only)

```cpp
enum class ProfilingEngine {
    None,                // Monitoring only
    PcSampling,          // PC-level stall sampling
    SassMetrics,         // Per-instruction metrics
    RangeProfiler,       // Hardware perf counters
    PcSamplingWithSass,  // PC sampling + SASS combined
};
```

---

## Python API

### Core Functions

```python
import gpufl as gfl

opts = gfl.InitOptions()
opts.app_name = "my_app"
opts.sampling_auto_start = True
opts.system_sample_rate_ms = 50
opts.backend = gfl.BackendKind.Auto

gfl.init(opts)

with gfl.Scope("phase_name"):
    # GPU work here
    pass

gfl.system_start("sampling")
gfl.system_stop("sampling")

gfl.shutdown()
```

### Analyzer

```python
from gpufl.analyzer import GpuFlightSession

session = GpuFlightSession(log_dir, log_prefix="my_app", session_id=None)

session.print_summary()            # Executive summary
session.inspect_scopes()           # Scope timing analysis
session.inspect_hotspots(top_n=5)  # Top kernels by GPU time
session.inspect_stalls()           # PC sampling stall distribution
session.inspect_profile_samples()  # SASS/PC sample details
session.inspect_perf_metrics()     # Hardware counter results
```

#### Parsed DataFrames

After construction, `GpuFlightSession` exposes pandas DataFrames:

| Attribute | Description |
|-----------|-------------|
| `session.kernels` | Kernel events with timing and occupancy |
| `session.memcpy` | Memory transfer events |
| `session.scopes` | Profile sample data (SASS/PC) |
| `session.scope_events` | Scope begin/end pairs |
| `session.device_metrics` | GPU utilization, temp, power samples |
| `session.host_metrics` | CPU and RAM utilization samples |
| `session.perf` | Hardware performance counter results |

### Report

```python
from gpufl.report import generate_report, TextReport

# One-liner
text = generate_report(log_dir, log_prefix="my_app", top_n=10, output_path=None)

# Class-based
from gpufl.analyzer import GpuFlightSession
session = GpuFlightSession(log_dir, log_prefix="my_app")
report = TextReport(session, top_n=10)
report.print()              # stdout
report.save("report.txt")   # file
text = report.generate()    # string
```

### Visualization

```python
import gpufl.viz as viz

viz.init("./logs/*.log")
viz.show()
```
