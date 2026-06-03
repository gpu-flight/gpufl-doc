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
    bool         remote_upload = false;          // DEPRECATED v1.1, removed v1.2 (no-op; see api-reference)

    // ── What to capture ─────────────────────────────────────────────
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
    ProfilingEngine profiling_engine  = ProfilingEngine::Monitor;  // telemetry only; opt up the ladder

    // ── Advanced ────────────────────────────────────────────────────
    std::string  config_file = "";   // local JSON config applied after defaults
    bool         flush_logs_always   = false;
    bool         enable_debug_output = false;
    bool         enabled             = true;     // global kill switch; false → init is a no-op
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
| `log_path` | `string` | `""` (= `"<app_name>"`) | Base directory for NDJSON logs. Each run writes into a per-session subdirectory: `<log_path>/<session_id>/{device,scope,system}.log`. The `gpufl-agent` daemon tails these. |

**Cloud upload** (see [Sending data to the dashboard](getting-started/sending-data))

| Field | Type | Default | Notes |
|---|---|---|---|
| `backend_url` | `string` | `""` | Backend host — do not include `/api/v1`. |
| `api_key` | `string` | `""` | Workspace API key (`gpfl_xxx`). |
| `api_path` | `string` | `""` | Empty resolves to `/api/v1`. Override for reverse-proxy mounts. |
| `remote_upload` | `bool` | `false` | **DEPRECATED in v1.1; removed in v1.2.** Live HTTP streaming was removed. The flag stays as a one-release deprecation shim: Python customers see a `DeprecationWarning` and get an `atexit` handler that calls `upload_logs()` at interpreter exit; C++ customers see a deprecation log line at init and need to call `gpufl::uploadLogs()` explicitly themselves. New code should use `gpufl::uploadLogs(opts)` (C++) or `gpufl.upload_logs(...)` (Python) directly, or `with gpufl.session(backend_url=..., api_key=...):` to orchestrate it. |

**What to capture**

| Field | Default | Notes |
|---|---|---|
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
| `config_file` | `""` | Local JSON file applied after the built-in defaults. |
| `flush_logs_always` | `false` | `fsync` after every write. Diagnostics; avoid in production. |
| `enable_debug_output` | `false` | Verbose stderr logs from gpufl-client. |
| `enabled` | `true` | Global kill switch. When `false`, `init()` returns immediately without spawning any backend, opening a logger, or touching CUPTI/NVML — and every later call (`Scope`, `shutdown`, `upload_logs`, `systemStart`/`systemStop`) becomes a no-op. Lets you toggle gpufl off without removing the call sites. The `GPUFL_DISABLED` env var (see below) forces the same behavior and takes precedence over this field. |

#### Environment variable overrides {#env-var-overrides}

These environment variables override their corresponding `InitOptions`
fields when set. Programmatic options always win when you set them
explicitly in code; env vars apply when the field is left at default.

| Env var | Field |
|---|---|
| `GPUFL_DISABLED` | `enabled` (inverted). Set to `1` / `true` / `yes` / `on` (case-insensitive) to disable gpufl entirely — `init()` no-ops and every later call is inert. **Takes precedence over the `enabled` kwarg**, so you can switch profiling off for a one-off run without editing code: `GPUFL_DISABLED=1 python train.py`. |
| `GPUFL_BACKEND_URL` | `backend_url` |
| `GPUFL_API_KEY` | `api_key` |
| `GPUFL_API_PATH` | `api_path` |
| `GPUFL_CONFIG_FILE` | `config_file` |
| `GPUFL_REMOTE_UPLOAD` | `remote_upload` — **DEPRECATED v1.1, removed v1.2.** Still read in v1.1 (routes through the Python atexit shim). Drop from container manifests when convenient. |
| `GPUFL_PROFILING_ENGINE` | `profiling_engine` — accepts engine names (`Monitor`, `Trace`, `PcSampling`, `SassMetrics`, `RangeProfiler`, `Deep`). |

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

Profiling depth is one setting, `profiling_engine`, chosen from a six-level
ladder. The default is **`Monitor`** (health metrics only, no CUPTI). Step up
the ladder for more detail at higher cost; the production-safe sweet spot is
**`PcSampling`**, and **`Deep`** is the full development-time profile.

:::note Modes are additive
Each level layers on top of the one below. From `Trace` upward the SDK
captures the full activity trace — kernel events (timing, grid/block
dimensions, registers, theoretical occupancy), memcpy/memset, and sync
events — plus NVML system metrics and host metrics; the higher levels add
sampling data on top. `Monitor` is the exception: it runs **no CUPTI at
all**, so it emits only NVML/host telemetry (and is therefore the
lowest-overhead, safest mode).
:::

