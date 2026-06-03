# Scope Profiling

GPUFlight works **without any code changes** — but adding scope annotations unlocks a deeper level of insight by connecting your application logic to GPU behavior.

## Why Use Scopes?

Without scopes, GPUFlight shows you raw kernel activity:
> "kernel `volta_sgemm_128x64` ran for 2.3ms"

With scopes, GPUFlight shows you what your code was doing:
> "**forward_pass** took 45ms (3 kernels: sgemm 2.3ms, relu 0.1ms, batchnorm 1.8ms)"

Scopes answer the question: **"Which part of MY code is responsible for this GPU activity?"**

## C++ Scopes

### Macro-Based (Recommended)

The simplest way to add scopes. The scope automatically ends when the block exits:

```cpp
#include <gpufl/gpufl.hpp>

void train_epoch(DataLoader& loader) {
    for (auto& batch : loader) {
        GFL_SCOPE("batch") {

            GFL_SCOPE("forward_pass") {
                output = model.forward(batch.input);
            }

            GFL_SCOPE("loss") {
                loss = criterion(output, batch.target);
            }

            GFL_SCOPE("backward_pass") {
                loss.backward();
            }

            GFL_SCOPE("optimizer_step") {
                optimizer.step();
            }
        }
    }
}
```

This produces a nested timeline in the dashboard:

```
batch (120ms)
  forward_pass (45ms)
    volta_sgemm_128x64 (2.3ms)
    relu_kernel (0.1ms)
    batchnorm_fwd (1.8ms)
  loss (5ms)
    cross_entropy_kernel (4.2ms)
  backward_pass (55ms)
    volta_sgemm_128x64 (3.1ms)
    batchnorm_bwd (2.4ms)
  optimizer_step (15ms)
    adam_update_kernel (12ms)
```

### Object-Based

For scopes that don't map to a single `{ }` block, control the scope's
lifetime with a nested block — the scope ends when the
`ScopedMonitor` goes out of scope (RAII):

```cpp
{
    gpufl::ScopedMonitor scope("data_loading");
    // ... load and preprocess data ...
}   // scope ends here, when `scope` is destroyed
```

### Lambda-Based

```cpp
gpufl::monitor("inference", [&]() {
    result = model.forward(input);
});
```

## Python Scopes

The Python module is `gpufl` (the package name on PyPI), and the scope
type is `gpufl.Scope` — a context manager that takes a scope name and
an optional free-form tag. Both args are forwarded to the underlying
C++ `ScopedMonitor`, so the same scope events appear in the NDJSON log
whether your code is C++ or Python.

```python
import gpufl

# Initialize once at app startup. profiling_engine selects what kind
# of in-scope sampling runs; pick Monitor for telemetry-only sessions
# (no CUPTI) or Trace for kernel timing without sampling.
gpufl.init(
    app_name="my_training",
    log_path="./logs",
    continuous_system_sampling=True,
    system_sample_rate_ms=50,
    profiling_engine=gpufl.ProfilingEngine.PcSampling,
)

# Context manager
with gpufl.Scope("forward_pass"):
    output = model(input)

# Optional tag — second positional arg, shown next to the name in the
# dashboard so you can distinguish "forward_pass / batch_42" etc.
with gpufl.Scope("backward_pass", "batch_42"):
    loss.backward()

gpufl.shutdown()
```

:::note No decorator form yet
The Python binding exposes `Scope` as a context-manager class only —
there's no `@gpufl.scope(...)` decorator today. Wrap a function body
with `with gpufl.Scope("name"):` instead. (A decorator wrapper is on
the v1.x roadmap.)
:::

## Benchmark loops (`repeat` / `warmup`)

When you're micro-benchmarking a kernel, you usually want to run it N
times and exclude a few cold-start iterations (JIT compile, cold
caches) from the measurement. Instead of hand-writing two loops plus a
scope, give the scope a `repeat` (and optional `warmup`) count.

### C++ — `GFL_BENCH`

```cpp
#include <gpufl/gpufl.hpp>

// Runs the body 3 warmup times BEFORE the scope opens (excluded from
// the measured window), then 10 measured times inside it.
GFL_BENCH("matmul", gpufl::ScopeMeta{}.setRepeat(10).setWarmup(3)) {
    my_kernel<<<grid, block>>>(...);
    cudaDeviceSynchronize();
};   // ← the trailing ';' is required
```

The builder form (`ScopeMeta{}.setRepeat(...).setWarmup(...)`) compiles
on every major compiler in `/std:c++17`. The body is captured by
reference, so it sees enclosing locals. **`return` inside the body
returns from the lambda, not the enclosing function** — throw an
exception for fatal errors instead.

### Python — iterable `Scope`

Construct `Scope` with `repeat=N` and iterate it. It opens the scope
once, brackets all `repeat` measured iterations, and closes when the
loop ends:

```python
# warmup iterations yield negative indices (-warmup .. -1);
# measured iterations yield 0 .. repeat-1.
for i in gpufl.Scope("matmul", "math", repeat=10, warmup=3):
    matmul_kernel[bpg, tpb](A, B, C)
    # if i >= 0:  # only true for measured iterations
```

The begin row of the scope carries the `repeat` / `warmup` counts, so
the dashboard and the analyzer can report a per-iteration average
without you computing it. A plain `with gpufl.Scope("name"):` (no
`repeat`) behaves exactly as before.

## Scope Best Practices

### Do: Scope High-Level Phases

```cpp
// Good - meaningful application phases
GFL_SCOPE("data_preprocessing") { ... }
GFL_SCOPE("forward_pass") { ... }
GFL_SCOPE("backward_pass") { ... }
GFL_SCOPE("checkpoint_save") { ... }
```

### Don't: Scope Every Kernel Call

```cpp
// Bad - too granular, adds noise
GFL_SCOPE("matmul_1") { matmul<<<g,b>>>(...); }
GFL_SCOPE("matmul_2") { matmul<<<g,b>>>(...); }
```

GPUFlight already captures individual kernel timing. Use scopes for the higher-level "why", not the low-level "what".

### Nesting Depth

Scopes can nest up to any depth. A practical guideline:

| Depth | Example | Purpose |
|-------|---------|---------|
| 1 | `epoch` | Top-level phase |
| 2 | `forward_pass` | Pipeline stage |
| 3 | `attention_layer` | Specific component |

Going deeper than 3-4 levels rarely adds useful information.

## Adding scopes incrementally

Scopes are **additive**. Once you've completed the one-time embedded integration (`gpufl::init()`), you can introduce scopes gradually:

1. **Day 1**: Embedded integration with `gpufl::init()` — you now see every kernel, SASS-level stalls, and memory copies on the dashboard
2. **Day 2**: Notice `forward_pass` seems slow — wrap it with one `GFL_SCOPE`
3. **Day 3**: Add scopes around each layer to pinpoint the bottleneck

You don't need to scope your entire application at once. Add them where you need clarity.

> **Note:** If you haven't done the embedded integration yet, the sidecar-only deployment (`gpufl-monitor`) gives you system telemetry — GPU utilization, memory, temperature, power, CPU/RAM — but **not** kernel events or scopes. See [Three Levels of Integration](../intro#three-levels-of-integration) for the full breakdown.

## What's Next

- [C++ Integration Guide](cpp-integration) - Full InitOptions reference and advanced usage
- [Docker & Kubernetes Guide](../deployment/docker-kubernetes) - Containerized deployment for apps already linked with `gpufl-client`
- [CUDA Integration Guide](cuda-integration) - NVIDIA-specific profiling engines
