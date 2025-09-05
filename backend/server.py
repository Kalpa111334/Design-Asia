from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
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
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'task_vision')

# Initialize MongoDB client with error handling
try:
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    print(f"✓ Connected to MongoDB at {mongo_url}")
except Exception as e:
    print(f"⚠ Warning: MongoDB connection failed: {e}")
    print("  The server will start but database operations will fail")
    print("  Make sure MongoDB is running on the specified URL")
    client = None
    db = None

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'task-vision-secret-key-2025-secure')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True
)

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

class MessageType(str, Enum):
    TEXT = "text"
    SYSTEM = "system"
    NOTIFICATION = "notification"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    role: UserRole
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    is_online: bool = False
    last_seen: Optional[datetime] = None

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
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    sender_name: str
    sender_role: UserRole
    content: str
    message_type: MessageType = MessageType.TEXT
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    task_id: Optional[str] = None

class MessageCreate(BaseModel):
    content: str
    message_type: MessageType = MessageType.TEXT
    task_id: Optional[str] = None

class Activity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    action: str
    description: str
    task_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    content: str
    task_id: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Global variable to store connected users
connected_users = {}

# Database connectivity check
def check_db_connection():
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available. Please check MongoDB connection.")

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

async def create_activity(user_id: str, user_name: str, action: str, description: str, task_id: str = None):
    """Create activity log entry"""
    activity = Activity(
        user_id=user_id,
        user_name=user_name,
        action=action,
        description=description,
        task_id=task_id
    )
    await db.activities.insert_one(activity.dict())
    
    # Emit to all connected users
    await sio.emit('activity_created', activity.dict())

async def create_notification(user_id: str, title: str, content: str, task_id: str = None):
    """Create notification for user"""
    notification = Notification(
        user_id=user_id,
        title=title,
        content=content,
        task_id=task_id
    )
    await db.notifications.insert_one(notification.dict())
    
    # Emit to specific user if online
    user_session = connected_users.get(user_id)
    if user_session:
        await sio.emit('notification', notification.dict(), room=user_session)

