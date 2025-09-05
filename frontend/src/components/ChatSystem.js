import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Avatar } from './ui/avatar';
import { toast } from 'sonner';
import { 
  Send, 
  MessageCircle, 
  Users, 
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

const ChatSystem = ({ isOpen, onClose, className = "" }) => {
  const { user, token } = useAuth();
  const { socket, isConnected } = useSocket(token);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    if (socket) {
      // Listen for messages
      socket.on('message_received', handleNewMessage);
      socket.on('user_online', handleUserOnline);
      socket.on('user_offline', handleUserOffline);
      
      return () => {
        socket.off('message_received');
        socket.off('user_online');
        socket.off('user_offline');
      };
    }
  }, [socket]);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      fetchOnlineUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${API}/messages?limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const response = await fetch(`${API}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const users = await response.json();
        setOnlineUsers(users.filter(u => u.is_online && u.id !== user.id));
      }
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  };

  const handleNewMessage = (message) => {
    setMessages(prev => [...prev, message]);
    
    // Show toast notification for messages from others
    if (message.sender_id !== user.id) {
      toast.success(`New message from ${message.sender_name}`);
    }
  };

  const handleUserOnline = (userData) => {
    setOnlineUsers(prev => {
      const filtered = prev.filter(u => u.id !== userData.user_id);
      if (userData.user_id !== user.id) {
        return [...filtered, userData];
      }
      return filtered;
    });
    
    if (userData.user_id !== user.id) {
      toast.success(`${userData.name} came online`);
    }
  };

  const handleUserOffline = (userData) => {
    setOnlineUsers(prev => prev.filter(u => u.id !== userData.user_id));
    
    if (userData.user_id !== user.id) {
      toast.info(`${userData.name} went offline`);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !socket) return;
    
    try {
      // Send via Socket.IO for real-time delivery
      socket.emit('send_message', {
        content: newMessage.trim(),
        message_type: 'text'
      });
      
      setNewMessage('');
      chatInputRef.current?.focus();
    } catch (error) {
      toast.error('Failed to send message');
      console.error('Error sending message:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageTypeIcon = (messageType) => {
    switch (messageType) {
      case 'system':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'notification':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <MessageCircle className="w-4 h-4 text-slate-500" />;
    }
  };

  const getRoleColor = (role) => {
    return role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <Card className={`w-96 shadow-2xl border-0 ${isMinimized ? 'h-14' : 'h-96'} transition-all duration-300`}>
        <CardHeader className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5" />
              <CardTitle className="text-sm font-medium">Team Chat</CardTitle>
              {!isConnected && (
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              )}
              {isConnected && (
                <div className="w-2 h-2 bg-green-400 rounded-full" />
              )}
            </div>
            <div className="flex items-center space-x-1">
              <Button
                onClick={() => setIsMinimized(!isMinimized)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-white hover:bg-white/20"
              >
                {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
              </Button>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-white hover:bg-white/20"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="p-0 h-80 flex flex-col">
            {/* Online Users */}
            <div className="p-3 bg-slate-50 border-b">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Online ({onlineUsers.length})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {onlineUsers.map((onlineUser) => (
                  <Badge key={onlineUser.id} className={`text-xs ${getRoleColor(onlineUser.role)}`}>
                    {onlineUser.name}
                  </Badge>
                ))}
                {onlineUsers.length === 0 && (
                  <span className="text-xs text-slate-500">No other users online</span>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.sender_id === user.id
                          ? 'bg-indigo-500 text-white'
                          : message.message_type === 'system'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-900'
                      }`}
                    >
                      {message.sender_id !== user.id && (
                        <div className="flex items-center space-x-2 mb-1">
                          <Avatar className="w-5 h-5">
                            <div className={`w-5 h-5 rounded-full ${getRoleColor(message.sender_role)} flex items-center justify-center text-xs font-bold`}>
                              {message.sender_name.charAt(0).toUpperCase()}
                            </div>
                          </Avatar>
                          <span className="text-xs font-medium">{message.sender_name}</span>
                          <Badge className={`text-xs ${getRoleColor(message.sender_role)}`}>
                            {message.sender_role}
                          </Badge>
                        </div>
                      )}
                      
                      <div className="flex items-start space-x-2">
                        {getMessageTypeIcon(message.message_type)}
                        <div className="flex-1">
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className={`text-xs ${
                              message.sender_id === user.id ? 'text-indigo-100' : 'text-slate-500'
                            }`}>
                              {formatTime(message.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-3 border-t">
              <form onSubmit={sendMessage} className="flex space-x-2">
                <Input
                  ref={chatInputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={isConnected ? "Type a message..." : "Connecting..."}
                  className="flex-1 text-sm"
                  disabled={!isConnected}
                  maxLength={500}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newMessage.trim() || !isConnected}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              {!isConnected && (
                <div className="flex items-center space-x-2 mt-2 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                  <span>Connecting to chat...</span>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ChatSystem;