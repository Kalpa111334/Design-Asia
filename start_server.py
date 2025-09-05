#!/usr/bin/env python3
"""
Startup script for Design Asia Task Vision API
"""

import os
import sys
import subprocess
from pathlib import Path

def main():
    """Start the server with proper configuration"""
    print("Starting Design Asia Task Vision API...")
    print("=" * 40)
    
    # Set default environment variables if not already set
    env = os.environ.copy()
    env.setdefault('MONGO_URL', 'mongodb://localhost:27017')
    env.setdefault('DB_NAME', 'task_vision')
    env.setdefault('JWT_SECRET', 'task-vision-secret-key-2025-secure')
    env.setdefault('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000')
    
    print(f"MongoDB URL: {env['MONGO_URL']}")
    print(f"Database: {env['DB_NAME']}")
    print(f"CORS Origins: {env['CORS_ORIGINS']}")
    print()
    
    # Check if MongoDB is running (optional)
    try:
        import pymongo
        client = pymongo.MongoClient(env['MONGO_URL'], serverSelectionTimeoutMS=1000)
        client.server_info()
        print("✓ MongoDB connection successful")
    except Exception as e:
        print(f"⚠ Warning: MongoDB connection failed: {e}")
        print("  Make sure MongoDB is running on the specified URL")
        print("  The server will still start but database operations will fail")
    
    print("\nStarting server...")
    print("Press Ctrl+C to stop the server")
    print("=" * 40)
    
    # Start the server
    try:
        subprocess.run([
            sys.executable, '-m', 'uvicorn', 
            'backend.server:app', 
            '--reload', 
            '--host', '0.0.0.0', 
            '--port', '8000'
        ], env=env)
    except KeyboardInterrupt:
        print("\n\nServer stopped by user")
    except Exception as e:
        print(f"\nError starting server: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

