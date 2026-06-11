---
sidebar_position: 9
title: Remote upload migration
---

## Migration from `remote_upload=True`

`remote_upload` is deprecated in v1.1 and will be removed in v1.2.
The old form still works for one release — there's no rush to update
— but new code should use the deferred forms below.

### Python — still works in v1.1, removed in v1.2

```python
# Old (still works, emits DeprecationWarning)
gpufl.init(app_name="x", backend_url="...", api_key="...",
           remote_upload=True)
# ... work ...
gpufl.shutdown()
# upload_logs() runs at interpreter exit via the atexit shim.
```

Recommended replacements:

```python
# Option A — orchestrated (recommended for notebooks / scripts)
with gpufl.session(app_name="x",
                   backend_url="https://api.gpuflight.com",
                   api_key="gpfl_xxxxx"):
    # ... work ...
# On __exit__: shutdown() then upload_logs() — automatic.

# Option B — explicit (control over timing + result inspection)
gpufl.init(app_name="x", backend_url="...", api_key="...")
# ... work ...
gpufl.shutdown()
result = gpufl.upload_logs(
    log_path="x", backend_url="...", api_key="...",
)
```

### C++ — auto-upload at shutdown in v1.1, removed in v1.2

```cpp
// Old — still compiles, logs a deprecation message at init()
opts.remote_upload = true;
gpufl::init(opts);
// ... work ...
gpufl::shutdown();
// gpufl::shutdown() now auto-invokes gpufl::uploadLogs() with the
// InitOptions creds at the end of teardown. Expect shutdown to block
// for seconds-to-minutes proportional to log volume.
```

```cpp
// New (drop the flag, control timing yourself)
gpufl::init(opts);
// ... work ...
gpufl::shutdown();

gpufl::UploadOptions uopts;
uopts.log_path    = opts.log_path;
uopts.backend_url = opts.backend_url;
uopts.api_key     = opts.api_key;
const auto r = gpufl::uploadLogs(uopts);
if (!r.success) for (const auto& w : r.warnings) std::cerr << w << "\n";
```

The new form gives you the `UploadResult` to inspect (warnings,
event count, elapsed time) and lets you decide whether the upload
runs synchronously, in a background thread, or not at all.

The `GPUFL_REMOTE_UPLOAD` env var is still read in v1.1 and routes
through the Python atexit shim. It's removed in v1.2 along with the
field — start dropping it from container manifests / start scripts.

### v1.2 will go further

`backend_url` and `api_key` on `InitOptions` are also scheduled for
removal in v1.2. Long-term, all backend credentials move to
`UploadOptions` or launcher/agent environment variables, and
`gpufl::init()` stops dealing with network config. Future-proof your
code by passing credentials directly to `uploadLogs()` even today.
