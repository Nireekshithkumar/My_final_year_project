import os
import sys

# celery_app.py lives at the project root, one level above this settings package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from celery_app import app as celery_app

__all__ = ('celery_app',)