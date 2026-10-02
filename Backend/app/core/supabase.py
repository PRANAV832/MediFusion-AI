from typing import Optional
from supabase import Client, ClientOptions, create_client
from app.core.config import settings
from app.core.exceptions import MediFusionException

_admin_client: Optional[Client] = None


def get_supabase_admin_client() -> Client:
    """Return backend-only privileged Supabase client with service_role privileges."""
    global _admin_client
    if _admin_client is not None:
        return _admin_client

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise MediFusionException(
            message="Supabase is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
            status_code=500,
        )

    _admin_client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
        options=ClientOptions(
            auto_refresh_token=False,
            persist_session=False,
        ),
    )
    return _admin_client


def get_supabase_user_client(access_token: str) -> Client:
    """Return a Supabase client executing queries under the user's authenticated context."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise MediFusionException(
            message="Supabase is not configured. Missing SUPABASE_URL or SUPABASE_ANON_KEY.",
            status_code=500,
        )

    client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options=ClientOptions(
            auto_refresh_token=False,
            persist_session=False,
            headers={"Authorization": f"Bearer {access_token}"},
        ),
    )
    return client