# Socket.IO Events
@sio.event
async def connect(sid, environ, auth):
    print(f"Client connected: {sid}")
    
    # Extract token from auth
    if auth and 'token' in auth:
        try:
            payload = jwt.decode(auth['token'], JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get('user_id')
            
            if user_id:
                connected_users[user_id] = sid
                
                # Update user online status
                await db.users.update_one(
                    {"id": user_id}, 
                    {"$set": {"is_online": True, "last_seen": datetime.now(timezone.utc).isoformat()}}
                )
                
                # Emit to all users that someone came online
                user_data = await db.users.find_one({"id": user_id})
                if user_data:
                    await sio.emit('user_online', {
                        'user_id': user_id,
                        'name': user_data['name'],
                        'role': user_data['role']
                    })
                
                print(f"User {user_id} connected")
        except jwt.InvalidTokenError:
            print("Invalid token in socket connection")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")
    
    # Find and remove user from connected_users
    user_id = None
    for uid, session_id in connected_users.items():
        if session_id == sid:
            user_id = uid
            break
    
    if user_id:
        del connected_users[user_id]
        
        # Update user offline status
        await db.users.update_one(
            {"id": user_id}, 
            {"$set": {"is_online": False, "last_seen": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Emit to all users that someone went offline
        user_data = await db.users.find_one({"id": user_id})
        if user_data:
            await sio.emit('user_offline', {
                'user_id': user_id,
                'name': user_data['name'],
                'role': user_data['role']
            })

@sio.event
async def send_message(sid, data):
    """Handle chat messages"""
    try:
        # Find user by session ID
        user_id = None
        for uid, session_id in connected_users.items():
            if session_id == sid:
                user_id = uid
                break
        
        if not user_id:
            return
        
        user_data = await db.users.find_one({"id": user_id})
        if not user_data:
            return
        
        message = Message(
            sender_id=user_id,
            sender_name=user_data['name'],
            sender_role=user_data['role'],
            content=data['content'],
            message_type=data.get('message_type', MessageType.TEXT),
            task_id=data.get('task_id')
        )
        
        # Store message in database
        message_dict = message.dict()
        message_dict['timestamp'] = message_dict['timestamp'].isoformat()
        await db.messages.insert_one(message_dict)
        
        # Emit to all connected users
        await sio.emit('message_received', message_dict)
        
    except Exception as e:
        print(f"Error handling message: {e}")

@sio.event
async def join_task_room(sid, data):
    """Join task-specific room for real-time updates"""
    task_id = data.get('task_id')
    if task_id:
        await sio.enter_room(sid, f"task_{task_id}")

@sio.event
async def leave_task_room(sid, data):
    """Leave task-specific room"""
    task_id = data.get('task_id')
    if task_id:
        await sio.leave_room(sid, f"task_{task_id}")

# Auth Routes
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    check_db_connection()
    
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
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    await db.users.insert_one(user_dict)
    
    # Create token
    token = create_jwt_token(user.id, user.role.value)
    
    # Create activity
    await create_activity(user.id, user.name, "user_registered", f"{user.name} joined as {user.role}")
    
    return UserResponse(user=user, token=token)

@api_router.post("/auth/login", response_model=UserResponse)
async def login(login_data: UserLogin):
    check_db_connection()
    
    # Find user
    user_data = await db.users.find_one({"email": login_data.email})
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not await verify_password(login_data.password, user_data['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Parse datetime fields
    if user_data.get('created_at') and isinstance(user_data['created_at'], str):
        user_data['created_at'] = datetime.fromisoformat(user_data['created_at'])
    
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
    for field in ['due_date', 'created_at', 'updated_at', 'completed_at']:
        if task_dict.get(field):
            task_dict[field] = task_dict[field].isoformat()
        
    await db.tasks.insert_one(task_dict)
    
    # Create activity
    assigned_user = None
    if task.assigned_to:
        assigned_user_data = await db.users.find_one({"id": task.assigned_to})
        assigned_user = assigned_user_data['name'] if assigned_user_data else "Unknown"
    
    activity_desc = f"Created task '{task.title}'"
    if assigned_user:
        activity_desc += f" and assigned to {assigned_user}"
    
    await create_activity(
        admin_user.id, 
        admin_user.name, 
        "task_created", 
        activity_desc,
        task.id
    )
    
    # Send notification to assigned employee
    if task.assigned_to:
        await create_notification(
            task.assigned_to,
            "New Task Assigned",
            f"You have been assigned a new {task.priority} priority task: {task.title}",
            task.id
        )
    
    # Emit real-time update
    await sio.emit('task_created', task_dict)
    
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
        for field in ['created_at', 'due_date', 'completed_at', 'updated_at']:
            if task.get(field) and isinstance(task[field], str):
                task[field] = datetime.fromisoformat(task[field])
    
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
    for field in ['created_at', 'due_date', 'completed_at', 'updated_at']:
        if task_data.get(field) and isinstance(task_data[field], str):
            task_data[field] = datetime.fromisoformat(task_data[field])
    
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
    
    # Add updated timestamp
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # Handle completion
    if update_data.get('status') == TaskStatus.COMPLETED and task_data.get('status') != TaskStatus.COMPLETED:
        update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
    
    # Convert datetime fields
    for field in ['due_date', 'completed_at']:
        if field in update_data and isinstance(update_data[field], datetime):
            update_data[field] = update_data[field].isoformat()
    
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    
    # Get updated task
    updated_task_data = await db.tasks.find_one({"id": task_id})
    
    # Parse datetime fields
    for field in ['created_at', 'due_date', 'completed_at', 'updated_at']:
        if updated_task_data.get(field) and isinstance(updated_task_data[field], str):
            updated_task_data[field] = datetime.fromisoformat(updated_task_data[field])
    
    # Create activity
    if 'status' in update_data:
        old_status = task_data.get('status', 'not_started')
        new_status = update_data['status']
        if isinstance(new_status, TaskStatus):
            new_status = new_status.value
        
        if old_status != new_status:
            await create_activity(
                current_user.id,
                current_user.name,
                "task_status_changed",
                f"Changed task '{task_data['title']}' status from {old_status.replace('_', ' ').title()} to {new_status.replace('_', ' ').title()}",
                task_id
            )
            
            # Send notification to admin if employee updated status
            if current_user.role == UserRole.EMPLOYEE:
                admin_users = await db.users.find({"role": UserRole.ADMIN}).to_list(10)
                for admin in admin_users:
                    await create_notification(
                        admin['id'],
                        "Task Status Updated",
                        f"{current_user.name} updated task '{task_data['title']}' to {new_status.replace('_', ' ').title()}",
                        task_id
                    )
    
    # Emit real-time update
    updated_task_dict = updated_task_data.copy()
    for field in ['created_at', 'due_date', 'completed_at', 'updated_at']:
        if updated_task_dict.get(field) and isinstance(updated_task_dict[field], datetime):
            updated_task_dict[field] = updated_task_dict[field].isoformat()
    
    await sio.emit('task_updated', updated_task_dict)
    await sio.emit('task_updated', updated_task_dict, room=f"task_{task_id}")
    
    return Task(**updated_task_data)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, admin_user: User = Depends(get_admin_user)):
    task_data = await db.tasks.find_one({"id": task_id})
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Create activity
    await create_activity(
        admin_user.id,
        admin_user.name,
        "task_deleted",
        f"Deleted task '{task_data['title']}'",
        task_id
    )
    
    # Emit real-time update
    await sio.emit('task_deleted', {"task_id": task_id})
    
    return {"message": "Task deleted successfully"}

# User Routes
@api_router.get("/users", response_model=List[User])
async def get_users(admin_user: User = Depends(get_admin_user)):
    users = await db.users.find({}, {"password": 0}).to_list(1000)
    
    # Parse datetime fields
    for user in users:
        for field in ['created_at', 'last_seen']:
            if user.get(field) and isinstance(user[field], str):
                user[field] = datetime.fromisoformat(user[field])
    
    return [User(**user) for user in users]

@api_router.get("/employees", response_model=List[User])
async def get_employees(admin_user: User = Depends(get_admin_user)):
    employees = await db.users.find({"role": UserRole.EMPLOYEE}, {"password": 0}).to_list(1000)
    
    # Parse datetime fields
    for employee in employees:
        for field in ['created_at', 'last_seen']:
            if employee.get(field) and isinstance(employee[field], str):
                employee[field] = datetime.fromisoformat(employee[field])
    
    return [User(**employee) for employee in employees]

# Chat Routes
@api_router.get("/messages")
async def get_messages(current_user: User = Depends(get_current_user), limit: int = 100):
    messages = await db.messages.find().sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Parse datetime fields and reverse for chronological order
    for message in messages:
        if message.get('timestamp') and isinstance(message['timestamp'], str):
            message['timestamp'] = datetime.fromisoformat(message['timestamp'])
    
    return list(reversed(messages))

@api_router.post("/messages")
async def send_message_api(message_data: MessageCreate, current_user: User = Depends(get_current_user)):
    message = Message(
        sender_id=current_user.id,
        sender_name=current_user.name,
        sender_role=current_user.role,
        content=message_data.content,
        message_type=message_data.message_type,
        task_id=message_data.task_id
    )
    
    # Store message in database
    message_dict = message.dict()
    message_dict['timestamp'] = message_dict['timestamp'].isoformat()
    await db.messages.insert_one(message_dict)
    
    # Emit to all connected users
    await sio.emit('message_received', message_dict)
    
    return message

# Activity Routes
@api_router.get("/activities")
async def get_activities(current_user: User = Depends(get_current_user), limit: int = 50):
    activities = await db.activities.find().sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Parse datetime fields
    for activity in activities:
        if activity.get('timestamp') and isinstance(activity['timestamp'], str):
            activity['timestamp'] = datetime.fromisoformat(activity['timestamp'])
    
    return activities

# Notification Routes
@api_router.get("/notifications")
async def get_notifications(current_user: User = Depends(get_current_user)):
    notifications = await db.notifications.find({"user_id": current_user.id}).sort("created_at", -1).to_list(100)
    
    # Parse datetime fields
    for notification in notifications:
        if notification.get('created_at') and isinstance(notification['created_at'], str):
            notification['created_at'] = datetime.fromisoformat(notification['created_at'])
    
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"is_read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

# Dashboard Stats Routes
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        total_tasks = await db.tasks.count_documents({})
        completed_tasks = await db.tasks.count_documents({"status": TaskStatus.COMPLETED})
        pending_tasks = await db.tasks.count_documents({"status": {"$ne": TaskStatus.COMPLETED}})
        total_employees = await db.users.count_documents({"role": UserRole.EMPLOYEE})
        online_employees = await db.users.count_documents({"role": UserRole.EMPLOYEE, "is_online": True})
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "total_employees": total_employees,
            "online_employees": online_employees
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

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)

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

# Export the socket app instead of the regular app for Socket.IO support
app = socket_app