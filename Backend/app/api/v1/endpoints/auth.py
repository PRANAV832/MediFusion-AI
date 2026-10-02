from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_admin_client
from app.schemas.auth import AuthUserResponse, ProfileResponse, ProfileUpdateRequest

router = APIRouter()


@router.get("/me", response_model=AuthUserResponse, summary="Get currently authenticated clinician")
def get_me(user: AuthenticatedUser = Depends(get_current_user)) -> AuthUserResponse:
    """Return verified user and profile data from Supabase Auth."""
    return AuthUserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        profile=ProfileResponse(**user.profile),
    )


@router.patch("/profile", response_model=ProfileResponse, summary="Update clinician profile")
def update_profile(
    update_data: ProfileUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ProfileResponse:
    """Update profile fields for the authenticated clinician."""
    admin_client = get_supabase_admin_client()

    payload = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not payload:
        return ProfileResponse(**user.profile)

    res = (
        admin_client.table("profiles")
        .update(payload)
        .eq("id", user.id)
        .execute()
    )

    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found or update failed",
        )

    return ProfileResponse(**res.data[0])
