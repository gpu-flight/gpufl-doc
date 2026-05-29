---
sidebar_position: 5
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
    // ── Identity ────────────────────────────────────────────────────
    std::string  app_name = "gpufl";
    std::string  log_path = "";                  // defaults to "<app_name>.log"

    // ── Cloud upload ────────────────────────────────────────────────
    std::string  backend_url = "";               // e.g. "https://api.gpuflight.com" (host only)
    std::string  api_key     = "";               // sent as `Authorization: Bearer <key>`
    std::string  api_path    = "";               // empty → "/api/v1"; override for proxy mounts
    std::string  config_name = "";               // remote config to fetch on init
    bool         remote_upload = false;          // DEPRECATED v1.1, removed v1.2 (no-op; see api-reference)

    // ── What to capture ─────────────────────────────────────────────
    bool         enable_kernel_details        = false;
    bool         enable_stack_trace           = false;  // capture CPU stacks on launch + sync events
    bool         enable_source_collection     = true;   // collect source for SASS correlation
    bool         enable_external_correlation  = true;   // honor framework-pushed external IDs (PyTorch/JAX/XLA)
    bool         enable_synchronization       = true;   // CUDA sync events (host-blocked time)
    bool         enable_memory_tracking       = false;  // cudaMalloc / cudaFree timing — opt-in
    bool         enable_cuda_graphs_tracking  = false;  // per-launch cudaGraphLaunch timing — opt-in

    // ── Sampling ────────────────────────────────────────────────────
    int          system_sample_rate_ms        = 0;      // 0 = disabled; ~50–100 typical
    int          kernel_sample_rate_ms        = 0;      // DEPRECATED (1.0.1) — no longer has any effect
    bool         continuous_system_sampling   = false;   // renamed from sampling_auto_start

    // ── Profiling engine ────────────────────────────────────────────
    BackendKind     backend           = BackendKind::Auto;
    ProfilingEngine profiling_engine  = ProfilingEngine::PcSampling;

    // ── Advanced ────────────────────────────────────────────────────
    std::string  config_file = "";   // local JSON config; merged with remote config
    bool         flush_logs_always   = false;
    bool         enable_debug_output = false;
};

