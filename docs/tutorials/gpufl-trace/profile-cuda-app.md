---
sidebar_position: 1
title: Profile a CUDA app with gpufl trace
sidebar_label: Profile a CUDA App
---

# Profile a CUDA app with `gpufl trace`

This tutorial walks through a complete first trace capture with GPUFlight:

1. Write a simple CUDA application.
2. Compile it and run the executable.
3. Build `gpufl-client`.
4. Run `gpufl trace` against the CUDA executable.
5. Upload the trace to `app.gpuflight.com`.

:::tip Tutorial source
The runnable sample source for this tutorial is maintained in the
`gpufl-tutorial/tutorial-01` folder.
:::

## Prerequisites

You need:

- A CUDA-capable NVIDIA GPU
- NVIDIA driver
- CUDA Toolkit
- CMake 3.24 or newer
- A C++ compiler supported by CUDA
- Git

On Windows, install Visual Studio 2022 with the C++ workload. On Ubuntu,
install a GCC/G++ version supported by your CUDA Toolkit.

## 1. Write a simple CUDA application

The sample app launches a vector-add kernel 50 times so the trace has
enough kernel activity to inspect.

The kernel is intentionally small:

```cpp
__global__ void vector_add(const float* a, const float* b, float* c, int n) {
    const int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        c[idx] = a[idx] + b[idx];
    }
}
```

