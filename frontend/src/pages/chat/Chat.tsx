import React, { useEffect, useState, useRef } from 'react';
import { getChatRooms, getChatMessages, createChatRoom, sendChatMessage, ChatRoom, ChatMessage } from '../../api/chat';
import { getUsers } from '../../api/users';
import { useAuthStore, User } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { MessageSquare, Send, Plus, Users, X, Paperclip, Smile } from 'lucide-react';

const Chat: React.FC = () => {
  const { user, token } = useAuthStore();
  const { addToast } = useToastStore();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  
  // Create Room modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<'direct' | 'group'>('direct');

  const wsRef = useRef<WebSocket | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadRooms();
    loadUsers();
    return () => {
      // Clean up WebSocket on unmount
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (activeRoom) {
      loadMessages(activeRoom.id);
      connectWebSocket(activeRoom.id);
    } else {
      setMessages([]);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  }, [activeRoom]);

  useEffect(() => {
    // Scroll to bottom on new messages
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadRooms = async () => {
    setLoading(true);
    try {
      const data = await getChatRooms();
      setRooms(data);
    } catch (_) {
      addToast('Không thể tải phòng chat.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsersList(data.filter(u => u.id !== user?.id && u.status === 'active'));
    } catch (_) {}
  };

  const loadMessages = async (roomId: string) => {
    setMessagesLoading(true);
    try {
      const data = await getChatMessages(roomId);
      setMessages(data);
    } catch (_) {
      addToast('Không thể tải lịch sử tin nhắn.', 'error');
    } finally {
      setMessagesLoading(false);
    }
  };

  const connectWebSocket = (roomId: string) => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/ws/${roomId}?token=${token}`;
    // Replace http/https with ws/wss
    const wsProtoUrl = wsUrl.replace(/^http/, 'ws');

    const ws = new WebSocket(wsProtoUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const newMsg: ChatMessage = JSON.parse(event.data);
      setMessages(prev => {
        // Prevent duplicate appending
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      // Also update last message in rooms list
      setRooms(prev => prev.map(r => r.id === roomId ? {
        ...r,
        last_message: {
          message: newMsg.message,
          created_at: newMsg.created_at,
          sender_name: newMsg.sender_name
        }
      } : r));
    };

    ws.onerror = () => {
      console.error('WebSocket connection error.');
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed.');
    };
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeRoom) return;

    // Send via WebSocket if open, else fallback to REST API
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        message: inputText.trim()
      }));
      setInputText('');
    } else {
      sendChatMessage(activeRoom.id, inputText.trim())
        .then(newMsg => {
          setMessages(prev => [...prev, newMsg]);
          setInputText('');
        });
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      addToast('Vui lòng chọn ít nhất một thành viên.', 'warning');
      return;
    }
    if (roomType === 'group' && !roomName.trim()) {
      addToast('Vui lòng nhập tên nhóm chat.', 'warning');
      return;
    }

    try {
      const room = await createChatRoom({
        name: roomType === 'group' ? roomName : undefined,
        type: roomType,
        member_ids: selectedUserIds
      });

      addToast('Tạo cuộc trò chuyện thành công.', 'success');
      setCreateModalOpen(false);
      setSelectedUserIds([]);
      setRoomName('');
      loadRooms().then(() => {
        setActiveRoom(room);
      });
    } catch (_) {
      addToast('Không thể tạo phòng chat.', 'error');
    }
  };

  const toggleUserSelect = (uid: string) => {
    setSelectedUserIds(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  if (loading && rooms.length === 0) return <LoadingSpinner />;

  return (
    <div className="h-[calc(100vh-140px)] flex bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
      
      {/* Rooms Sidebar */}
      <aside className="w-80 border-r border-slate-200 flex flex-col justify-between flex-shrink-0 bg-slate-50/50">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <MessageSquare size={18} className="text-blue-600" /> Kênh trò chuyện
          </h3>
          <button
            onClick={() => {
              setRoomType('direct');
              setCreateModalOpen(true);
            }}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition-colors"
            title="Tạo phòng chat mới"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Rooms Scroll List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {rooms.length === 0 ? (
            <p className="text-center py-12 text-xs text-slate-400 font-medium">Chưa có phòng chat nào.</p>
          ) : (
            rooms.map(r => {
              const isActive = activeRoom?.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setActiveRoom(r)}
                  className={`p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 border ${
                    isActive 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                      : 'bg-white hover:bg-slate-50 border-slate-200/65 text-slate-700'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                    isActive ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {r.display_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs truncate leading-5">{r.display_name}</h4>
                    <p className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                      {r.last_message ? `${r.last_message.sender_name}: ${r.last_message.message}` : 'Chưa có tin nhắn nào.'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Messages Feed Panel */}
      <main className="flex-1 flex flex-col justify-between bg-white relative">
        {activeRoom ? (
          <>
            {/* Header info */}
            <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-white z-10 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm">{activeRoom.display_name}</h3>
              {activeRoom.type !== 'branch' && (
                <span className="text-[10px] font-mono text-slate-400">
                  {activeRoom.members ? `${activeRoom.members.length} thành viên` : ''}
                </span>
              )}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              {messagesLoading && messages.length === 0 ? (
                <LoadingSpinner />
              ) : (
                messages.map((m) => {
                  const isMine = m.sender_id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-3 max-w-[85%] ${isMine ? 'ml-auto flex-row-reverse' : ''}`}
                    >
                      {/* Avatar */}
                      {!isMine && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {m.sender_avatar ? (
                            <img src={m.sender_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            m.sender_name[0].toUpperCase()
                          )}
                        </div>
                      )}

                      <div className="space-y-1">
                        {!isMine && (
                          <span className="text-[10px] text-slate-400 font-semibold pl-1">{m.sender_name}</span>
                        )}
                        <div className={`p-3 rounded-2xl text-xs leading-5 border ${
                          isMine 
                            ? 'bg-blue-600 border-blue-600 text-white rounded-tr-none shadow-md'
                            : 'bg-white border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                        }`}>
                          <p>{m.message}</p>
                        </div>
                        <span className={`text-[9px] text-slate-400 block pl-1 ${isMine ? 'text-right pr-1' : ''}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messageEndRef} />
            </div>

            {/* Input message form */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white flex items-center gap-3">
              <input
                type="text"
                placeholder="Nhập nội dung tin nhắn và ấn Enter để gửi..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 transition-all bg-slate-50 focus:bg-white"
              />
              <button
                type="submit"
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all active:scale-95 flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <MessageSquare size={48} className="text-slate-300 stroke-[1.5]" />
            <h3 className="font-bold text-slate-600 text-sm">Trò chuyện nội bộ</h3>
            <p className="text-xs text-slate-400">Chọn một cuộc trò chuyện từ thanh bên để bắt đầu thảo luận ca làm.</p>
          </div>
        )}
      </main>

      {/* CREATE ROOM MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Users className="text-blue-500" size={18} /> Tạo cuộc hội thoại mới
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateRoom} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Hình thức trò chuyện</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRoomType('direct');
                      setSelectedUserIds([]);
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                      roomType === 'direct' 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Trực tiếp (1-1)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRoomType('group');
                      setSelectedUserIds([]);
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                      roomType === 'group' 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Tạo nhóm chat
                  </button>
                </div>
              </div>

              {roomType === 'group' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Tên nhóm chat *</label>
                  <input
                    type="text"
                    placeholder="Nhóm giặt ngày ca tối, ca sáng..."
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">
                  Chọn thành viên {roomType === 'direct' ? '(Chọn 1 người)' : '(Chọn nhiều người)'}
                </label>
                <div className="border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto space-y-1">
                  {usersList.length === 0 ? (
                    <p className="text-center py-6 text-xs text-slate-400">Không tìm thấy nhân viên khả dụng.</p>
                  ) : (
                    usersList.map(u => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            if (roomType === 'direct') {
                              setSelectedUserIds([u.id]);
                            } else {
                              toggleUserSelect(u.id);
                            }
                          }}
                          className={`p-2 rounded-lg cursor-pointer text-xs font-medium flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span>{u.full_name} ({u.role.toUpperCase()})</span>
                          {isSelected && <span className="text-[10px] font-bold text-blue-600">✓</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.99] mt-2"
                disabled={selectedUserIds.length === 0}
              >
                Tạo trò chuyện
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Chat;
