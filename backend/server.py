from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
import string
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'tempmail-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
CODE_EXPIRY_HOURS = 12

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create the main app
app = FastAPI(title="TempMail SaaS API")

# Create routers
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ============ MODELS ============

class VerifyCodeRequest(BaseModel):
    code: str

class VerifyCodeResponse(BaseModel):
    token: str
    expires_at: str
    email_address: str

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminLoginResponse(BaseModel):
    token: str
    username: str

class GenerateCodeRequest(BaseModel):
    expiry_hours: int = CODE_EXPIRY_HOURS

class AccessCodeResponse(BaseModel):
    id: str
    code: str
    expires_at: str
    used: bool
    used_at: Optional[str] = None
    created_at: str

class TempEmailResponse(BaseModel):
    id: str
    email_address: str
    created_at: str
    expires_at: str

class EmailMessageResponse(BaseModel):
    id: str
    to_email: str
    from_email: str
    subject: str
    body: str
    received_at: str
    is_read: bool = False

class MockEmailRequest(BaseModel):
    to_email: str
    from_email: str
    subject: str
    body: str

class StatsResponse(BaseModel):
    total_codes: int
    active_codes: int
    used_codes: int
    expired_codes: int
    total_emails: int
    total_messages: int

# ============ HELPERS ============

def generate_code(length: int = 8) -> str:
    """Generate alphanumeric access code"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

def generate_email_address() -> str:
    """Generate temporary email address"""
    prefix = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(10))
    return f"{prefix}@tempmail.local"

def create_token(data: dict, expires_delta: timedelta) -> str:
    """Create JWT token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from token"""
    token = credentials.credentials
    payload = verify_token(token)
    return payload

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current admin from token"""
    token = credentials.credentials
    payload = verify_token(token)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload

# ============ INIT ADMIN ============

