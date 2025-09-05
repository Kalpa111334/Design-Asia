import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  Clock, 
  PlayCircle, 
  PauseCircle, 
  Calendar, 
  BarChart3, 
  LogOut,
  User,
  Building2,
  Timer,
  Target,
  TrendingUp,
  MessageCircle,
  Bell,
  Wifi,
  WifiOff
} from 'lucide-react';
import ChatSystem from './ChatSystem';
import NotificationSystem from './NotificationSystem';
import RealTimeTaskUpdates from './RealTimeTaskUpdates';
import { useSocket } from '../hooks/useSocket';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EmployeeDashboard = () => {
  const { user, logout, token } = useAuth();
  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [timeTracker, setTimeTracker] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        fetchTasks(),
        fetchStats()
      ]);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API}/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.sort((a, b) => {
          // Sort by priority (high first) then by created date
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          }
          return new Date(b.created_at) - new Date(a.created_at);
        }));
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API}/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleUpdateTaskStatus = async (taskId, status) => {
    try {
      const response = await fetch(`${API}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        toast.success('Task status updated');
        fetchTasks();
        fetchStats();
      } else {
        toast.error('Failed to update task status');
      }
    } catch (error) {
      toast.error('Error updating task');
    }
  };

  const handleUpdateActualHours = async (taskId, actualHours) => {
    try {
      const response = await fetch(`${API}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ actual_hours: parseFloat(actualHours) })
      });

      if (response.ok) {
        toast.success('Time logged successfully');
        fetchTasks();
      } else {
        toast.error('Failed to log time');
      }
    } catch (error) {
      toast.error('Error logging time');
    }
  };

  const startTimeTracking = (taskId) => {
    setTimeTracker(prev => ({
      ...prev,
      [taskId]: {
        startTime: Date.now(),
        isTracking: true
      }
    }));
    toast.success('Time tracking started');
  };

  const stopTimeTracking = (taskId) => {
    const tracker = timeTracker[taskId];
    if (tracker && tracker.isTracking) {
      const elapsedHours = (Date.now() - tracker.startTime) / (1000 * 60 * 60);
      const task = tasks.find(t => t.id === taskId);
      const newActualHours = (task.actual_hours || 0) + elapsedHours;
      
      handleUpdateActualHours(taskId, newActualHours);
      
      setTimeTracker(prev => ({
        ...prev,
        [taskId]: {
          ...prev[taskId],
          isTracking: false
        }
      }));
      toast.success(`Tracked ${elapsedHours.toFixed(2)} hours`);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'not_started': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'not_started': return 'Not Started';
      case 'in_progress': return 'In Progress';
      case 'paused': return 'Paused';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  const getCompletionRate = () => {
    if (stats.total_tasks === 0) return 0;
    return Math.round((stats.completed_tasks / stats.total_tasks) * 100);
  };

  const getProductivityScore = () => {
    // Simple productivity calculation based on completed tasks and time efficiency
    const completionRate = getCompletionRate();
    const timeEfficiency = tasks.reduce((acc, task) => {
      if (task.estimated_hours && task.actual_hours && task.status === 'completed') {
        return acc + (task.estimated_hours / task.actual_hours);
      }
      return acc;
    }, 0) / Math.max(1, tasks.filter(t => t.status === 'completed' && t.estimated_hours && t.actual_hours).length);
    
    return Math.min(100, Math.round((completionRate * 0.7) + (timeEfficiency * 30)));
  };

  const isOverdue = (dueDate) => {
    return dueDate && new Date(dueDate) < new Date();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">My Workspace</h1>
                <p className="text-sm text-slate-600">Welcome back, {user.name}</p>
              </div>
            </div>
            <Button 
              onClick={logout}
              variant="outline" 
              className="flex items-center space-x-2 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-white">
            <TabsTrigger value="tasks" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
              My Tasks
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
              Performance
            </TabsTrigger>
          </TabsList>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="card-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Tasks</p>
                      <p className="text-2xl font-bold text-slate-900">{stats.total_tasks || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Completed</p>
                      <p className="text-2xl font-bold text-green-600">{stats.completed_tasks || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Completion Rate</p>
                      <p className="text-2xl font-bold text-purple-600">{getCompletionRate()}%</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Target className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Task Board */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Task Board</h2>
              
              {tasks.map((task) => (
                <Card 
                  key={task.id} 
                  className={`card-shadow hover:shadow-lg transition-all ${
                    isOverdue(task.due_date) && task.status !== 'completed' ? 'border-l-4 border-l-red-500 bg-red-50' : ''
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-slate-900">{task.title}</h3>
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                          <Badge className={getStatusColor(task.status)}>
                            {getStatusLabel(task.status)}
                          </Badge>
                          {isOverdue(task.due_date) && task.status !== 'completed' && (
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-600 mb-3">{task.description}</p>
                        
                        {/* Task Info */}
                        <div className="flex items-center space-x-4 text-sm text-slate-500 mb-4">
                          {task.due_date && (
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span className={isOverdue(task.due_date) ? 'text-red-600 font-medium' : ''}>
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {task.estimated_hours && (
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>Est: {task.estimated_hours}h</span>
                            </div>
                          )}
                          {task.actual_hours && (
                            <div className="flex items-center space-x-1">
                              <Timer className="w-4 h-4" />
                              <span>Logged: {task.actual_hours.toFixed(1)}h</span>
                            </div>
                          )}
                        </div>

                        {/* Time Tracking Progress */}
                        {task.estimated_hours && task.actual_hours && (
                          <div className="mb-4">
                            <div className="flex items-center justify-between text-sm text-slate-600 mb-1">
                              <span>Time Progress</span>
                              <span>{Math.round((task.actual_hours / task.estimated_hours) * 100)}%</span>
                            </div>
                            <Progress 
                              value={Math.min(100, (task.actual_hours / task.estimated_hours) * 100)} 
                              className="h-2"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Select
                          value={task.status}
                          onValueChange={(value) => handleUpdateTaskStatus(task.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_started">Not Started</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Time Tracking Buttons */}
                        {task.status !== 'completed' && (
                          <div className="flex items-center space-x-2">
                            {timeTracker[task.id]?.isTracking ? (
                              <Button
                                onClick={() => stopTimeTracking(task.id)}
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <PauseCircle className="w-4 h-4 mr-1" />
                                Stop
                              </Button>
                            ) : (
                              <Button
                                onClick={() => startTimeTracking(task.id)}
                                variant="outline"
                                size="sm"
                                className="text-green-600 border-green-200 hover:bg-green-50"
                              >
                                <PlayCircle className="w-4 h-4 mr-1" />
                                Start
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Manual Time Entry */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Log hours"
                          className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.target.value) {
                              handleUpdateActualHours(task.id, e.target.value);
                              e.target.value = '';
                            }
                          }}
                        />
                        <Button
                          onClick={(e) => {
                            const input = e.target.parentElement.querySelector('input');
                            if (input.value) {
                              handleUpdateActualHours(task.id, input.value);
                              input.value = '';
                            }
                          }}
                          variant="outline"
                          size="sm"
                        >
                          Log
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {tasks.length === 0 && (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">No tasks assigned</h3>
                  <p className="text-slate-500">Your assigned tasks will appear here</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Performance Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span>Productivity Score</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600 mb-2">
                      {getProductivityScore()}
                    </div>
                    <p className="text-slate-600">Out of 100</p>
                    <Progress value={getProductivityScore()} className="mt-4" />
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <span>Task Statistics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Completion Rate</span>
                      <span className="font-semibold">{getCompletionRate()}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Tasks</span>
                      <span className="font-semibold">{stats.total_tasks || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Completed</span>
                      <span className="font-semibold text-green-600">{stats.completed_tasks || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">In Progress</span>
                      <span className="font-semibold text-blue-600">
                        {tasks.filter(t => t.status === 'in_progress').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Overdue</span>
                      <span className="font-semibold text-red-600">
                        {tasks.filter(t => isOverdue(t.due_date) && t.status !== 'completed').length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle>Recent Completed Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tasks
                    .filter(task => task.status === 'completed')
                    .slice(0, 5)
                    .map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div>
                            <h4 className="font-medium text-slate-900">{task.title}</h4>
                            <p className="text-sm text-slate-600">
                              Completed {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : 'Recently'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                          {task.actual_hours && (
                            <p className="text-sm text-slate-500 mt-1">
                              {task.actual_hours.toFixed(1)}h logged
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  {tasks.filter(task => task.status === 'completed').length === 0 && (
                    <p className="text-center text-slate-500 py-8">No completed tasks yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EmployeeDashboard;