```cpp
enum class ProfilingEngine {
    Monitor,        // Health metrics only — no CUPTI. The default.
    Trace,          // + activity trace: kernels, memcpy, sync (no sampling)
    PcSampling,     // + PC-level stall-reason sampling
    SassMetrics,    // + per-instruction SASS counters
    RangeProfiler,  // + hardware throughput counters (Perfworks)
    Deep,           // PcSampling + SassMetrics in one run
};
```

| Mode | NVIDIA | AMD | Overhead | What it captures |
|---|---|---|---|---|
| `Monitor` (default) | ✓ | ✓ | Minimal | NVML system metrics + host metrics only. No CUPTI. |
| `Trace` | ✓ | ✓ | Low | + activity trace: kernel events (timing, grid/block, registers, occupancy), memcpy/memset, sync |
| `PcSampling` (production-safe) | ✓ | ✗ | Low | + stall reasons per PC, hot-PC distribution, function/source-line correlation per sample |
| `SassMetrics` | ✓ | ✗ | Significant | + per-instruction execution counts, memory coalescing efficiency, divergence analysis |
| `RangeProfiler` | ✓ | ✗ | Moderate, per scope | + hardware counter exports per scope (achieved occupancy, DRAM throughput). Niche. |
| `Deep` | ✓ | ✗ | Significant kernel slowdown | `PcSampling` + `SassMetrics` together — the deepest single-run profile |

:::tip Deep-mode overhead is intrinsic
The Deep-mode kernel slowdown comes from instrumenting every executed SASS
instruction with counter increments. The same constraint applies to any tool
that collects per-instruction counters (including NVIDIA Nsight Compute, which
addresses it with kernel replay instead of slower passes). Use Deep mode for
the specific kernel you are investigating, not for fleet-wide deployment.
:::

:::warning `Deep` / `SassMetrics` / `RangeProfiler` must be initialized early
These three use CUPTI's Profiler API, which must initialize against a clean
CUDA context. Call `gpufl.init()` **before your first CUDA kernel** (in PyTorch,
right after `import torch`) — initializing mid-program, after the framework has
loaded modules and run kernels, can make the Profiler API fail to start.
GPUFlight degrades gracefully (Deep → PC Sampling) and logs the cause, but
early init is the fix. `Monitor` / `Trace` / `PcSampling` have no such
constraint. See [CUDA integration → Profiling Engines](guides/cuda-integration#profiling-engines).
:::

:::note AMD users
On AMD today only `Monitor` / `Trace` and the dispatch-counter path
are supported. `PcSampling`, `SassMetrics`, `RangeProfiler`, and
`Deep` are NVIDIA-only — on an AMD backend they fall back to the
dispatch-counter path after a startup warning. AMD parity is on the
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

#### Turning gpufl off without removing the call

`init()` takes an `enabled` kwarg (default `True`). Pass `enabled=False`
to make `init()` — and every subsequent `gpufl` call — a no-op, so you
can leave the instrumentation in place but switch it off:

```python
gfl.init(app_name="my_app", enabled=False)   # init returns False; Scope/upload_logs/etc. all no-op
```

The `GPUFL_DISABLED` environment variable does the same thing and
**wins over the kwarg**, which is handy for a one-off run you don't want
to profile without touching the code:

```bash
GPUFL_DISABLED=1 python train.py
```

Truthy values are `1`, `true`, `yes`, `on` (case-insensitive). When
disabled, `gpufl.upload_logs(...)` returns an empty result
(`success=True`, `events_uploaded=0`) and performs no network I/O.

#### `BackendKind.None_` — the Python keyword workaround

`BackendKind` has a value literally named `None`. Because `None` is a
reserved keyword in Python, you cannot write `gfl.BackendKind.None` —
that's a `SyntaxError`. The bindings expose a trailing-underscore alias:

```python
# "No backend" — for stub / test sessions.
gfl.init(app_name="m", backend=gfl.BackendKind.None_)
```

The alias points at the same value as the C++ `BackendKind::None`
constant (mirrors the `class_` / `type_` pattern pybind11 uses
elsewhere).

`ProfilingEngine` needs no such alias — its lowest level is
`Monitor` (telemetry only, no CUPTI), a normal identifier you write
directly: `gfl.ProfilingEngine.Monitor`.

#### Migrating from v0.1.0 / v0.1.1

The Python `init()` signature was trimmed in **v1.0.0-prep** to drop
three legacy parameters that duplicated newer, more expressive ones.
If you're on a pre-v1.0 release and see a `TypeError: init() got an
unexpected keyword argument …`, swap as follows:

| Old kwarg | New equivalent |
|---|---|
| `enable_profiling=False` | `profiling_engine=gpufl.ProfilingEngine.Monitor` |
| `enable_profiling=True` (default) | `profiling_engine=gpufl.ProfilingEngine.PcSampling` (the default is now `Monitor`, so set this explicitly) |
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
