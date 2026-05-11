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

For scopes that don't map to a single code block:

```cpp
auto scope = gpufl::ScopedMonitor("data_loading");
// ... load and preprocess data ...
scope.end();  // explicitly end the scope
```

### Lambda-Based

```cpp
gpufl::scope("inference", [&]() {
    result = model.forward(input);
});
```

## Python Scopes

```python
import gpuflight

# Context manager
with gpuflight.scope("forward_pass"):
    output = model(input)

with gpuflight.scope("backward_pass"):
    loss.backward()
```

### Decorating Functions

```python
@gpuflight.scope("training_step")
def train_step(batch):
    output = model(batch)
    loss = criterion(output, labels)
    loss.backward()
    optimizer.step()
```

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

## Combining with Zero-Code Profiling

Scopes are **additive** to the zero-code profiling. You can start with zero integration and add scopes incrementally:

1. **Day 1**: Deploy with env vars only, see all GPU activity
2. **Day 2**: Notice `forward_pass` seems slow, add one scope around it
3. **Day 3**: Add scopes around each layer to pinpoint the bottleneck

You don't need to scope your entire application at once. Add them where you need clarity.

## What's Next

- [C++ Integration Guide](cpp-integration) - Full InitOptions reference and advanced usage
- [Docker & Kubernetes Guide](../deployment/docker-kubernetes) - Zero-code containerized deployment
- [CUDA Integration Guide](cuda-integration) - NVIDIA-specific profiling engines
