"""
MediFusion AI — Seed Demo Cases Execution Script
Run with: python backend/seed_demo.py
"""
import sys
import pathlib
from dotenv import load_dotenv

backend_dir = pathlib.Path(__file__).resolve().parent
load_dotenv(backend_dir / ".env")
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.seeds.seed_demo_cases import seed_demo_cases

if __name__ == "__main__":
    print("=" * 60)
    print("MediFusion AI — Seeding Synthetic Demo Cases (Phase 18)")
    print("=" * 60)
    res = seed_demo_cases()
    print("=" * 60)
    print("Successfully generated Case A, Case B, and Case C!")
    print("=" * 60)
