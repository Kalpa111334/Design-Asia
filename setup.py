#!/usr/bin/env python3
"""
Setup script for Design Asia Task Vision API
"""

from setuptools import setup, find_packages
import os
import sys

# Read the README file
def read_readme():
    try:
        with open("README.md", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "Design Asia Task Vision API"

# Read requirements
def read_requirements():
    try:
        with open("backend/requirements.txt", "r", encoding="utf-8") as f:
            return [line.strip() for line in f if line.strip() and not line.startswith("#")]
    except FileNotFoundError:
        return []

# Check if we're in the right directory
if not os.path.exists("backend/server.py"):
    print("Error: Please run this script from the project root directory")
    print("Current directory:", os.getcwd())
    sys.exit(1)

setup(
    name="design-asia-task-vision",
    version="1.0.0",
    description="Task Vision API for Design Asia - A real-time task management system",
    long_description=read_readme(),
    long_description_content_type="text/markdown",
    author="Design Asia Team",
    author_email="team@designasia.com",
    url="https://github.com/designasia/task-vision",
    packages=find_packages(),
    include_package_data=True,
    install_requires=read_requirements(),
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Framework :: FastAPI",
        "Topic :: Internet :: WWW/HTTP :: HTTP Servers",
        "Topic :: Software Development :: Libraries :: Application Frameworks",
    ],
    keywords="fastapi task-management real-time websocket mongodb",
    project_urls={
        "Bug Reports": "https://github.com/designasia/task-vision/issues",
        "Source": "https://github.com/designasia/task-vision",
        "Documentation": "https://github.com/designasia/task-vision#readme",
    },
    entry_points={
        "console_scripts": [
            "task-vision-server=backend.server:main",
        ],
    },
)

if __name__ == "__main__":
    print("Design Asia Task Vision API Setup")
    print("=" * 40)
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("Error: Python 3.8 or higher is required")
        print(f"Current version: {sys.version}")
        sys.exit(1)
    
    print(f"Python version: {sys.version}")
    print("✓ Python version check passed")
    
    # Check if requirements.txt exists
    if os.path.exists("backend/requirements.txt"):
        print("✓ Requirements file found")
    else:
        print("⚠ Warning: requirements.txt not found")
    
    # Check if server.py exists
    if os.path.exists("backend/server.py"):
        print("✓ Server file found")
    else:
        print("✗ Error: server.py not found")
        sys.exit(1)
    
    print("\nSetup completed successfully!")
    print("\nTo install dependencies, run:")
    print("  pip install -e .")
    print("\nTo install from requirements.txt directly:")
    print("  pip install -r backend/requirements.txt")
    print("\nTo run the server:")
    print("  python -m uvicorn backend.server:app --reload")

