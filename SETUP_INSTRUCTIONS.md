# Design Asia Task Vision API - Setup Instructions

## Overview
This is a FastAPI-based task management system with real-time features using WebSockets and MongoDB.

## Prerequisites
- Python 3.8 or higher
- MongoDB (local or cloud instance)

## Quick Setup

### 1. Install Dependencies
```bash
pip install -r backend/requirements.txt
```

### 2. Configure Environment Variables
Create a `.env` file in the project root with the following variables:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=task_vision
JWT_SECRET=your-secure-secret-key-here
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
```

### 3. Start the Server
```bash
python start_server.py
```

Or manually:
```bash
python -m uvicorn backend.server:app --reload --host 0.0.0.0 --port 8000
```

## Features
- **FastAPI REST API** with automatic OpenAPI documentation
- **Real-time WebSocket communication** using Socket.IO
- **MongoDB integration** with Motor async driver
- **JWT authentication** with role-based access control
- **Task management** with status tracking and assignments
- **Real-time chat system** for team communication
- **Activity logging** and notifications
- **Admin and Employee dashboards**

## API Documentation
Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Project Structure
```
├── backend/
│   ├── server.py          # Main FastAPI application
│   └── requirements.txt   # Python dependencies
├── frontend/              # React frontend (separate setup)
├── setup.py              # Python package setup
├── start_server.py       # Server startup script
└── SETUP_INSTRUCTIONS.md # This file
```

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running on the specified URL
- Check if the database name is correct
- Verify network connectivity

### Port Already in Use
- Change the port in the startup command: `--port 8001`
- Or kill the process using port 8000

### Environment Variables
- All environment variables have sensible defaults
- The server will work without a `.env` file using default values
- For production, always set secure values for JWT_SECRET

## Development
- The server runs with `--reload` for development
- Changes to Python files will automatically restart the server
- Check the console for detailed error messages

## Production Deployment
- Set secure environment variables
- Use a production ASGI server like Gunicorn with Uvicorn workers
- Configure proper CORS origins
- Use a production MongoDB instance
- Set up proper logging and monitoring