Full source: [vector_add.cu](https://github.com/gpu-flight/gpufl-tutorial/blob/main/tutorial-01/src/vector_add.cu)

The full sample allocates device buffers, copies input data to the GPU,
launches the kernel repeatedly, synchronizes, copies the output back, and
validates the result.

## 2. Compile it and make it executable

### Windows

From `tutorial-01`:

```powershell
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
.\build\Release\gpufl_tutorial_01.exe
```

![CMake configure output for the CUDA vector-add sample on Windows](/img/tutorials/tutorial-01/configure-windows.png)

_CMake configures the tutorial project with Visual Studio 2022 and CUDA._

![Release build output for the CUDA vector-add sample on Windows](/img/tutorials/tutorial-01/build-release-windows.png)

_The Release build compiles `vector_add.cu` and produces `gpufl_tutorial_01.exe`._

Expected output:

```text
Vector add completed successfully: 50 kernel launches, 1048576 elements
```

### Linux - Ubuntu

From `tutorial-01`:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
./build/gpufl_tutorial_01
```

Expected output:

```text
Vector add completed successfully: 50 kernel launches, 1048576 elements
```

## 3. Clone `gpufl-client`

Clone the GPUFlight client source:

```bash
git clone https://github.com/gpu-flight/gpufl-client.git
cd gpufl-client
```

If you already have the repository locally, use that checkout instead.

## 4. Build `gpufl-client`

### Windows

From the `gpufl-client` repository:

```powershell
.\build-windows.ps1
.\build-windows\daemon\launcher\Release\gpufl.exe version
```

For the rest of the Windows commands, set a PowerShell variable that points
to the launcher executable:

```powershell
$gpufl = "C:\path\to\gpufl-client\build-windows\daemon\launcher\Release\gpufl.exe"
```

### Linux - Ubuntu

From the `gpufl-client` repository:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DGPUFL_ENABLE_NVIDIA=ON
cmake --build build -j
./build/daemon/launcher/gpufl version
```

For the rest of the Linux commands, set a shell variable that points to the
launcher executable:

```bash
GPUFL=/path/to/gpufl-client/build/daemon/launcher/gpufl
```

:::info Screenshot to add
Add a screenshot of the successful `gpufl-client` build here.
:::

## 5. Run `gpufl trace`

`gpufl trace` launches your target process with GPUFlight injection enabled.
For this tutorial, the target process is the vector-add executable.

### Windows

From `tutorial-01`:

```powershell
& $gpufl trace `
  --name tutorial-01-vector-add `
  --output .\gpufl-logs `
  -- .\build\Release\gpufl_tutorial_01.exe
```

### Linux - Ubuntu

From `tutorial-01`:

```bash
$GPUFL trace \
  --name tutorial-01-vector-add \
  --output ./gpufl-logs \
  -- ./build/gpufl_tutorial_01
```

After the command finishes, inspect the output directory:

```text
gpufl-logs/
```

The exact file names can vary, but the trace output should include
GPUFlight event logs such as device, scope, and system events.

![Running the CUDA sample through gpufl trace on Windows](/img/tutorials/tutorial-01/trace-execution-windows.png)

_The trace launcher captures the sample, writes `.gpufl-logs`, and exits after the target completes._

![Generated gpufl-logs directory with one session folder](/img/tutorials/tutorial-01/generated-log-directory.png)

_GPUFlight writes one session folder under `gpufl-logs` for this run._

## 6. Upload to `app.gpuflight.com`

There are three useful upload paths:

1. Drag and drop the generated trace files in the dashboard.
2. Start the uploader agent during `gpufl trace`.
3. Upload after the run with `gpufl upload`.

Use the one that matches your workflow.

## Join `app.gpuflight.com`

Create or join your GPUFlight account at:

```text
https://app.gpuflight.com/register
```

## 6.1 Upload by drag and drop

1. Sign in to `https://app.gpuflight.com`.
2. Open the trace upload area.
3. Drag the generated log files from `gpufl-logs` into the upload area.
4. Review the upload plan and click **Upload 1 session**.
5. Wait for the upload status to move from received, to uploading, to done.

![Uploads page with the drop zone for gpufl session folders](/img/tutorials/tutorial-01/uploads-drop-zone.png)

_Open **Uploads** and drop a GPUFlight log directory, a single session folder, or the generated log files._

![Selecting compressed GPUFlight log files from the generated session folder](/img/tutorials/tutorial-01/select-session-files.png)

_This run produced compressed event logs inside the generated session folder._

![Upload page showing one discovered session before upload](/img/tutorials/tutorial-01/upload-plan-session-found.png)

_After the files are dropped, GPUFlight detects one session and shows the upload plan._

![Upload in progress with received status and progress bar](/img/tutorials/tutorial-01/upload-received-progress.png)

_During upload, the newest row first appears with a **Received** status while the files stream to the backend._

![Upload complete with all files sent](/img/tutorials/tutorial-01/upload-completed.png)

_When all files are sent, the upload panel shows the session as sent and the ingest history rows move to **Done**._

## 6.2 Upload using `gpufl-agent`

This mode is useful when you want the trace command to start an uploader
process for the generated logs.

### Create an API key

Open **Settings**, then **API keys**. Click **Generate key**, give the
key a name such as `tutorial-uploader`, choose an expiration, and click
**Generate**.

![API keys settings page in the GPUFlight dashboard](/img/tutorials/tutorial-01/api-keys-page.png)

_API keys live under Settings. Use them when a local agent or CLI command needs to upload trace data._

![Generate API key dialog with a tutorial-uploader key name](/img/tutorials/tutorial-01/generate-api-key-dialog.png)

_Create a key for this tutorial run and choose an expiration that matches your workflow._

After the key is generated, copy it immediately and store it securely. The
dashboard only shows the full key once.

![Generated API key dialog with copy button](/img/tutorials/tutorial-01/api-key-generated.png)

_Copy the generated key before closing the dialog._

Recommended environment variables:

```powershell title="Windows PowerShell"
$env:GPUFL_BACKEND_URL = "https://api.gpuflight.com"
$env:GPUFL_API_KEY = "gpfl_xxxxxxxxxxxx"
```

```bash title="Linux"
export GPUFL_BACKEND_URL=https://api.gpuflight.com
export GPUFL_API_KEY=gpfl_xxxxxxxxxxxx
```

### Download `gpufl-agent`

Download the agent from
[gpu-flight/gpufl-agent](https://github.com/gpu-flight/gpufl-agent).

Install JDK 25, then verify Java is on your PATH:

```bash
java -version
```

Keep the downloaded agent JAR path handy.

```powershell title="Windows PowerShell"
$agentJar = "C:\path\to\gpufl-agent.jar"
```

```bash title="Linux"
AGENT_JAR=/path/to/gpufl-agent.jar
```

### Run `gpufl trace` with the agent

The `--upload` flag starts `gpufl-agent` while the trace is running. The
agent tails the generated log files and streams them to the backend.

```powershell title="Windows PowerShell"
& $gpufl trace `
  --name tutorial-01-vector-add `
  --output .\gpufl-logs `
  --upload `
  --agent-jar $agentJar `
  -- .\build\Release\gpufl_tutorial_01.exe
```

```bash title="Linux"
$GPUFL trace \
  --name tutorial-01-vector-add \
  --output ./gpufl-logs \
  --upload \
  --agent-jar "$AGENT_JAR" \
  -- ./build/gpufl_tutorial_01
```

Because `GPUFL_BACKEND_URL` and `GPUFL_API_KEY` are already set, the
command does not need to repeat `--backend-url` or `--api-key`.

If you type the PowerShell command interactively across multiple lines,
press Enter after the final executable path to submit the completed
command.

![PowerShell command setting GPUFlight upload environment variables and running gpufl trace with agent upload](/img/tutorials/tutorial-01/trace-upload-command.png)

_The trace command uses the API key environment variable, the downloaded agent JAR, and `--upload`._

![Streaming upload output from gpufl-agent while gpufl trace finishes](/img/tutorials/tutorial-01/trace-upload-streaming-output.png)

_The agent streams each log channel, receives HTTP accepted responses, marks sessions complete, and then the launcher exits._

## 6.3 Upload using `gpufl upload`

Use this path when the profiling run already completed and you want to
upload the saved trace directory afterward.

```powershell title="Windows PowerShell"
& $gpufl upload .\gpufl-logs `
  --backend-url $env:GPUFL_BACKEND_URL `
  --api-key $env:GPUFL_API_KEY
```

```bash title="Linux"
$GPUFL upload ./gpufl-logs \
  --backend-url "$GPUFL_BACKEND_URL" \
  --api-key "$GPUFL_API_KEY"
```

To upload all sessions inside a trace directory:

```bash
gpufl upload ./gpufl-logs --all-sessions
```

## 7. Confirm the session in the dashboard

Open `https://app.gpuflight.com` and confirm that the session appears.

For this sample, look for:

- Session name: `tutorial-01-vector-add`
- Kernel count near 50
- Vector-add kernel activity
- Host/device copy events
- System telemetry, if enabled by the trace mode

![Sessions page showing the uploaded tutorial session while it is still processing](/img/tutorials/tutorial-01/sessions-uploading.png)

_The uploaded session first appears on the Sessions page while processing is still in progress._

![Sessions page showing the tutorial session completed](/img/tutorials/tutorial-01/sessions-completed.png)

_After processing finishes, the same session moves to **Completed**._

![Kernel events view for the uploaded vector-add trace](/img/tutorials/tutorial-01/kernel-events.png)

_The kernel view shows 50 launches of the vector-add kernel and per-launch details such as duration, grid, block, registers, stream, and occupancy._

![Timeline view for the uploaded vector-add trace](/img/tutorials/tutorial-01/timeline-view.png)

_The timeline view shows the same CUDA kernel launches on a wall-clock axis._

## Troubleshooting

### `gpufl` is not recognized

Use an absolute path to the launcher executable, or add the launcher
directory to your PATH.

```powershell title="Windows PowerShell"
& "C:\path\to\gpufl.exe" version
```

```bash title="Linux"
/path/to/gpufl version
```

### The CUDA app runs, but the trace is empty

Check that:

- You launched the app through `gpufl trace`.
- The app actually launches CUDA kernels.
- The CUDA Toolkit and NVIDIA driver are installed correctly.
- The target command appears after `--`.

### Upload fails

Check that:

- `GPUFL_BACKEND_URL` points to the correct backend.
- `GPUFL_API_KEY` is set and valid.
- The trace output directory exists.
- The agent JAR path is correct if you use `--upload --agent-jar`.

## Related docs

- [Capturing traces](../../getting-started/capturing-traces)
- [Sending data to the dashboard](../../getting-started/sending-data)
- [Live upload with `gpufl-agent`](../../getting-started/sending-data#path-2-live-upload-with-gpufl-agent)
