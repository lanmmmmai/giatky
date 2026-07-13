from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import json
import logging

from app.common.dependencies import get_current_user
from app.common.security import decode_access_token
from app.database import supabase
from app.chat.websocket_manager import manager

logger = logging.getLogger("app.chat.routes")
router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatRoomCreate(BaseModel):
    name: Optional[str] = None
    type: str # branch | direct | group
    branch_id: Optional[str] = None
    member_ids: List[str] # List of user IDs to add

class MessageCreate(BaseModel):
    message: str
    attachment_url: Optional[str] = None
    mentions: List["MessageMentionCreate"] = Field(default_factory=list)

class MessageMentionCreate(BaseModel):
    user_id: str
    display_name: str
    start: int = Field(..., ge=0)
    end: int = Field(..., ge=0)

MessageCreate.model_rebuild()

def _get_room_member_ids(room: dict) -> List[str]:
    room_id = room["id"]
    if room["type"] in ["direct", "group"]:
        member_res = supabase.table("chat_room_members").select("user_id").eq("room_id", room_id).execute()
        return [row["user_id"] for row in (member_res.data or [])]

    if room["type"] == "branch" and room.get("branch_id"):
        users_res = supabase.table("users").select("id").eq("branch_id", room["branch_id"]).execute()
        member_ids = [row["id"] for row in (users_res.data or [])]
        try:
            ub_res = supabase.table("user_branches").select("user_id").eq("branch_id", room["branch_id"]).execute()
            member_ids.extend([row["user_id"] for row in (ub_res.data or [])])
        except Exception as ub_err:
            logger.warning(f"Failed to read branch chat user_branches: {ub_err}")
        return list(set(member_ids))

    return []

def _get_room_members(room: dict) -> List[dict]:
    if room["type"] in ["direct", "group"]:
        mbr_res = supabase.table("chat_room_members")\
            .select("user_id, users(full_name, username, email, avatar_url, role)")\
            .eq("room_id", room["id"])\
            .execute()
        return [
            {
                "id": row["user_id"],
                "full_name": row["users"]["full_name"],
                "username": row["users"].get("username"),
                "email": row["users"].get("email"),
                "avatar_url": row["users"]["avatar_url"],
                "role": row["users"]["role"]
            }
            for row in (mbr_res.data or [])
            if row.get("users")
        ]

    if room["type"] == "branch" and room.get("branch_id"):
        members = []
        seen = set()
        users_res = supabase.table("users")\
            .select("id, full_name, username, email, avatar_url, role")\
            .eq("status", "active")\
            .eq("branch_id", room["branch_id"])\
            .execute()
        for row in (users_res.data or []):
            seen.add(row["id"])
            members.append({
                "id": row["id"],
                "full_name": row["full_name"],
                "username": row.get("username"),
                "email": row.get("email"),
                "avatar_url": row.get("avatar_url"),
                "role": row["role"]
            })
        try:
            ub_res = supabase.table("user_branches")\
                .select("user_id, users(full_name, username, email, avatar_url, role, status)")\
                .eq("branch_id", room["branch_id"])\
                .execute()
            for row in (ub_res.data or []):
                user = row.get("users")
                if not user or user.get("status") != "active" or row["user_id"] in seen:
                    continue
                seen.add(row["user_id"])
                members.append({
                    "id": row["user_id"],
                    "full_name": user["full_name"],
                    "username": user.get("username"),
                    "email": user.get("email"),
                    "avatar_url": user.get("avatar_url"),
                    "role": user["role"]
                })
        except Exception as ub_err:
            logger.warning(f"Failed to read branch room members from user_branches: {ub_err}")
        return members

    return []

def _normalize_mentions(mentions: List[MessageMentionCreate], member_ids: List[str], sender_id: str) -> List[dict]:
    normalized = []
    seen = set()
    allowed = set(member_ids)
    for mention in mentions or []:
        user_id = str(mention.user_id)
        if user_id not in allowed:
            raise HTTPException(status_code=400, detail="Không thể mention người không thuộc phòng chat.")
        if mention.end <= mention.start:
            raise HTTPException(status_code=400, detail="Vị trí mention không hợp lệ.")
        key = (user_id, mention.start, mention.end)
        if key in seen:
            continue
        seen.add(key)
        normalized.append({
            "mentioned_user_id": user_id,
            "display_name_snapshot": mention.display_name[:150],
            "start_index": mention.start,
            "end_index": mention.end
        })
    return normalized

