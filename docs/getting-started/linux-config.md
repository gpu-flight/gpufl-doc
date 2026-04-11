# Linux Configuration

GPU profiling on Linux requires specific permissions depending on your GPU vendor.

## NVIDIA Configuration

To allow non-root users to profile GPU kernels using CUPTI, you must relax the NVIDIA driver security restrictions.

1.  **Create a configuration file**:
    ```bash
    sudo nano /etc/modprobe.d/nvidia-profiler.conf
    ```

2.  **Add the following line**:
    ```bash
    options nvidia NVreg_RestrictProfilingToAdminUsers=0
    ```

3.  **Apply changes and reboot**:
    ```bash
    sudo update-initramfs -u
    sudo reboot
    ```

4.  **Verify**:
    ```bash
    cat /proc/driver/nvidia/params | grep RestrictProfilingToAdminUsers
    ```
    It should output `RestrictProfilingToAdminUsers: 0`.

## AMD Configuration

AMD GPUs require access to the KFD (Kernel Fusion Driver) and ROCm SMI devices.

1.  **Add your user to the required groups**:
    ```bash
    sudo usermod -aG video $USER
    sudo usermod -aG render $USER
    ```

2.  **Log out and back in** for group changes to take effect.

3.  **Verify ROCm SMI access**:
    ```bash
    rocm-smi
    ```
    You should see GPU information (temperature, utilization, etc.) without `sudo`.

4.  **Verify HIP runtime**:
    ```bash
    hipInfo
    ```
    This should list your AMD GPU devices.

:::tip
If `rocm-smi` requires `sudo`, check that `/dev/kfd` and `/dev/dri/renderD*` have the correct group permissions. On most distributions, installing ROCm sets these up automatically.
:::
