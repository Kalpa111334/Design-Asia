import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import { 
  Bell, 
  BellRing, 
  Check, 
  X, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

const NotificationSystem = ({ className = "" }) => {
  const { user, token } = useAuth();
  const { socket } = useSocket(token);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    if (socket) {
      socket.on('notification', handleNewNotification);
      
      return () => {
        socket.off('notification');
      };
    }
  }, [socket]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API}/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleNewNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    // Show toast notification
    toast.success(notification.title, {
      description: notification.content,
      action: {
        label: "View",
        onClick: () => setIsOpen(true),
      },
    });
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`${API}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (notification) => {
    if (notification.title.includes('Task')) {
      return <CheckCircle className="w-5 h-5 text-blue-500" />;
    }
    if (notification.title.includes('Alert') || notification.title.includes('Overdue')) {
      return <AlertTriangle className="w-5 h-5 text-red-500" />;
    }
    return <Info className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        size="sm"
        className="relative"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-4 h-4" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
        {unreadCount > 0 && (
          <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center p-0">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute top-12 right-0 z-50">
          <Card className="w-96 shadow-2xl border-0 max-h-96">
            <CardHeader className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                  <Bell className="w-4 h-4" />
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <Badge className="bg-white/20 text-white text-xs">
                      {unreadCount} new
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  onClick={() => setIsOpen(false)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white hover:bg-white/20"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No notifications yet</p>
                </div>
              ) : (
                <ScrollArea className="max-h-80">
                  <div className="divide-y divide-slate-200">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-slate-50 transition-colors ${
                          !notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className={`text-sm font-medium ${
                                !notification.is_read ? 'text-slate-900' : 'text-slate-700'
                              }`}>
                                {notification.title}
                              </h4>
                              {!notification.is_read && (
                                <Button
                                  onClick={() => markAsRead(notification.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            
                            <p className={`text-sm mt-1 ${
                              !notification.is_read ? 'text-slate-700' : 'text-slate-500'
                            }`}>
                              {notification.content}
                            </p>
                            
                            <div className="flex items-center space-x-2 mt-2">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className="text-xs text-slate-400">
                                {formatTime(notification.created_at)}
                              </span>
                              {!notification.is_read && (
                                <Badge className="bg-blue-100 text-blue-800 text-xs">
                                  New
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default NotificationSystem;