bool init(const InitOptions& opts);
void shutdown();
void generateReport(const std::string& output_path = "");
}
```

#### Field reference {#initoptions-fields}

**Identity**

| Field | Type | Default | Notes |
|---|---|---|---|
| `app_name` | `string` | `"gpufl"` | Shown in the dashboard. |
| `log_path` | `string` | `""` (= `"<app>.log"`) | NDJSON output path; the `gpufl-monitor` daemon tails this. |

**Cloud upload** (see [Sending data to the dashboard](getting-started/sending-data))

| Field | Type | Default | Notes |
|---|---|---|---|
| `backend_url` | `string` | `""` | Backend host — do not include `/api/v1`. |
| `api_key` | `string` | `""` | Workspace API key (`gpfl_xxx`). |
| `api_path` | `string` | `""` | Empty resolves to `/api/v1`. Override for reverse-proxy mounts. |
| `config_name` | `string` | `""` | When set, fetches a named remote config before init. |
| `remote_upload` | `bool` | `false` | **DEPRECATED in v1.1; removed in v1.2.** Live HTTP streaming was removed. The flag stays as a one-release deprecation shim: Python customers see a `DeprecationWarning` and get an `atexit` handler that calls `upload_logs()` at interpreter exit; C++ customers see a deprecation log line at init and need to call `gpufl::uploadLogs()` explicitly themselves. New code should use `gpufl::uploadLogs(opts)` (C++) or `gpufl.upload_logs(...)` (Python) directly, or `with gpufl.session(backend_url=..., api_key=...):` to orchestrate it. |

**What to capture**

| Field | Default | Notes |
|---|---|---|
| `enable_kernel_details` | `false` | Capture per-kernel grid/block, occupancy, registers, etc. |
| `enable_stack_trace` | `false` | Capture CPU stacks at kernel launch and sync points. Powers per-line attribution in the dashboard. |
| `enable_source_collection` | `true` | Read source files referenced in stacks; needed for SASS/source correlation. |
| `enable_external_correlation` | `true` | Honor PyTorch/JAX/XLA-pushed external IDs so kernels are tagged with their framework op. |
| `enable_synchronization` | `true` | Capture `cudaStreamSynchronize` / `cudaDeviceSynchronize` / etc. Time spent here = host blocked on GPU. |
| `enable_memory_tracking` | `false` | `cudaMalloc` / `cudaFree` / `cudaMallocAsync` timing. Opt-in due to high event volume in TF eager mode. |
| `enable_cuda_graphs_tracking` | `false` | Per-launch `cudaGraphLaunch` timing. Opt-in pending validation on Blackwell. |

**Sampling**

| Field | Default | Notes |
|---|---|---|
| `system_sample_rate_ms` | `0` | `0` = disabled. ~50–100 ms typical for monitoring. |
| `kernel_sample_rate_ms` | `0` | **Deprecated (1.0.1) — has no effect.** It previously throttled kernel activity-record processing, but that corrupted kernel GPU-time totals (durations were over-counted on host-bound workloads), so it was disabled. All kernel activity records are now always captured. Still accepted (won't error) for backward compatibility; will be removed in a future major release. |
| `continuous_system_sampling` | `false` | Policy for the system-metric sampler. <br />**`true`** — sample continuously from `init()` to `shutdown()` regardless of scopes. Use for fleet monitoring / dashboards / any always-on use case. <br />**`false`** — sampler is idle by default and activates only while inside a `GFL_SCOPE` region (auto-bracketing) or between explicit `systemStart()` / `systemStop()` calls. Outside those windows zero system-metric events are emitted. <br />Renamed from `sampling_auto_start` in 1.0.4. The old kwarg is still accepted from Python with a `DeprecationWarning`; C++ callers must use the new name. |

**Profiling engine**

See [Profiling Engines](#profiling-engines-nvidia) below.

**Advanced**

| Field | Default | Notes |
|---|---|---|
| `config_file` | `""` | Local JSON file applied after defaults, before remote config. |
| `flush_logs_always` | `false` | `fsync` after every write. Diagnostics; avoid in production. |
| `enable_debug_output` | `false` | Verbose stderr logs from gpufl-client. |

#### Environment variable overrides {#env-var-overrides}

These environment variables override their corresponding `InitOptions`
fields when set. Programmatic options always win when you set them
explicitly in code; env vars apply when the field is left at default.

| Env var | Field |
|---|---|
| `GPUFL_BACKEND_URL` | `backend_url` |
| `GPUFL_API_KEY` | `api_key` |
| `GPUFL_API_PATH` | `api_path` |
| `GPUFL_CONFIG_NAME` | `config_name` |
| `GPUFL_REMOTE_UPLOAD` | `remote_upload` — **DEPRECATED v1.1, removed v1.2.** Still read in v1.1 (routes through the Python atexit shim). Drop from container manifests when convenient. |
| `GPUFL_PROFILING_ENGINE` | `profiling_engine` |

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

### Profiling engines {#profiling-engines-nvidia}

GPUFlight ships two recommended modes, **Continuous** for production and **Deep**
for development. A third **Range** mode is available for hardware-counter use
cases. The C++ enum still uses the historical names today; the user-facing mode
names will become the canonical enum values in a future release (with the old
names kept as deprecated aliases).

:::note Modes are additive
The mode you pick is layered **on top of** a base set of data that the SDK
always captures when linked in-process (kernel events with timing, grid/block
dimensions, registers, theoretical occupancy, memcpy events, NVML system
metrics, and host metrics). The mode controls what additional profiling data
is collected, not whether the base layer runs. Picking `None` still gives you
the full base layer; it just disables the optional PC sampling / SASS / Range
data on top.
:::

```cpp
enum class ProfilingEngine {
    None,                // Base layer only. No additional profiling data.
    PcSampling,          // Continuous mode. PC-level stall sampling.
    SassMetrics,         // Per-instruction metrics (subset of Deep mode).
    RangeProfiler,       // Range mode. Hardware perf counters via Perfworks.
    PcSamplingWithSass,  // Deep mode. PC sampling + SASS instrumentation.
};
```

| Mode | Enum value | NVIDIA | AMD | Overhead | What it adds on top of the base layer |
|---|---|---|---|---|---|
| Base layer (always on with SDK) | n/a | ✓ | ✓ | Minimal | Kernel events (timing, grid/block, registers, theoretical occupancy), memcpy events, NVML system metrics, host metrics |
| **Continuous** (recommended default) | `PcSampling` | ✓ | ✗ | Low; production-safe | Stall reasons per PC, hot-PC distribution, function name and source/line correlation per sample |
| **Deep** | `PcSamplingWithSass` | ✓ | ✗ | Significant kernel slowdown while the scope is active | Everything Continuous adds, plus per-instruction execution counts, memory coalescing efficiency, divergence analysis |
| **Range** | `RangeProfiler` | ✓ | ✗ | Moderate, per scope | Hardware counter exports per scope (e.g. achieved occupancy, DRAM throughput). Niche. |
| (legacy) | `SassMetrics` | ✓ | ✗ | Same overhead class as Deep | Subset of Deep. Kept for backward compatibility; new code should use `PcSamplingWithSass`. |
| Monitoring only | `None` | ✓ | ✓ | Minimal | Nothing on top of the base layer. |

:::tip Deep-mode overhead is intrinsic
The Deep-mode kernel slowdown comes from instrumenting every executed SASS
instruction with counter increments. The same constraint applies to any tool
that collects per-instruction counters (including NVIDIA Nsight Compute, which
addresses it with kernel replay instead of slower passes). Use Deep mode for
the specific kernel you are investigating, not for fleet-wide deployment.
:::

:::note AMD users
On AMD today only `None` (monitoring) and the dispatch-counter
path are supported. `PcSampling`, `SassMetrics`, and `RangeProfiler`
are NVIDIA-only — setting them on an AMD backend silently falls
back to `None` after a startup warning. AMD parity is on the
roadmap.
:::

---

## Python API

### Core Functions

```python
import gpufl as gfl

