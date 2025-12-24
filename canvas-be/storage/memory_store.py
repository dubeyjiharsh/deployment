from typing import Dict, List, Optional
from datetime import datetime
import time

class CanvasSession:
    """Represents a canvas session"""
    def __init__(self, canvas_id: str, thread_id: str, assistant_id: str):
        self.canvas_id = canvas_id
        self.thread_id = thread_id
        self.assistant_id = assistant_id
        self.file_ids: List[str] = []
        self.created_at = datetime.now()
        self.last_updated = datetime.now()
    
    def add_file(self, file_id: str):
        """Add a file to the session"""
        if file_id not in self.file_ids:
            self.file_ids.append(file_id)
            self.last_updated = datetime.now()
    
    def to_dict(self) -> dict:
        """Convert session to dictionary"""
        return {
            "canvas_id": self.canvas_id,
            "thread_id": self.thread_id,
            "assistant_id": self.assistant_id,
            "file_ids": self.file_ids,
            "created_at": self.created_at,
            "last_updated": self.last_updated
        }

class MemoryStore:
    """In-memory storage for canvas sessions (will be migrated to PostgreSQL)"""
    
    def __init__(self):
        self._sessions: Dict[str, CanvasSession] = {}
    
    def create_session(self, thread_id: str, assistant_id: str) -> str:
        """Create a new canvas session"""
        canvas_id = f"canvas_{int(time.time() * 1000)}"
        session = CanvasSession(canvas_id, thread_id, assistant_id)
        self._sessions[canvas_id] = session
        return canvas_id
    
    def get_session(self, canvas_id: str) -> Optional[CanvasSession]:
        """Get a canvas session by ID"""
        return self._sessions.get(canvas_id)
    
    def session_exists(self, canvas_id: str) -> bool:
        """Check if a session exists"""
        return canvas_id in self._sessions
    
    def add_file_to_session(self, canvas_id: str, file_id: str) -> bool:
        """Add a file to a session"""
        session = self.get_session(canvas_id)
        if session:
            session.add_file(file_id)
            return True
        return False
    
    def get_all_sessions(self) -> List[CanvasSession]:
        """Get all canvas sessions"""
        return list(self._sessions.values())
    
    def delete_session(self, canvas_id: str) -> bool:
        """Delete a canvas session"""
        if canvas_id in self._sessions:
            del self._sessions[canvas_id]
            return True
        return False

# Global memory store instance
memory_store = MemoryStore()