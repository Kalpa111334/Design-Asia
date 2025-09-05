from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'task-vision-secret-key-2025')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="Task Vision API", version="1.0.0")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"

class TaskStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"

class TaskPriority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    role: UserRole
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: UserRole

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    user: User
    token: str

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    priority: TaskPriority
    status: TaskStatus = TaskStatus.NOT_STARTED
    assigned_to: Optional[str] = None  # employee ID
    assigned_by: str  # admin ID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None

class TaskCreate(BaseModel):
    title: str
    description: str
    priority: TaskPriority
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None

# Utility functions
async def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

async def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_jwt_token(user_id: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_data = await db.users.find_one({"id": user_id})
        if not user_data:
            raise HTTPException(status_code=401, detail="User not found")
            
        return User(**user_data)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Auth Routes
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = await hash_password(user_data.password)
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role
    )
    
    # Store in database
    user_dict = user.dict()
    user_dict['password'] = hashed_password
    await db.users.insert_one(user_dict)
    
    # Create token
    token = create_jwt_token(user.id, user.role.value)
    
    return UserResponse(user=user, token=token)

@api_router.post("/auth/login", response_model=UserResponse)
async def login(login_data: UserLogin):
    # Find user
    user_data = await db.users.find_one({"email": login_data.email})
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not await verify_password(login_data.password, user_data['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User(**{k: v for k, v in user_data.items() if k != 'password'})
    token = create_jwt_token(user.id, user.role.value)
    
    return UserResponse(user=user, token=token)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Task Routes
@api_router.post("/tasks", response_model=Task)
async def create_task(task_data: TaskCreate, admin_user: User = Depends(get_admin_user)):
    task = Task(
        title=task_data.title,
        description=task_data.description,
        priority=task_data.priority,
        assigned_to=task_data.assigned_to,
        assigned_by=admin_user.id,
        due_date=task_data.due_date,
        estimated_hours=task_data.estimated_hours
    )
    
    task_dict = task.dict()
    if task_dict.get('due_date'):
        task_dict['due_date'] = task_dict['due_date'].isoformat()
    if task_dict.get('created_at'):
        task_dict['created_at'] = task_dict['created_at'].isoformat()
        
    await db.tasks.insert_one(task_dict)
    return task

@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        # Admin sees all tasks
        tasks = await db.tasks.find().to_list(1000)
    else:
        # Employee sees only assigned tasks
        tasks = await db.tasks.find({"assigned_to": current_user.id}).to_list(1000)
    
    # Parse datetime fields
    for task in tasks:
        if task.get('created_at') and isinstance(task['created_at'], str):
            task['created_at'] = datetime.fromisoformat(task['created_at'])
        if task.get('due_date') and isinstance(task['due_date'], str):
            task['due_date'] = datetime.fromisoformat(task['due_date'])
        if task.get('completed_at') and isinstance(task['completed_at'], str):
            task['completed_at'] = datetime.fromisoformat(task['completed_at'])
    
    return [Task(**task) for task in tasks]

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str, current_user: User = Depends(get_current_user)):
    task_data = await db.tasks.find_one({"id": task_id})
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check permissions
    if current_user.role == UserRole.EMPLOYEE and task_data.get('assigned_to') != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Parse datetime fields
    if task_data.get('created_at') and isinstance(task_data['created_at'], str):
        task_data['created_at'] = datetime.fromisoformat(task_data['created_at'])
    if task_data.get('due_date') and isinstance(task_data['due_date'], str):
        task_data['due_date'] = datetime.fromisoformat(task_data['due_date'])
    if task_data.get('completed_at') and isinstance(task_data['completed_at'], str):
        task_data['completed_at'] = datetime.fromisoformat(task_data['completed_at'])
    
    return Task(**task_data)

@api_router.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task_update: TaskUpdate, current_user: User = Depends(get_current_user)):
    task_data = await db.tasks.find_one({"id": task_id})
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check permissions
    if current_user.role == UserRole.EMPLOYEE:
        if task_data.get('assigned_to') != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        # Employees can only update status and actual_hours
        allowed_fields = {'status', 'actual_hours'}
        update_data = {k: v for k, v in task_update.dict(exclude_unset=True).items() if k in allowed_fields}
    else:
        # Admins can update all fields
        update_data = task_update.dict(exclude_unset=True)
    
    # Handle completion
    if update_data.get('status') == TaskStatus.COMPLETED and task_data.get('status') != TaskStatus.COMPLETED:
        update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
    
    # Convert datetime fields
    for field in ['due_date', 'completed_at']:
        if field in update_data and isinstance(update_data[field], datetime):
            update_data[field] = update_data[field].isoformat()
    
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    
    # Return updated task
    updated_task_data = await db.tasks.find_one({"id": task_id})
    
    # Parse datetime fields
    for field in ['created_at', 'due_date', 'completed_at']:
        if updated_task_data.get(field) and isinstance(updated_task_data[field], str):
            updated_task_data[field] = datetime.fromisoformat(updated_task_data[field])
    
    return Task(**updated_task_data)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, admin_user: User = Depends(get_admin_user)):
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}

# User Routes
@api_router.get("/users", response_model=List[User])
async def get_users(admin_user: User = Depends(get_admin_user)):
    users = await db.users.find({}, {"password": 0}).to_list(1000)
    
    # Parse datetime fields
    for user in users:
        if user.get('created_at') and isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return [User(**user) for user in users]

@api_router.get("/employees", response_model=List[User])
async def get_employees(admin_user: User = Depends(get_admin_user)):
    employees = await db.users.find({"role": UserRole.EMPLOYEE}, {"password": 0}).to_list(1000)
    
    # Parse datetime fields
    for employee in employees:
        if employee.get('created_at') and isinstance(employee['created_at'], str):
            employee['created_at'] = datetime.fromisoformat(employee['created_at'])
    
    return [User(**employee) for employee in employees]

# Dashboard Stats Routes
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        total_tasks = await db.tasks.count_documents({})
        completed_tasks = await db.tasks.count_documents({"status": TaskStatus.COMPLETED})
        pending_tasks = await db.tasks.count_documents({"status": {"$ne": TaskStatus.COMPLETED}})
        total_employees = await db.users.count_documents({"role": UserRole.EMPLOYEE})
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "total_employees": total_employees
        }
    else:
        # Employee stats
        total_tasks = await db.tasks.count_documents({"assigned_to": current_user.id})
        completed_tasks = await db.tasks.count_documents({"assigned_to": current_user.id, "status": TaskStatus.COMPLETED})
        pending_tasks = await db.tasks.count_documents({"assigned_to": current_user.id, "status": {"$ne": TaskStatus.COMPLETED}})
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks
        }

# Include the router in the main app
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