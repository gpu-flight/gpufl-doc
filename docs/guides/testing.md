# Testing

The GPUFlight project includes comprehensive test suites for both the C++ and Python components.

## C++ Tests (GoogleTest)

The C++ tests are hardware-aware and will automatically skip vendor-specific tests if a compatible GPU or driver is not detected.

### NVIDIA Build

```bash
cmake -B build -DBUILD_TESTING=ON
cmake --build build --target gpufl_tests
ctest --test-dir build --output-on-failure
```

### AMD Build

```bash
cmake -B build-rocm -DGPUFL_ENABLE_AMD=ON -DGPUFL_ENABLE_NVIDIA=OFF -DBUILD_TESTING=ON
cmake --build build-rocm --target gpufl_tests
ctest --test-dir build-rocm --output-on-failure
```

### Run Directly

```bash
./build/tests/gpufl_tests          # NVIDIA
./build-rocm/tests/gpufl_tests     # AMD
```

## Python Tests (pytest)

The Python tests verify the analyzer, report, and visualization logic using mocked data to avoid hardware dependencies during CI.

```bash
pip install pytest
export PYTHONPATH=$PYTHONPATH:$(pwd)/python
pytest tests/python
```

## CI Pipeline

The CI runs on multiple platforms:
- **Linux**: NVIDIA (CUDA) and AMD (ROCm) builds
- **Windows**: NVIDIA build with MSVC
- **Python wheel**: Built and tested on all platforms