# Function-style init — every InitOptions field is a kwarg.
gfl.init(
    app_name="my_app",
    continuous_system_sampling=True,
    system_sample_rate_ms=50,
    backend=gfl.BackendKind.Auto,
    profiling_engine=gfl.ProfilingEngine.PcSampling,
)

with gfl.Scope("phase_name"):
    # GPU work here
    pass

gfl.system_start("sampling")
gfl.system_stop("sampling")

gfl.shutdown()
```

#### The `None` enum value — use the `None_` alias in Python

Both `ProfilingEngine` and `BackendKind` have a value literally named
`None`. Because `None` is a reserved keyword in Python, you cannot
write `gfl.ProfilingEngine.None` — that's a `SyntaxError`. The
bindings expose a clean trailing-underscore alias:

```python
# "No profiling engine" — monitoring only.
gfl.init(app_name="m", profiling_engine=gfl.ProfilingEngine.None_)

# "No backend" — for stub / test sessions.
gfl.init(app_name="m", backend=gfl.BackendKind.None_)
```

The alias points at exactly the same enum value as the C++
`ProfilingEngine::None` / `BackendKind::None` constants; it's purely
a Python-side naming convenience (mirrors the `class_` / `type_`
pattern pybind11 uses elsewhere).

#### Migrating from v0.1.0 / v0.1.1

The Python `init()` signature was trimmed in **v1.0.0-prep** to drop
three legacy parameters that duplicated newer, more expressive ones.
If you're on a pre-v1.0 release and see a `TypeError: init() got an
unexpected keyword argument …`, swap as follows:

| Old kwarg | New equivalent |
|---|---|
| `enable_profiling=False` | `profiling_engine=gpufl.ProfilingEngine.None_` |
| `enable_profiling=True` (default) | nothing — `profiling_engine` already defaults to `PcSampling` |
| `enable_perf_scope=True` | `profiling_engine=gpufl.ProfilingEngine.RangeProfiler` |
| `remote_config="https://…"` | `backend_url="https://…"` (same meaning) |

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
import gpufl.viz as viz   # v1.0.0+ only — see warning below

viz.init("./logs/*.log")
viz.show()
```

:::warning Broken in v0.1.x
`gpufl.viz` silently drops every batch row in releases `0.1.0`
through `0.1.4` (the data layer was never updated for the columnar
wire format the C++ client emits). Use the [analyzer](#analyzer) for
visualization-grade insight until the v1.0.0 rewrite ships. See the
[Python Analysis guide](guides/python-analysis#visualization-timeline)
for the full context.
:::
