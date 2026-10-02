"""Hardware and simulated resource telemetry for the MediFusion Resource-Aware Scheduler.

Accurately tracks real physical host CPU, RAM, and GPU/CUDA VRAM, while providing
an isolated, explicitly labeled simulated constrained-resource demo mode.
"""

from dataclasses import dataclass, field, asdict
from typing import Dict, Any, Optional, Tuple
import os
import torch

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


@dataclass
class SimulatedResourceConfig:
    """Configuration for optional simulated constrained-resource mode.

    The UI/API MUST explicitly state 'SIMULATED_RESOURCE_LIMIT' whenever active.
    Simulated limits are never represented as real physical measurements.
    """
    enabled: bool = False
    simulated_max_ram_mb: int = 512
    simulated_max_vram_mb: int = 0
    simulated_busy_cpu: bool = False
    label: str = "SIMULATED_RESOURCE_LIMIT"
    description: str = "Constrained environment simulation for resource-aware scheduling demonstrations."

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# Global simulation configuration
simulated_config = SimulatedResourceConfig()


@dataclass
class HardwareTelemetry:
    """Real-time physical hardware readings."""
    cpu_percent: float
    cpu_cores: int
    total_ram_mb: int
    used_ram_mb: int
    available_ram_mb: int
    ram_usage_percent: float
    cuda_available: bool
    gpu_count: int
    gpu_name: Optional[str]
    total_vram_mb: int
    allocated_vram_mb: int
    free_vram_mb: int
    simulation_active: bool
    simulated_limits: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def get_hardware_telemetry() -> HardwareTelemetry:
    """Capture real-time physical hardware telemetry, with explicit simulated overlay if active."""
    if HAS_PSUTIL:
        mem = psutil.virtual_memory()
        total_ram = int(mem.total / (1024 * 1024))
        used_ram = int(mem.used / (1024 * 1024))
        avail_ram = int(mem.available / (1024 * 1024))
        ram_percent = float(mem.percent)
        cpu_pct = float(psutil.cpu_percent(interval=None))
        cores = psutil.cpu_count(logical=True) or os.cpu_count() or 1
    else:
        total_ram = 16384
        used_ram = 8192
        avail_ram = 8192
        ram_percent = 50.0
        cpu_pct = 15.0
        cores = os.cpu_count() or 4

    cuda_avail = torch.cuda.is_available()
    gpu_count = torch.cuda.device_count() if cuda_avail else 0
    gpu_name = torch.cuda.get_device_name(0) if cuda_avail and gpu_count > 0 else None
    
    total_vram = 0
    allocated_vram = 0
    free_vram = 0

    if cuda_avail and gpu_count > 0:
        try:
            mem_info = torch.cuda.mem_get_info(0)
            free_vram = int(mem_info[0] / (1024 * 1024))
            total_vram = int(mem_info[1] / (1024 * 1024))
            allocated_vram = int(torch.cuda.memory_allocated(0) / (1024 * 1024))
        except Exception:
            pass

    return HardwareTelemetry(
        cpu_percent=cpu_pct,
        cpu_cores=cores,
        total_ram_mb=total_ram,
        used_ram_mb=used_ram,
        available_ram_mb=avail_ram,
        ram_usage_percent=ram_percent,
        cuda_available=cuda_avail,
        gpu_count=gpu_count,
        gpu_name=gpu_name,
        total_vram_mb=total_vram,
        allocated_vram_mb=allocated_vram,
        free_vram_mb=free_vram,
        simulation_active=simulated_config.enabled,
        simulated_limits=simulated_config.to_dict() if simulated_config.enabled else None,
    )


def evaluate_resource_availability(
    required_ram_mb: int,
    required_vram_mb: int = 0,
    safety_margin_mb: int = 256,
) -> Tuple[bool, str, bool, Optional[str]]:
    """
    Evaluate if a model can be scheduled given current physical or simulated limits.

    Returns:
        (available: bool, message: str, is_simulated: bool, error_code: Optional[str])
    """
    telemetry = get_hardware_telemetry()

    # 1. Check Simulated Constrained-Resource Mode FIRST if active
    if simulated_config.enabled:
        sim_max_ram = simulated_config.simulated_max_ram_mb
        sim_max_vram = simulated_config.simulated_max_vram_mb

        if required_ram_mb > sim_max_ram:
            msg = (
                f"[SIMULATED_RESOURCE_LIMIT] Model requires {required_ram_mb} MB RAM, which exceeds "
                f"the simulated maximum allocation of {sim_max_ram} MB RAM. "
                f"Execution rejected to demonstrate resource scheduler constraint handling."
            )
            return False, msg, True, "MODEL_RESOURCE_UNAVAILABLE"

        if required_vram_mb > sim_max_vram:
            msg = (
                f"[SIMULATED_RESOURCE_LIMIT] Model requires {required_vram_mb} MB VRAM, which exceeds "
                f"the simulated maximum allocation of {sim_max_vram} MB VRAM."
            )
            return False, msg, True, "MODEL_RESOURCE_UNAVAILABLE"

    # 2. Check Real Physical Host Resources
    effective_avail_ram = max(0, telemetry.available_ram_mb - safety_margin_mb)
    if required_ram_mb > effective_avail_ram:
        msg = (
            f"Physical RAM constraint: required {required_ram_mb} MB exceeds safe available "
            f"{effective_avail_ram} MB (total free: {telemetry.available_ram_mb} MB, margin: {safety_margin_mb} MB)."
        )
        return False, msg, False, "MODEL_RESOURCE_UNAVAILABLE"

    if required_vram_mb > 0:
        if not telemetry.cuda_available:
            return False, "GPU acceleration requested but CUDA is not available on physical host.", False, "MODEL_RESOURCE_UNAVAILABLE"
        if required_vram_mb > telemetry.free_vram_mb:
            return False, f"Physical VRAM constraint: required {required_vram_mb} MB exceeds free {telemetry.free_vram_mb} MB.", False, "MODEL_RESOURCE_UNAVAILABLE"

    success_msg = f"Resource check passed: required {required_ram_mb} MB RAM fits in {telemetry.available_ram_mb} MB available headroom."
    if simulated_config.enabled:
        success_msg += f" (within SIMULATED_RESOURCE_LIMIT of {simulated_config.simulated_max_ram_mb} MB)"

    return True, success_msg, simulated_config.enabled, None
