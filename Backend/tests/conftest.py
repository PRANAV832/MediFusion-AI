import os
import pathlib
import pytest
from dotenv import load_dotenv

# Ensure backend .env is loaded
env_path = pathlib.Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

if not os.environ.get("SUPABASE_URL"):
    os.environ["SUPABASE_URL"] = "https://mock-test-project.supabase.co"
if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "mock-service-role-key-for-unit-testing"
if not os.environ.get("SUPABASE_ANON_KEY"):
    os.environ["SUPABASE_ANON_KEY"] = "mock-anon-key-for-unit-testing"

from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client