def _save_mentions_and_notifications(message: dict, room: dict, mentions: List[dict], sender: dict):
    if not mentions:
        message["mentions"] = []
        return message

    rows = []
    for mention in mentions:
        rows.append({
            "message_id": message["id"],
            "mentioned_user_id": mention["mentioned_user_id"],
            "display_name_snapshot": mention["display_name_snapshot"],
            "start_index": mention["start_index"],
            "end_index": mention["end_index"]
        })

    supabase.table("message_mentions").insert(rows).execute()

    room_name = room.get("name") or room.get("branch_name") or "nhóm chat"
    snippet = (message.get("message") or "")[:120]
    notified_user_ids = sorted({row["mentioned_user_id"] for row in mentions if row["mentioned_user_id"] != sender["id"]})
    if notified_user_ids:
        supabase.table("notifications").insert([
            {
                "title": "Bạn được nhắc đến trong chat",
                "content": f"{sender['full_name']} đã nhắc đến bạn trong nhóm {room_name}: {snippet}",
                "type": "chat",
                "sender_id": sender["id"],
                "target_user_id": user_id,
                "action_url": f"chat?room_id={room['id']}&message_id={message['id']}"
            }
            for user_id in notified_user_ids
        ]).execute()

    message["mentions"] = [
        {
            "user_id": row["mentioned_user_id"],
            "display_name": row["display_name_snapshot"],
            "start": row["start_index"],
            "end": row["end_index"]
        }
        for row in mentions
    ]
    return message

def _attach_message_mentions(messages: List[dict]) -> List[dict]:
    if not messages:
        return messages
    message_ids = [message["id"] for message in messages]
    try:
        mention_res = supabase.table("message_mentions")\
            .select("message_id, mentioned_user_id, display_name_snapshot, start_index, end_index")\
            .in_("message_id", message_ids)\
            .execute()
    except Exception as err:
        logger.warning(f"Failed to fetch message mentions (table may not exist yet): {err}")
        mention_res = None

    mention_map = {}
    for row in ((mention_res.data if mention_res else None) or []):
        mention_map.setdefault(row["message_id"], []).append({
            "user_id": row["mentioned_user_id"],
            "display_name": row["display_name_snapshot"],
            "start": row["start_index"],
            "end": row["end_index"]
        })
    for message in messages:
        message["mentions"] = mention_map.get(message["id"], [])
    return messages

