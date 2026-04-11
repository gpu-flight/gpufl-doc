---
sidebar_position: 6
---

# ISA Disassembly

GPUFlight automatically captures and disassembles GPU code objects, providing instruction-level visibility into your kernels.

## How It Works

1. **Code object capture**: When a GPU kernel module is loaded, GPUFlight intercepts the binary
2. **CRC deduplication**: Each unique code object is identified by CRC32 and processed once
3. **Disassembly**: A vendor-specific disassembler extracts per-instruction mnemonics with PC offsets
4. **Logging**: Disassembly records are written to the device log as `cubin_disassembly` events

| Vendor | Binary Format | Disassembler | ISA Name |
|--------|--------------|--------------|----------|
| NVIDIA | CUBIN (ELF) | `nvdisasm` | SASS |
| AMD | Code Object (ELF) | `llvm-objdump` | RDNA ISA |

## Enabling ISA Capture

ISA disassembly is captured automatically when `enable_kernel_details` is set:

```cpp
gpufl::InitOptions opts;
opts.enable_kernel_details = true;
gpufl::init(opts);
```

No additional configuration is needed. The disassembler path is detected automatically:
- **NVIDIA**: `/usr/local/cuda/bin/nvdisasm`
- **AMD**: `$ROCM_PATH/llvm/bin/llvm-objdump` or `/opt/rocm/llvm/bin/llvm-objdump`

## Log Format

Each function produces a `cubin_disassembly` record in the device log:

```json
{
  "type": "cubin_disassembly",
  "session_id": "abc123...",
  "cubin_crc": 946433418,
  "function_name": "_Z11scaleKernelPiii",
  "entries": [
    {"pc": 0, "sass": "s_load_b64 s[0:1], s[4:5], 0x0"},
    {"pc": 8, "sass": "s_load_b64 s[2:3], s[4:5], 0x8"},
    {"pc": 20, "sass": "v_mad_co_u64_u32 v[0:1], null, ttmp9, s2, v[0:1]"}
  ]
}
```

The `sass` field contains the native assembly regardless of vendor (SASS for NVIDIA, RDNA ISA for AMD). The `pc` field is the byte offset from the function entry point.

## Web UI

In the GPUFlight web interface, disassembly appears in the source correlation view:
- **NVIDIA sessions**: Column header shows "SASS"
- **AMD sessions**: Column header shows "ISA"

The vendor is detected automatically from the session's GPU device metadata.

## NVIDIA SASS Example

```
MOV R1, c[0x0][0x28]
S2R R0, SR_CTAID.X
S2R R3, SR_TID.X
IMAD.MOV.U32 R2, RZ, RZ, c[0x0][0x168]
```

## AMD RDNA ISA Example

```
s_clause 0x1
s_load_b32 s2, s[0:1], 0x2c
s_load_b32 s3, s[0:1], 0x18
s_wait_kmcnt 0x0
v_mad_co_u64_u32 v[0:1], null, ttmp9, s2, v[0:1]
```
