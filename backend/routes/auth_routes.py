from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends, Request, Response
from pydantic import BaseModel, Field

from config.db_config import get_connection
from config.settings import (
    MASTER_DB,
    DB_TABLES,
    ALL_ROLES,
    SINGLETON_ROLES,
    AUTO_GRANTED_ROLES,
    DEFAULT_ROLE,
    COOKIE_SECURE,
    COOKIE_SAMESITE,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from utils.auth_helper import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ─────────────────────────────────────────────────────────────────────────────
# Cookie Helpers: Supports both HTTP (local dev) and HTTPS (cloud)
# ─────────────────────────────────────────────────────────────────────────────
def is_request_https(request: Request) -> bool:
    """Check if the request came over HTTPS, accounting for cloud reverse proxies."""
    if request.url.scheme == "https":
        return True
    proto = request.headers.get("x-forwarded-proto", "")
    return proto.lower() == "https"


def set_refresh_cookie(response: Response, refresh_token: str, request: Request):
    """
    Set HttpOnly refresh token cookie.
    - httponly=True: Inaccessible via JS document.cookie (protects against XSS)
    - secure=True only on HTTPS; secure=False on HTTP (permits local dev testing)
    - samesite="lax" (or "none" if secure on cross-origin cloud)
    """
    https_active = is_request_https(request)
    if COOKIE_SECURE == "auto":
        secure_flag = https_active
    else:
        secure_flag = COOKIE_SECURE.lower() == "true"

    samesite_flag = "none" if (secure_flag and COOKIE_SAMESITE == "none") else "lax"

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure_flag,
        samesite=samesite_flag,
        path="/",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


def clear_refresh_cookie(response: Response, request: Request):
    """Erase the HttpOnly refresh token cookie on logout."""
    https_active = is_request_https(request)
    if COOKIE_SECURE == "auto":
        secure_flag = https_active
    else:
        secure_flag = COOKIE_SECURE.lower() == "true"

    samesite_flag = "none" if (secure_flag and COOKIE_SAMESITE == "none") else "lax"

    response.delete_cookie(
        key="refresh_token",
        path="/",
        secure=secure_flag,
        samesite=samesite_flag,
        httponly=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Request & Response Schemas
# ─────────────────────────────────────────────────────────────────────────────
class SignUpRequest(BaseModel):
    phone_number: str = Field(..., min_length=7, max_length=20, description="Mandatory phone number")
    password: str = Field(..., min_length=6, max_length=100, description="Mandatory password")
    user_name: str = Field(..., min_length=2, max_length=100, description="Mandatory user name")
    email: Optional[str] = Field(None, max_length=255, description="Optional email address")
    role: str = Field(default=DEFAULT_ROLE, description="Requested role (e.g. user, manager, admin, superadmin)")


class LoginRequest(BaseModel):
    phone_number: str = Field(..., min_length=1, max_length=255, description="Phone number or registered email address")
    password: str = Field(..., min_length=1, max_length=100, description="Password")


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = Field(None, description="Optional fallback if not sent in HttpOnly cookie")


class UserResponse(BaseModel):
    phone_number: str
    user_name: str
    email: Optional[str] = None
    role: str = "user"
    is_granted: bool = False


class AuthResponse(BaseModel):
    status: str
    message: str
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserResponse


class RefreshResponse(BaseModel):
    status: str
    message: str
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AvailableRolesResponse(BaseModel):
    available_roles: List[str]
    all_roles: List[str]


class GrantAccessRequest(BaseModel):
    phone_number: str
    is_granted: bool


# ─────────────────────────────────────────────────────────────────────────────
# Role Availability
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/available-roles", response_model=AvailableRolesResponse)
def get_available_roles():
    conn = get_connection(MASTER_DB)
    if conn is None:
        return AvailableRolesResponse(
            available_roles=[r for r in ALL_ROLES if r not in SINGLETON_ROLES],
            all_roles=ALL_ROLES,
        )

    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        format_strings = ','.join(['%s'] * len(SINGLETON_ROLES))
        query = f"SELECT DISTINCT role FROM {DB_TABLES['users']} WHERE role IN ({format_strings})"
        cursor.execute(query, tuple(SINGLETON_ROLES))
        existing_singleton_rows = cursor.fetchall()
        existing_singletons = {row["role"].lower() for row in existing_singleton_rows if row.get("role")}

        available = [r for r in ALL_ROLES if r.lower() not in existing_singletons]

        return AvailableRolesResponse(
            available_roles=available,
            all_roles=ALL_ROLES,
        )
    except Exception:
        return AvailableRolesResponse(
            available_roles=[r for r in ALL_ROLES if r not in SINGLETON_ROLES],
            all_roles=ALL_ROLES,
        )
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None and conn.is_connected():
            conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# User Signup
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(data: SignUpRequest, response: Response, request: Request):
    conn = get_connection(MASTER_DB)
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable, please try again later"
        )

    phone_clean = data.phone_number.strip()
    if "@" in phone_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid phone number (e.g. 9876543210) in the Phone Number field, not an email address."
        )

    name_clean = data.user_name.strip()
    email_clean = data.email.strip() if data.email and data.email.strip() else None
    role_clean = data.role.strip().lower()

    if role_clean not in [r.lower() for r in ALL_ROLES]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Allowed roles are: {', '.join(ALL_ROLES)}"
        )

    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)

        query_check = f"SELECT phone_number FROM {DB_TABLES['users']} WHERE phone_number = %s"
        cursor.execute(query_check, (phone_clean,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this phone number is already registered"
            )

        if role_clean in [s.lower() for s in SINGLETON_ROLES]:
            cursor.execute(f"SELECT COUNT(*) as cnt FROM {DB_TABLES['users']} WHERE LOWER(role) = %s", (role_clean,))
            res = cursor.fetchone()
            if res and res.get("cnt", 0) >= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A '{role_clean}' account already exists. Only 1 {role_clean} is permitted."
                )

        is_granted = True if role_clean in [a.lower() for a in AUTO_GRANTED_ROLES] else False

        hashed_pwd = hash_password(data.password)

        insert_query = (
            f"INSERT INTO {DB_TABLES['users']} (phone_number, password, user_name, email, role, isGranted) "
            f"VALUES (%s, %s, %s, %s, %s, %s)"
        )
        cursor.execute(insert_query, (phone_clean, hashed_pwd, name_clean, email_clean, role_clean, is_granted))
        conn.commit()

        user_info = UserResponse(
            phone_number=phone_clean,
            user_name=name_clean,
            email=email_clean,
            role=role_clean,
            is_granted=is_granted,
        )

        if is_granted:
            token_payload = {
                "sub": phone_clean,
                "phone_number": phone_clean,
                "user_name": name_clean,
                "email": email_clean,
                "role": role_clean,
                "is_granted": True,
            }
            access_token = create_access_token(token_payload)
            refresh_token = create_refresh_token({
                "sub": phone_clean,
                "phone_number": phone_clean,
                "role": role_clean,
            })

            # Store refresh token in secure HttpOnly cookie
            set_refresh_cookie(response, refresh_token, request)

            return AuthResponse(
                status="success",
                message=f"Account created successfully with role '{role_clean}'",
                access_token=access_token,
                refresh_token=None,  # Kept inside HttpOnly cookie
                token_type="bearer",
                user=user_info,
            )

        return AuthResponse(
            status="waiting_approval",
            message="Registration successful! Your account is on the waiting list awaiting approval from an administrator.",
            access_token=None,
            refresh_token=None,
            token_type="bearer",
            user=user_info,
        )

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register user: {str(e)}"
        )
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None and conn.is_connected():
            conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# User Login
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, response: Response, request: Request):
    conn = get_connection(MASTER_DB)
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable, please try again later"
        )

    identifier = data.phone_number.strip()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)

        query = (
            f"SELECT phone_number, password, user_name, email, role, isGranted "
            f"FROM {DB_TABLES['users']} WHERE phone_number = %s OR email = %s"
        )
        cursor.execute(query, (identifier, identifier))
        user_row = cursor.fetchone()

        if not user_row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid phone number/email or password"
            )

        stored_hash = user_row.get("password")
        if not stored_hash or not verify_password(data.password, stored_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid phone number or password"
            )

        user_role = (user_row.get("role") or "user").lower()
        is_granted = bool(user_row.get("isGranted", False))

        if not is_granted and user_role not in [a.lower() for a in AUTO_GRANTED_ROLES]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access not granted. Your account is on the waiting list awaiting approval from an administrator."
            )

        token_payload = {
            "sub": user_row["phone_number"],
            "phone_number": user_row["phone_number"],
            "user_name": user_row["user_name"],
            "email": user_row.get("email"),
            "role": user_role,
            "is_granted": is_granted,
        }
        access_token = create_access_token(token_payload)
        refresh_token = create_refresh_token({
            "sub": user_row["phone_number"],
            "phone_number": user_row["phone_number"],
            "role": user_role,
        })

        # Store refresh token in secure HttpOnly cookie
        set_refresh_cookie(response, refresh_token, request)

        return AuthResponse(
            status="success",
            message="Login successful",
            access_token=access_token,
            refresh_token=None,  # Stored securely in HttpOnly cookie
            token_type="bearer",
            user=UserResponse(
                phone_number=user_row["phone_number"],
                user_name=user_row["user_name"],
                email=user_row.get("email"),
                role=user_role,
                is_granted=is_granted,
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during authentication: {str(e)}"
        )
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None and conn.is_connected():
            conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Token Renewal (Refresh via HttpOnly Cookie)
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/refresh", response_model=RefreshResponse)
def refresh_token_endpoint(request: Request, response: Response, data: Optional[RefreshRequest] = None):
    """
    Exchanges the HttpOnly refresh token cookie for a brand new 15-minute access token.
    Works automatically over both HTTP and HTTPS.
    """
    # 1. Retrieve refresh token from HttpOnly cookie (or fallback from body if provided)
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token and data and data.refresh_token:
        refresh_token = data.refresh_token

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired: No refresh token found. Please log in again."
        )

    payload = decode_refresh_token(refresh_token)
    phone_number = payload.get("phone_number") or payload.get("sub")

    if not phone_number:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload"
        )

    conn = get_connection(MASTER_DB)
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable, please try again later"
        )

    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        query = f"SELECT phone_number, user_name, email, role, isGranted FROM {DB_TABLES['users']} WHERE phone_number = %s"
        cursor.execute(query, (phone_number,))
        user_row = cursor.fetchone()

        if not user_row:
            clear_refresh_cookie(response, request)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account no longer exists"
            )

        user_role = (user_row.get("role") or "user").lower()
        is_granted = bool(user_row.get("isGranted", False))

        if not is_granted and user_role not in [a.lower() for a in AUTO_GRANTED_ROLES]:
            clear_refresh_cookie(response, request)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access has been revoked or is pending approval."
            )

        new_access_token = create_access_token({
            "sub": user_row["phone_number"],
            "phone_number": user_row["phone_number"],
            "user_name": user_row["user_name"],
            "email": user_row.get("email"),
            "role": user_role,
            "is_granted": is_granted,
        })

        # Rotate refresh token in HttpOnly cookie
        new_refresh_token = create_refresh_token({
            "sub": user_row["phone_number"],
            "phone_number": user_row["phone_number"],
            "role": user_role,
        })
        set_refresh_cookie(response, new_refresh_token, request)

        return RefreshResponse(
            status="success",
            message="Token refreshed successfully",
            access_token=new_access_token,
            token_type="bearer",
            user=UserResponse(
                phone_number=user_row["phone_number"],
                user_name=user_row["user_name"],
                email=user_row.get("email"),
                role=user_role,
                is_granted=is_granted,
            ),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None and conn.is_connected():
            conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# User Logout: Clears HttpOnly Cookie
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/logout")
def logout(response: Response, request: Request):
    """Clear HttpOnly refresh cookie on server."""
    clear_refresh_cookie(response, request)
    return {"status": "success", "message": "Logged out successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# User Profile
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
def get_profile(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        phone_number=current_user.get("phone_number", ""),
        user_name=current_user.get("user_name", ""),
        email=current_user.get("email"),
        role=current_user.get("role", "user"),
        is_granted=bool(current_user.get("is_granted", True)),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Admin / SuperAdmin Access Management Endpoints
# ─────────────────────────────────────────────────────────────────────────────
def require_admin(current_user: dict = Depends(get_current_user)):
    role = (current_user.get("role") or "").lower()
    if role not in ["admin", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: Administrator or Superadmin role required."
        )
    return current_user


@router.get("/users", response_model=List[UserResponse])
def list_all_users(admin_user: dict = Depends(require_admin)):
    conn = get_connection(MASTER_DB)
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable"
        )

    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        query = (
            f"SELECT phone_number, user_name, email, role, isGranted "
            f"FROM {DB_TABLES['users']} "
            f"ORDER BY isGranted ASC, role ASC, user_name ASC"
        )
        cursor.execute(query)
        rows = cursor.fetchall()
        return [
            UserResponse(
                phone_number=r["phone_number"],
                user_name=r["user_name"],
                email=r.get("email"),
                role=r.get("role") or "user",
                is_granted=bool(r.get("isGranted", False)),
            )
            for r in rows
        ]
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None and conn.is_connected():
            conn.close()


@router.post("/users/grant")
def grant_user_access(data: GrantAccessRequest, admin_user: dict = Depends(require_admin)):
    conn = get_connection(MASTER_DB)
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable"
        )

    target_phone = data.phone_number.strip()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute(f"SELECT phone_number, role, isGranted FROM {DB_TABLES['users']} WHERE phone_number = %s", (target_phone,))
        target_user = cursor.fetchone()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        target_role = (target_user.get("role") or "").lower()
        caller_role = (admin_user.get("role") or "").lower()

        # Admin can NEVER modify or revoke Super Admin
        if target_role == "superadmin" and caller_role != "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins can never modify Super Admin permissions."
            )

        update_query = f"UPDATE {DB_TABLES['users']} SET isGranted = %s WHERE phone_number = %s"
        cursor.execute(update_query, (data.is_granted, target_phone))
        conn.commit()

        action = "granted" if data.is_granted else "revoked"
        return {
            "status": "success",
            "message": f"Access successfully {action} for user {target_phone}."
        }
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user access: {str(e)}"
        )
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None and conn.is_connected():
            conn.close()


@router.delete("/users/{phone_number}")
def delete_user(phone_number: str, admin_user: dict = Depends(require_admin)):
    conn = get_connection(MASTER_DB)
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable"
        )

    target_phone = phone_number.strip()
    if target_phone == admin_user.get("phone_number"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account."
        )

    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(f"SELECT phone_number, role FROM {DB_TABLES['users']} WHERE phone_number = %s", (target_phone,))
        target_user = cursor.fetchone()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        target_role = (target_user.get("role") or "").lower()
        caller_role = (admin_user.get("role") or "").lower()

        # Rule 1: Admin can NEVER delete the Super Admin
        if target_role == "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins can never delete the Super Admin."
            )

        # Rule 2: If target is Admin, only Super Admin has permission to delete them
        if target_role == "admin" and caller_role != "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only a Super Admin has permission to delete an Admin account."
            )

        # Super Admin can delete admin and all other users; Admin can delete manager & user
        cursor.execute(f"DELETE FROM {DB_TABLES['users']} WHERE phone_number = %s", (target_phone,))
        conn.commit()

        return {
            "status": "success",
            "message": f"User {target_phone} ({target_role.upper()}) deleted successfully."
        }
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None and conn.is_connected():
            conn.close()
