import apiClient from './client';

export interface ChatMember {
  id: string;
  full_name: string;
  username?: string;
  email?: string;
  avatar_url?: string | null;
  role: string;
}

export interface ChatMention {
  user_id: string;
  display_name: string;
  start: number;
  end: number;
}

export interface ChatRoom {
  id: string;
  name?: string | null;
  display_name: string;
  type: 'branch' | 'direct' | 'group';
  branch_id?: string | null;
  branch_name?: string | null;
  created_by?: string;
  created_at: string;
  last_message?: {
    message: string;
    created_at: string;
    sender_name: string;
  } | null;
  members?: ChatMember[];
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string | null;
  message: string;
  attachment_url?: string | null;
  is_read: boolean;
  created_at: string;
  mentions?: ChatMention[];
}

export const getChatRooms = () => apiClient.get<ChatRoom[]>('/chat/rooms').then(res => res.data);
export const createChatRoom = (data: { name?: string; type: string; branch_id?: string; member_ids: string[] }) => 
  apiClient.post<ChatRoom>('/chat/rooms', data).then(res => res.data);
export const getChatMessages = (roomId: string) => apiClient.get<ChatMessage[]>(`/chat/rooms/${roomId}/messages`).then(res => res.data);
export const sendChatMessage = (roomId: string, message: string, attachmentUrl?: string, mentions: ChatMention[] = []) => 
  apiClient.post<ChatMessage>(`/chat/rooms/${roomId}/messages`, { message, attachment_url: attachmentUrl, mentions }).then(res => res.data);