@router.get("/rooms")
def get_rooms(current_user: dict = Depends(get_current_user)):
    """Retrieve chat rooms that this user belongs to."""
    user_id = current_user["id"]
    branch_id = current_user.get("branch_id")
    
    # 1. Direct and group rooms: User must be in chat_room_members
    member_rooms_res = supabase.table("chat_room_members").select("room_id").eq("user_id", user_id).execute()
    room_ids = [m["room_id"] for m in (member_rooms_res.data or [])]
    
    # 2. Branch rooms: If user belongs to a branch, they automatically see that branch room
    # Check if branch room exists, if not created, we can create it dynamically or return if exists
    branch_rooms_res = []
    if branch_id:
        b_rooms = supabase.table("chat_rooms").select("id").eq("type", "branch").eq("branch_id", branch_id).execute()
        if b_rooms.data:
            room_ids.append(b_rooms.data[0]["id"])
            
    # Also if user is admin, they might have access to all branch rooms.
    if current_user["role"] == "admin":
        all_b_rooms = supabase.table("chat_rooms").select("id").eq("type", "branch").execute()
        room_ids.extend([br["id"] for br in (all_b_rooms.data or [])])
        
    # Remove duplicates
    room_ids = list(set(room_ids))
    
    if not room_ids:
        return []
        
    rooms_res = supabase.table("chat_rooms").select("*, branches(name)").in_("id", room_ids).execute()
    rooms = rooms_res.data or []
    
    formatted = []
    for r in rooms:
        b_name = r.get("branches", {}).get("name") if r.get("branches") else None
        
        # Last message query
        msg_res = supabase.table("chat_messages")\
            .select("message, created_at, sender_id, users!sender_id(full_name)")\
            .eq("room_id", r["id"])\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
            
        last_msg = None
        if msg_res.data:
            m = msg_res.data[0]
            last_msg = {
                "message": m["message"],
                "created_at": m["created_at"],
                "sender_name": m.get("users", {}).get("full_name") if m.get("users") else "Hệ thống"
            }
            
        members = _get_room_members(r)
                    
        # Compute display name
        display_name = r["name"]
        if r["type"] == "branch":
            display_name = f"Nhóm Cơ Sở: {b_name or 'Cơ sở'}"
        elif r["type"] == "direct" and members:
            # Show the other user's name
            other_members = [m for m in members if m["id"] != user_id]
            if other_members:
                display_name = other_members[0]["full_name"]
            elif members:
                display_name = members[0]["full_name"]
                
        r_copy = dict(r)
        r_copy["display_name"] = display_name
        r_copy["branch_name"] = b_name
        r_copy["last_message"] = last_msg
        r_copy["members"] = members
        if "branches" in r_copy: del r_copy["branches"]
        
        formatted.append(r_copy)
        
    return formatted

@router.post("/rooms")
def create_room(payload: ChatRoomCreate, current_user: dict = Depends(get_current_user)):
    """Create a chat room and add members."""
    # Build insert data
    room_data = {
        "type": payload.type,
        "branch_id": payload.branch_id,
        "created_by": current_user["id"],
        "name": payload.name
    }
    
    # If direct room, check if a direct room already exists between these 2 users
    if payload.type == "direct" and len(payload.member_ids) == 2:
        # Check existing direct rooms
        u1, u2 = payload.member_ids[0], payload.member_ids[1]
        existing_res = supabase.table("chat_room_members").select("room_id").in_("user_id", [u1, u2]).execute()
        r_ids = [r["room_id"] for r in (existing_res.data or [])]
        
        # Find room_id that has both users as members
        for rid in set(r_ids):
            # Check type is direct
            type_res = supabase.table("chat_rooms").select("type").eq("id", rid).execute()
            if type_res.data and type_res.data[0]["type"] == "direct":
                m_res = supabase.table("chat_room_members").select("user_id").eq("room_id", rid).execute()
                m_ids = [m["user_id"] for m in (m_res.data or [])]
                if u1 in m_ids and u2 in m_ids:
                    # Return existing room
                    room_res = supabase.table("chat_rooms").select("*").eq("id", rid).execute()
                    return room_res.data[0]
                    
    room_res = supabase.table("chat_rooms").insert(room_data).execute()
    if not room_res.data:
        raise HTTPException(status_code=500, detail="Không thể tạo phòng chat.")
        
    room = room_res.data[0]
    
    # Add members
    members_to_insert = []
    # Make sure creator is in the room
    all_member_ids = list(set(payload.member_ids + [current_user["id"]]))
    
    for uid in all_member_ids:
        members_to_insert.append({
            "room_id": room["id"],
            "user_id": uid
        })
        
    if members_to_insert:
        supabase.table("chat_room_members").insert(members_to_insert).execute()
        
    return room