@app.on_event("startup")
async def init_admin():
    """Create default admin if not exists"""
    admin = await db.admin_users.find_one({"username": "admin@botsmith.com"})
    if not admin:
        hashed = pwd_context.hash("admin123")
        await db.admin_users.insert_one({
            "id": str(uuid.uuid4()),
            "username": "admin@botsmith.com",
            "password_hash": hashed,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logging.info("Default admin created: admin@botsmith.com / admin123")

# ============ USER ENDPOINTS ============

@api_router.post("/verify-code", response_model=VerifyCodeResponse)
async def verify_code(request: VerifyCodeRequest):
    """Validate access code and create session"""
    code = request.code.upper().strip()
    
    # Find the code
    code_doc = await db.access_codes.find_one({"code": code}, {"_id": 0})
    
    if not code_doc:
        raise HTTPException(status_code=400, detail="Invalid access code")
    
    # Check if already used
    if code_doc.get("used"):
        raise HTTPException(status_code=400, detail="This code has already been used")
    
    # Check if expired
    expires_at = datetime.fromisoformat(code_doc["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="This code has expired")
    
    # Mark code as used
    await db.access_codes.update_one(
        {"code": code},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Generate temp email for this session
    email_id = str(uuid.uuid4())
    email_address = generate_email_address()
    
    await db.temp_emails.insert_one({
        "id": email_id,
        "email_address": email_address,
        "session_id": code_doc["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": code_doc["expires_at"]
    })
    
    # Create session token (expires when code expires)
    remaining_time = expires_at - datetime.now(timezone.utc)
    token = create_token(
        {"sub": code_doc["id"], "email": email_address, "role": "user"},
        remaining_time
    )
    
    return VerifyCodeResponse(
        token=token,
        expires_at=code_doc["expires_at"],
        email_address=email_address
    )

@api_router.post("/email/generate", response_model=TempEmailResponse)
async def generate_new_email(user = Depends(get_current_user)):
    """Generate a new temporary email address"""
    # Get session expiry from token
    exp_timestamp = user.get("exp")
    expires_at = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
    
    email_id = str(uuid.uuid4())
    email_address = generate_email_address()
    created_at = datetime.now(timezone.utc)
    
    await db.temp_emails.insert_one({
        "id": email_id,
        "email_address": email_address,
        "session_id": user["sub"],
        "created_at": created_at.isoformat(),
        "expires_at": expires_at.isoformat()
    })
    
    return TempEmailResponse(
        id=email_id,
        email_address=email_address,
        created_at=created_at.isoformat(),
        expires_at=expires_at.isoformat()
    )

@api_router.get("/emails", response_model=List[TempEmailResponse])
async def get_my_emails(user = Depends(get_current_user)):
    """Get all temp emails for current session"""
    emails = await db.temp_emails.find(
        {"session_id": user["sub"]},
        {"_id": 0}
    ).to_list(100)
    return emails

@api_router.get("/messages", response_model=List[EmailMessageResponse])
async def get_messages(user = Depends(get_current_user)):
    """Get all messages for user's email addresses"""
    # Get user's email addresses
    emails = await db.temp_emails.find(
        {"session_id": user["sub"]},
        {"email_address": 1, "_id": 0}
    ).to_list(100)
    
    email_addresses = [e["email_address"] for e in emails]
    
    # Get messages for these emails
    messages = await db.email_messages.find(
        {"to_email": {"$in": email_addresses}},
        {"_id": 0}
    ).sort("received_at", -1).to_list(100)
    
    return messages

@api_router.get("/messages/{message_id}", response_model=EmailMessageResponse)
async def get_message(message_id: str, user = Depends(get_current_user)):
    """Get a specific message"""
    message = await db.email_messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Mark as read
    await db.email_messages.update_one(
        {"id": message_id},
        {"$set": {"is_read": True}}
    )
    message["is_read"] = True
    
    return message

@api_router.delete("/messages/{message_id}")
async def delete_message(message_id: str, user = Depends(get_current_user)):
    """Delete a message"""
    result = await db.email_messages.delete_one({"id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Message deleted"}

# ============ ADMIN ENDPOINTS ============

@api_router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest):
    """Admin login"""
    admin = await db.admin_users.find_one({"username": request.username}, {"_id": 0})
    
    if not admin or not pwd_context.verify(request.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(
        {"sub": admin["id"], "username": admin["username"], "role": "admin"},
        timedelta(hours=24)
    )
    
    return AdminLoginResponse(token=token, username=admin["username"])

@api_router.post("/admin/generate-code", response_model=AccessCodeResponse)
async def generate_access_code(request: GenerateCodeRequest, admin = Depends(get_admin_user)):
    """Generate a new access code"""
    code_id = str(uuid.uuid4())
    code = generate_code()
    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(hours=request.expiry_hours)
    
    code_doc = {
        "id": code_id,
        "code": code,
        "expires_at": expires_at.isoformat(),
        "used": False,
        "used_at": None,
        "created_at": created_at.isoformat(),
        "created_by": admin["username"]
    }
    
    await db.access_codes.insert_one(code_doc)
    
    return AccessCodeResponse(
        id=code_id,
        code=code,
        expires_at=expires_at.isoformat(),
        used=False,
        used_at=None,
        created_at=created_at.isoformat()
    )

@api_router.get("/admin/codes", response_model=List[AccessCodeResponse])
async def get_all_codes(admin = Depends(get_admin_user)):
    """Get all access codes"""
    codes = await db.access_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return codes

@api_router.delete("/admin/codes/{code_id}")
async def revoke_code(code_id: str, admin = Depends(get_admin_user)):
    """Revoke/delete an access code"""
    result = await db.access_codes.delete_one({"id": code_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Code not found")
    return {"message": "Code revoked"}

@api_router.get("/admin/stats", response_model=StatsResponse)
async def get_stats(admin = Depends(get_admin_user)):
    """Get admin dashboard statistics"""
    now = datetime.now(timezone.utc).isoformat()
    
    total_codes = await db.access_codes.count_documents({})
    used_codes = await db.access_codes.count_documents({"used": True})
    
    # Get expired but unused codes
    expired_codes = await db.access_codes.count_documents({
        "used": False,
        "expires_at": {"$lt": now}
    })
    
    active_codes = total_codes - used_codes - expired_codes
    total_emails = await db.temp_emails.count_documents({})
    total_messages = await db.email_messages.count_documents({})
    
    return StatsResponse(
        total_codes=total_codes,
        active_codes=active_codes,
        used_codes=used_codes,
        expired_codes=expired_codes,
        total_emails=total_emails,
        total_messages=total_messages
    )

# ============ MOCK EMAIL ENDPOINT ============

@api_router.post("/mock-email")
async def receive_mock_email(request: MockEmailRequest):
    """Mock email receiver - simulates receiving an email"""
    # Check if target email exists
    email_doc = await db.temp_emails.find_one(
        {"email_address": request.to_email},
        {"_id": 0}
    )
    
    if not email_doc:
        raise HTTPException(status_code=404, detail="Email address not found")
    
    # Check if email is expired
    expires_at = datetime.fromisoformat(email_doc["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Email address has expired")
    
    # Store the message
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "to_email": request.to_email,
        "from_email": request.from_email,
        "subject": request.subject,
        "body": request.body,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False
    }
    
    await db.email_messages.insert_one(message_doc)
    
    return {"message": "Email received", "id": message_id}

@api_router.get("/")
async def root():
    return {"message": "TempMail SaaS API", "version": "1.0.0"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
