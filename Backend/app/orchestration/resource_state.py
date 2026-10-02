"""Resource state inspector for MediFusion AI.

Monitors available host RAM, CPU topology, and accelerator (CUDA GPU) VRAM
to inform deterministic, resource-aware model scheduling without oversubscribing.
"""

from dataclasses import dataclass, asdict
from typing import Dict, Any, Tuple
import os
import torch

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


@dataclass
class ResourceSnapshot:
    """Snapshot of current system compute and memory resources."""
    total_ram_mb: int
    available_ram_mb: int
    used_ram_mb: int
    ram_usage_percent: float
    cpu_cores: int
    cuda_available: bool
    gpu_count: int
    gpu_name: str | None
    total_vram_mb: int
    available_vram_mb: int
    allocated_vram_mb: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def inspect_resource_state() -> ResourceSnapshot:
    """Capture a real-time snapshot of system memory, compute, and GPU resources."""
    if HAS_PSUTIL:
        mem = psutil.virtual_memory()
        total_ram = int(mem.total / (1024 * 1024))
        avail_ram = int(mem.available / (1024 * 1024))
        used_ram = int(mem.used / (1024 * 1024))
        ram_percent = float(mem.percent)
        cores = psutil.cpu_count(logical=True) or os.cpu_count() or 1
    else:
        total_ram = 8192
        avail_ram = 4096
        used_ram = 4096
        ram_percent = 50.0
        cores = os.cpu_count() or 1

    cuda_avail = torch.cuda.is_available()
    gpu_count = torch.cuda.device_count() if cuda_avail else 0
    gpu_name = torch.cuda.get_device_name(0) if cuda_avail and gpu_count > 0 else None
    
    total_vram = 0
    avail_vram = 0
    allocated_vram = 0

    if cuda_avail and gpu_count > 0:
        try:
            mem_stats = torch.cuda.mem_get_info(0)
            avail_vram = int(mem_stats[0] / (1024 * 1024))
            total_vram = int(mem_stats[1] / (1024 * 1024))
            allocated_vram = int(torch.cuda.memory_allocated(0) / (1024 * 1024))
        except Exception:
            total_vram = 0
            avail_vram = 0

    return ResourceSnapshot(
        total_ram_mb=total_ram,
        available_ram_mb=avail_ram,
        used_ram_mb=used_ram,
        ram_usage_percent=ram_percent,
        cpu_cores=cores,
        cuda_available=cuda_avail,
        gpu_count=gpu_count,
        gpu_name=gpu_name,
        total_vram_mb=total_vram,
        available_vram_mb=avail_vram,
        allocated_vram_mb=allocated_vram,
    )


def check_resource_fit(
    required_ram_mb: int,
    required_vram_mb: int = 0,
    safety_margin_mb: int = 512,
) -> Tuple[bool, str]:
    """Deterministically check if a candidate model fits within available memory headroom."""
    snapshot = inspect_resource_state()

    # Check RAM with safety margin
    effective_available_ram = max(0, snapshot.available_ram_mb - safety_margin_mb)
    if required_ram_mb > effective_available_ram:
        return False, (
            f"Insufficient RAM: required {required_ram_mb} MB exceeds safe available "
            f"{effective_available_ram} MB (total available: {snapshot.available_ram_mb} MB, "
            f"safety margin: {safety_margin_mb} MB)"
        )

    # Check VRAM if GPU required
    if required_vram_mb > 0:
        if not snapshot.cuda_available:
            return False, "GPU acceleration requested but CUDA is not available on host system"
        if required_vram_mb > snapshot.available_vram_mb:
            return False, (
                f"Insufficient VRAM: required {required_vram_mb} MB exceeds available "
                f"{snapshot.available_vram_mb} MB"
            )

    return True, (
        f"Resource check passed: required {required_ram_mb} MB RAM fits in "
        f"{snapshot.available_ram_mb} MB available headroom"
    )