@router.get("/rooms/{id}/messages")
def get_room_messages(id: str, current_user: dict = Depends(get_current_user)):
    """Retrieve messages from a chat room."""
    # Verify permission: user must be in members, or is admin, or is staff/manager of the branch
    room_res = supabase.table("chat_rooms").select("*").eq("id", id).execute()
    if not room_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng chat.")
        
    room = room_res.data[0]
    is_member = False
    
    if current_user["role"] == "admin":
        is_member = True
    elif room["type"] == "branch":
        if current_user.get("branch_id") == room["branch_id"] or current_user["role"] == "manager":
            is_member = True
    else:
        # Check members table
        chk = supabase.table("chat_room_members").select("id").eq("room_id", id).eq("user_id", current_user["id"]).execute()
        if chk.data:
            is_member = True
            
    if not is_member:
        raise HTTPException(status_code=403, detail="Bạn không có quyền tham gia phòng chat này.")
        
    # Get messages
    msg_res = supabase.table("chat_messages")\
        .select("*, users!sender_id(full_name, avatar_url)")\
        .eq("room_id", id)\
        .order("created_at", desc=False)\
        .limit(100)\
        .execute()
        
    formatted = []
    for m in (msg_res.data or []):
        sender_name = m.get("users", {}).get("full_name") if m.get("users") else "Hệ thống"
        sender_avatar = m.get("users", {}).get("avatar_url") if m.get("users") else None
        
        m_copy = dict(m)
        m_copy["sender_name"] = sender_name
        m_copy["sender_avatar"] = sender_avatar
        if "users" in m_copy: del m_copy["users"]
        formatted.append(m_copy)
        
    return _attach_message_mentions(formatted)

@router.post("/rooms/{id}/messages")
def send_message(id: str, payload: MessageCreate, current_user: dict = Depends(get_current_user)):
    """Post message using REST (primarily for files/backup)."""
    room_res = supabase.table("chat_rooms").select("*").eq("id", id).execute()
    if not room_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng chat.")
        
    room = room_res.data[0]
    member_ids = _get_room_member_ids(room)
    if current_user["role"] != "admin" and current_user["id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Bạn không thuộc phòng chat này.")

    normalized_mentions = _normalize_mentions(payload.mentions, member_ids, current_user["id"])

    insert_data = {
        "room_id": id,
        "sender_id": current_user["id"],
        "message": payload.message,
        "attachment_url": payload.attachment_url,
        "is_read": False
    }
    
    response = supabase.table("chat_messages").insert(insert_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể lưu tin nhắn.")
        
    msg = response.data[0]
    msg["sender_name"] = current_user["full_name"]
    msg["sender_avatar"] = current_user["avatar_url"]
    msg = _save_mentions_and_notifications(msg, room, normalized_mentions, current_user)
    
    return msg

@router.websocket("/ws/{room_id}")
async def chat_websocket(websocket: WebSocket, room_id: str):
    """WebSocket connection for real-time chat."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    # Authenticate JWT token
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    user_id = payload.get("sub")
    # Verify user exists in database
    u_res = supabase.table("users").select("id, full_name, avatar_url, role").eq("id", user_id).execute()
    if not u_res.data:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    current_user = u_res.data[0]
    
    # Check room exists
    room_res = supabase.table("chat_rooms").select("*").eq("id", room_id).execute()
    if not room_res.data:
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return
    room = room_res.data[0]
    member_ids = _get_room_member_ids(room)
    if current_user["role"] != "admin" and current_user["id"] not in member_ids:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    # Accept and register connection
    await manager.connect(websocket, room_id)
    
    try:
        while True:
            # Wait for message from client
            data_str = await websocket.receive_text()
            data = json.loads(data_str)
            text_message = data.get("message", "")
            attachment_url = data.get("attachment_url", None)
            mentions_payload = data.get("mentions") or []
            
            if not text_message.strip() and not attachment_url:
                continue
                
            normalized_mentions = _normalize_mentions(
                [MessageMentionCreate(**item) for item in mentions_payload],
                member_ids,
                current_user["id"]
            )

            # Log to DB
            insert_data = {
                "room_id": room_id,
                "sender_id": current_user["id"],
                "message": text_message,
                "attachment_url": attachment_url,
                "is_read": False
            }
            db_res = supabase.table("chat_messages").insert(insert_data).execute()
            
            if db_res.data:
                msg = db_res.data[0]
                msg["sender_name"] = current_user["full_name"]
                msg["sender_avatar"] = current_user["avatar_url"]
                msg = _save_mentions_and_notifications(msg, room, normalized_mentions, current_user)
                
                # Broadcast message to all active room subscribers
                await manager.broadcast_to_room(msg, room_id)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
    except Exception as e:
        logger.error(f"WebSocket Error: {str(e)}")
        manager.disconnect(websocket, room_id)
