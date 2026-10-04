"""
api/index.py - Vercel Serverless Entrypoint for Chandra Asri KnowledgeHub
Directly interfaces with FastAPI app from backend/api.py
"""
import sys
import os

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from api import app as handler

# Export ASGI/WSGI app for Vercel
app = handler
