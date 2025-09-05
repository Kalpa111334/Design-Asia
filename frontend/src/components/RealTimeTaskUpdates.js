import React, { useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { useSocket } from '../hooks/useSocket';
import { 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  Edit, 
  Trash2,
  Clock,
  Users
} from 'lucide-react';

const RealTimeTaskUpdates = ({ onTaskUpdate, onTaskCreate, onTaskDelete }) => {
  const { user, token } = useAuth();
  const { socket, isConnected } = useSocket(token);

  useEffect(() => {
    if (socket) {
      // Listen for real-time task updates
      socket.on('task_created', handleTaskCreated);
      socket.on('task_updated', handleTaskUpdated);
      socket.on('task_deleted', handleTaskDeleted);
      socket.on('user_online', handleUserOnline);
      socket.on('user_offline', handleUserOffline);
      
      return () => {
        socket.off('task_created');
        socket.off('task_updated');
        socket.off('task_deleted');
        socket.off('user_online');
        socket.off('user_offline');
      };
    }
  }, [socket]);

  const handleTaskCreated = (task) => {
    // Show notification for task creation
    if (task.assigned_by !== user.id) {
      toast.success('New task created', {
        description: `${task.title} has been created`,
        icon: <Plus className="w-4 h-4" />,
      });
    }
    
    // Update task list if callback provided
    if (onTaskCreate) {
      onTaskCreate(task);
    }
  };

  const handleTaskUpdated = (task) => {
    // Show notification for task updates
    if (task.assigned_to === user.id || user.role === 'admin') {
      const statusLabels = {
        'not_started': 'Not Started',
        'in_progress': 'In Progress',
        'paused': 'Paused',
        'completed': 'Completed'
      };
      
      toast.info('Task updated', {
        description: `${task.title} status: ${statusLabels[task.status] || task.status}`,
        icon: <Edit className="w-4 h-4" />,
      });
    }
    
    // Update task list if callback provided
    if (onTaskUpdate) {
      onTaskUpdate(task);
    }
  };

  const handleTaskDeleted = (data) => {
    toast.error('Task deleted', {
      description: 'A task has been removed',
      icon: <Trash2 className="w-4 h-4" />,
    });
    
    // Update task list if callback provided
    if (onTaskDelete) {
      onTaskDelete(data.task_id);
    }
  };

  const handleUserOnline = (userData) => {
    if (user.role === 'admin' && userData.user_id !== user.id) {
      toast.success(`${userData.name} is online`, {
        description: `${userData.role} joined the workspace`,
        icon: <Users className="w-4 h-4" />,
      });
    }
  };

  const handleUserOffline = (userData) => {
    if (user.role === 'admin' && userData.user_id !== user.id) {
      toast.info(`${userData.name} went offline`, {
        description: `${userData.role} left the workspace`,
        icon: <Users className="w-4 h-4" />,
      });
    }
  };

  // This component doesn't render anything visible
  // It only handles real-time updates and notifications
  return null;
};

export default RealTimeTaskUpdates;