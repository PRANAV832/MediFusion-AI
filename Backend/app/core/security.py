from typing import Any, Dict, Optional
from fastapi import Depends, Header, HTTPException, status
from app.core.supabase import get_supabase_admin_client


class AuthenticatedUser:
    def __init__(self, user_id: str, email: str, profile: Dict[str, Any], token: str):
        self.id = user_id
        self.email = email
        self.profile = profile
        self.token = token
        self.role = profile.get("role", "clinician")

    def __repr__(self) -> str:
        return f"<AuthenticatedUser {self.email} ({self.role})>"


async def get_current_user(
    authorization: Optional[str] = Header(None, description="Bearer token"),
) -> AuthenticatedUser:
    """Validate incoming Supabase JWT Bearer token and return authenticated user with profile."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]
    admin_client = get_supabase_admin_client()

    try:
        # Verify JWT with Supabase Auth
        user_response = admin_client.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = user_response.user
        user_id = str(user.id)
        email = user.email or ""

        # Fetch or ensure user profile exists
        profile_res = (
            admin_client.table("profiles")
            .select("*")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )

        profile = profile_res.data
        if not profile:
            # Upsert fallback if trigger didn't fire
            new_profile = {
                "id": user_id,
                "email": email,
                "full_name": (user.user_metadata or {}).get("full_name") or email.split("@")[0],
                "role": (user.user_metadata or {}).get("role") or "clinician",
            }
            insert_res = admin_client.table("profiles").upsert(new_profile).execute()
            profile = insert_res.data[0] if insert_res.data else new_profile

        return AuthenticatedUser(
            user_id=user_id,
            email=email,
            profile=profile,
            token=token,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication verification failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_role(allowed_roles: list[str]):
    """Authorization dependency verifying user has one of the allowed roles."""
    async def role_checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: User role '{user.role}' is not authorized. Required: {allowed_roles}",
            )
        return user

    return role_checker
