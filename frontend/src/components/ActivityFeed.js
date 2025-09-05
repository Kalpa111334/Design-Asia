import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Avatar } from './ui/avatar';
import { 
  Activity, 
  Plus, 
  Edit, 
  Trash2, 
  UserPlus, 
  CheckCircle, 
  Clock,
  AlertCircle,
  Users,
  MessageSquare
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

const ActivityFeed = ({ className = "", limit = 20 }) => {
  const { user, token } = useAuth();
  const { socket } = useSocket(token);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    if (socket) {
      socket.on('activity_created', handleNewActivity);
      
      return () => {
        socket.off('activity_created');
      };
    }
  }, [socket]);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API}/activities?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setActivities(data);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewActivity = (activity) => {
    setActivities(prev => [activity, ...prev.slice(0, limit - 1)]);
  };

  const getActivityIcon = (action) => {
    switch (action) {
      case 'task_created':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'task_updated':
      case 'task_status_changed':
        return <Edit className="w-4 h-4 text-blue-600" />;
      case 'task_deleted':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'user_registered':
        return <UserPlus className="w-4 h-4 text-purple-600" />;
      case 'task_completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'message_sent':
        return <MessageSquare className="w-4 h-4 text-indigo-600" />;
      default:
        return <Activity className="w-4 h-4 text-slate-600" />;
    }
  };

  const getActivityColor = (action) => {
    switch (action) {
      case 'task_created':
        return 'border-l-green-500 bg-green-50';
      case 'task_updated':
      case 'task_status_changed':
        return 'border-l-blue-500 bg-blue-50';
      case 'task_deleted':
        return 'border-l-red-500 bg-red-50';
      case 'user_registered':
        return 'border-l-purple-500 bg-purple-50';
      case 'task_completed':
        return 'border-l-green-500 bg-green-50';
      case 'message_sent':
        return 'border-l-indigo-500 bg-indigo-50';
      default:
        return 'border-l-slate-500 bg-slate-50';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
    return date.toLocaleDateString();
  };

  const getUserInitials = (name) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
  };

  if (isLoading) {
    return (
      <Card className={`card-shadow ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Activity Feed</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`card-shadow ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            <span>Live Activity Feed</span>
          </div>
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        {activities.length === 0 ? (
          <div className="p-6 text-center">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No recent activity</p>
          </div>
        ) : (
          <ScrollArea className="h-80">
            <div className="p-4 space-y-3">
              {activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className={`relative flex items-start space-x-3 p-3 rounded-lg border-l-4 transition-all hover:shadow-sm ${getActivityColor(activity.action)}`}
                >
                  {/* Timeline line */}
                  {index < activities.length - 1 && (
                    <div className="absolute left-7 top-12 w-px h-6 bg-slate-200"></div>
                  )}
                  
                  {/* Activity Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center">
                      {getActivityIcon(activity.action)}
                    </div>
                  </div>
                  
                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <Avatar className="w-5 h-5">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                          {getUserInitials(activity.user_name)}
                        </div>
                      </Avatar>
                      <span className="text-sm font-medium text-slate-900">
                        {activity.user_name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatTime(activity.timestamp)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {activity.description}
                    </p>
                    
                    {activity.task_id && (
                      <Badge className="mt-2 bg-slate-100 text-slate-800 text-xs">
                        Task ID: {activity.task_id.substring(0, 8)}...
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;