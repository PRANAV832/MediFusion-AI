from typing import Any, Dict, Optional
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError


class MediFusionException(Exception):
    """Base exception for MediFusion application errors."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ModelResourceUnavailableException(MediFusionException):
    """Raised when host or simulated hardware resources are insufficient to schedule inference."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=details or {"error_code": "MODEL_RESOURCE_UNAVAILABLE"},
        )


async def medifusion_exception_handler(request: Request, exc: MediFusionException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.message,
                "type": exc.__class__.__name__,
                "details": exc.details,
            }
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.detail if isinstance(exc.detail, str) else "HTTP error",
                "type": "HTTPException",
                "details": exc.detail if not isinstance(exc.detail, str) else {},
            }
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    formatted_errors = []
    clean_details = []
    for err in exc.errors():
        loc_parts = [str(l) for l in err.get("loc", []) if l != "body"]
        loc = " -> ".join(loc_parts)
        msg = err.get("msg", "Invalid value")
        formatted_errors.append(f"{loc}: {msg}" if loc else msg)
        clean_details.append({
            "loc": [str(l) for l in err.get("loc", [])],
            "msg": msg,
            "type": err.get("type", "validation_error"),
        })

    summary_msg = (
        f"Validation error: {'; '.join(formatted_errors)}"
        if formatted_errors
        else "Validation error in request parameters or body"
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "message": summary_msg,
                "type": "ValidationError",
                "details": clean_details,
            }
        },
    )

