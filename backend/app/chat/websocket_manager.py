from fastapi import WebSocket
from typing import List, Dict, Any
import json
import logging

logger = logging.getLogger("app.chat.websocket")

class ConnectionManager:
    def __init__(self):
        # Maps Room ID -> List of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        logger.info(f"WebSocket client connected to room: {room_id}")

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
                logger.info(f"WebSocket client disconnected from room: {room_id}")
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast_to_room(self, message: Dict[str, Any], room_id: str):
        """Send a JSON message to all active WebSocket connections in a room."""
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    # Clean up dead connections during broadcast attempts
                    logger.error(f"Error broadcasting message, connection might be dead: {str(e)}")
                    pass

manager = ConnectionManager()
