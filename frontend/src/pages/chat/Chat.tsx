import React, { useEffect, useState, useRef } from 'react';
import { getChatRooms, getChatMessages, createChatRoom, sendChatMessage, ChatRoom, ChatMessage, ChatMember, ChatMention } from '../../api/chat';
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
  const [mentions, setMentions] = useState<ChatMention[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [highlightedMentionIndex, setHighlightedMentionIndex] = useState(0);
  
  // Create Room modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<'direct' | 'group'>('direct');

  const wsRef = useRef<WebSocket | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      setMentions([]);
      setMentionOpen(false);
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
      setRooms(Array.isArray(data) ? data : []);
    } catch (_) {
      addToast('Không thể tải phòng chat.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      const safeUsers = Array.isArray(data) ? data : [];
      setUsersList(safeUsers.filter(u => u.id !== user?.id && u.status === 'active'));
    } catch (_) {}
  };

  const loadMessages = async (roomId: string) => {
    setMessagesLoading(true);
    try {
      const data = await getChatMessages(roomId);
      setMessages(Array.isArray(data) ? data : []);
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

  const normalizeText = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const roomMembers = (activeRoom?.members || []).filter(member => member.id !== user?.id);
  const mentionOptions = roomMembers
    .filter(member => {
      const haystack = normalizeText(`${member.full_name} ${member.username || ''} ${member.email || ''}`);
      return haystack.includes(normalizeText(mentionQuery));
    })
    .slice(0, 8);

  const findMentionToken = (value: string, caret: number) => {
    const beforeCaret = value.slice(0, caret);
    const match = beforeCaret.match(/(^|[\s.,;:!?([{])@([\p{L}\p{N}._-]*)$/u);
    if (!match || match.index === undefined) return null;
    const atIndex = match.index + match[1].length;
    return { start: atIndex, query: match[2] || '' };
  };

  const updateMentionState = (value: string, caret: number) => {
    if (!activeRoom || activeRoom.type === 'direct') {
      setMentionOpen(false);
      return;
    }
    const token = findMentionToken(value, caret);
    if (!token) {
      setMentionOpen(false);
      return;
    }
    setMentionStart(token.start);
    setMentionQuery(token.query);
    setHighlightedMentionIndex(0);
    setMentionOpen(true);
  };

  const handleInputChange = (value: string, caret: number) => {
    setInputText(value);
    setMentions(prev => prev.filter(mention => value.slice(mention.start, mention.end) === `@${mention.display_name}`));
    updateMentionState(value, caret);
  };

  const insertMention = (member: ChatMember) => {
    if (mentionStart === null || !inputRef.current) return;
    const caret = inputRef.current.selectionStart ?? inputText.length;
    const mentionText = `@${member.full_name}`;
    const nextText = `${inputText.slice(0, mentionStart)}${mentionText} ${inputText.slice(caret)}`;
    const nextStart = mentionStart;
    const nextEnd = mentionStart + mentionText.length;
    const diff = nextText.length - inputText.length;

    setInputText(nextText);
    setMentions(prev => {
      const shifted = prev
        .filter(item => !(item.start >= mentionStart && item.end <= caret))
        .map(item => item.start >= caret ? { ...item, start: item.start + diff, end: item.end + diff } : item);
      return [...shifted, { user_id: member.id, display_name: member.full_name, start: nextStart, end: nextEnd }]
        .sort((a, b) => a.start - b.start);
    });
    setMentionOpen(false);
    setMentionQuery('');
    setMentionStart(null);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextEnd + 1, nextEnd + 1);
    });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mentionOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedMentionIndex(prev => mentionOptions.length ? (prev + 1) % mentionOptions.length : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedMentionIndex(prev => mentionOptions.length ? (prev - 1 + mentionOptions.length) % mentionOptions.length : 0);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (mentionOptions[highlightedMentionIndex]) {
        e.preventDefault();
        insertMention(mentionOptions[highlightedMentionIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMentionOpen(false);
    }
  };

  const renderMessageText = (message: ChatMessage, isMine: boolean) => {
    const sortedMentions = [...(message.mentions || [])].sort((a, b) => a.start - b.start);
    if (sortedMentions.length === 0) return <p>{message.message}</p>;

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    sortedMentions.forEach((mention, index) => {
      if (mention.start > cursor) nodes.push(message.message.slice(cursor, mention.start));
      nodes.push(
        <span key={`${mention.user_id}-${mention.start}-${index}`} className={`px-1 py-0.5 rounded-md font-bold ${isMine ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
          {message.message.slice(mention.start, mention.end)}
        </span>
      );
      cursor = mention.end;
    });
    if (cursor < message.message.length) nodes.push(message.message.slice(cursor));
    return <p>{nodes}</p>;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeRoom) return;

    const payloadMentions = mentions.filter(mention => inputText.slice(mention.start, mention.end) === `@${mention.display_name}`);

    // Send via WebSocket if open, else fallback to REST API
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        message: inputText,
        mentions: payloadMentions
      }));
      setInputText('');
      setMentions([]);
      setMentionOpen(false);
    } else {
      sendChatMessage(activeRoom.id, inputText, undefined, payloadMentions)
        .then(newMsg => {
          setMessages(prev => [...prev, newMsg]);
          setInputText('');
          setMentions([]);
          setMentionOpen(false);
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
    <div className="h-[calc(100vh-140px)] flex bg-white rounded-[20px] border border-[#ECECEC] shadow-card overflow-hidden animate-in fade-in duration-200">
      
      {/* Rooms Sidebar */}
      <aside className="w-80 border-r border-slate-200 flex flex-col justify-between flex-shrink-0 bg-primary/5">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <MessageSquare size={18} className="text-primary" /> Kênh trò chuyện
          </h3>
          <button
            onClick={() => {
              setRoomType('direct');
              setCreateModalOpen(true);
            }}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-primary transition-colors"
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
                  className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 border ${
                    isActive 
                      ? 'bg-primary border-primary text-white shadow-md'
                      : 'bg-white hover:bg-primary/5 border-slate-200/65 text-slate-700'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                    isActive ? 'bg-primary-dark text-white' : 'bg-primary/15 text-primary'
                  }`}>
                    {r.display_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs truncate leading-5">{r.display_name}</h4>
                    <p className={`text-[10px] truncate ${isActive ? 'text-primary/20' : 'text-slate-400'}`}>
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
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-primary/5">
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
                        <div className={`p-3 rounded-[20px] text-xs leading-5 border ${
                          isMine 
                            ? 'bg-primary border-primary text-white rounded-tr-none shadow-md'
                            : 'bg-white border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                        }`}>
                          {renderMessageText(m, isMine)}
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
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white flex items-center gap-3 relative">
              {mentionOpen && (
                <div className="absolute left-4 bottom-[68px] w-72 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-20">
                  {mentionOptions.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-slate-400 text-center font-medium">Không tìm thấy thành viên</div>
                  ) : (
                    mentionOptions.map((member, index) => (
                      <button
                        key={member.id}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          insertMention(member);
                        }}
                        className={`w-full p-2 rounded-xl flex items-center gap-2 text-left transition-colors ${index === highlightedMentionIndex ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 text-slate-700'}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs overflow-hidden">
                          {member.avatar_url ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" /> : member.full_name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">{member.full_name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{member.role}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
              <input
                ref={inputRef}
                type="text"
                placeholder="Nhập nội dung tin nhắn và ấn Enter để gửi..."
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                onKeyDown={handleInputKeyDown}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary transition-all bg-slate-50 focus:bg-white"
              />
              <button
                type="submit"
                className="p-2.5 bg-primary hover:bg-primary-dark text-white rounded-2xl shadow-md transition-all active:scale-95 flex-shrink-0"
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
          <div className="bg-white rounded-[20px] max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-primary/5">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Users className="text-primary" size={18} /> Tạo cuộc hội thoại mới
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
                    className={`flex-1 py-2 text-xs font-bold rounded-2xl border transition-all ${
                      roomType === 'direct' 
                        ? 'bg-primary border-primary text-white shadow-sm'
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
                    className={`flex-1 py-2 text-xs font-bold rounded-2xl border transition-all ${
                      roomType === 'group' 
                        ? 'bg-primary border-primary text-white shadow-sm'
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">
                  Chọn thành viên {roomType === 'direct' ? '(Chọn 1 người)' : '(Chọn nhiều người)'}
                </label>
                <div className="border border-slate-200 rounded-2xl p-2 max-h-48 overflow-y-auto space-y-1">
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
                            isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5 text-slate-700'
                          }`}
                        >
                          <span>{u.full_name} ({u.role.toUpperCase()})</span>
                          {isSelected && <span className="text-[10px] font-bold text-primary">✓</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-[0.99] mt-2"
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
