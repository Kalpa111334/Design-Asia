import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { 
  Plus, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  BarChart3, 
  LogOut,
  Edit,
  Trash2,
  Calendar,
  User,
  Building2,
  MessageCircle,
  Bell,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react';
import ChatSystem from './ChatSystem';
import NotificationSystem from './NotificationSystem';
import ActivityFeed from './ActivityFeed';
import RealTimeTaskUpdates from './RealTimeTaskUpdates';
import { useSocket } from '../hooks/useSocket';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = () => {
  const { user, logout, token } = useAuth();
  const { socket, isConnected } = useSocket(token);
  const [activeTab, setActiveTab] = useState('overview');
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: '',
    due_date: '',
    estimated_hours: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        fetchTasks(),
        fetchEmployees(),
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
        setTasks(data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API}/employees`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
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

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const taskData = {
        ...newTask,
        due_date: newTask.due_date ? new Date(newTask.due_date).toISOString() : null,
        estimated_hours: newTask.estimated_hours ? parseFloat(newTask.estimated_hours) : null
      };

      const response = await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });

      if (response.ok) {
        toast.success('Task created successfully');
        setIsCreateDialogOpen(false);
        setNewTask({
          title: '',
          description: '',
          priority: 'medium',
          assigned_to: '',
          due_date: '',
          estimated_hours: ''
        });
        fetchTasks();
        fetchStats();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create task');
      }
    } catch (error) {
      toast.error('Error creating task');
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

  const handleRealTimeTaskUpdate = (updatedTask) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      )
    );
    fetchStats(); // Refresh stats
  };

  const handleRealTimeTaskCreate = (newTask) => {
    setTasks(prevTasks => [newTask, ...prevTasks]);
    fetchStats(); // Refresh stats
  };

  const handleRealTimeTaskDelete = (taskId) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    fetchStats(); // Refresh stats
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        const response = await fetch(`${API}/tasks/${taskId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          toast.success('Task deleted successfully');
          fetchTasks();
          fetchStats();
        } else {
          toast.error('Failed to delete task');
        }
      } catch (error) {
        toast.error('Error deleting task');
      }
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
                <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-sm text-slate-600 flex items-center space-x-2">
                  <span>Welcome back, {user.name}</span>
                  {isConnected ? (
                    <div className="flex items-center space-x-1 text-green-600">
                      <Wifi className="w-3 h-3" />
                      <span className="text-xs">Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-red-600">
                      <WifiOff className="w-3 h-3" />
                      <span className="text-xs">Offline</span>
                    </div>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <NotificationSystem />
              
              <Button 
                onClick={() => setIsChatOpen(true)}
                variant="outline" 
                size="sm"
                className="flex items-center space-x-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Team Chat</span>
              </Button>
              
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
        </div>
      </header>

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-white">
            <TabsTrigger value="overview" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="employees" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
              Employees
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                      <p className="text-sm font-medium text-slate-600">Pending</p>
                      <p className="text-2xl font-bold text-orange-600">{stats.pending_tasks || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <Clock className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Employees</p>
                      <p className="text-2xl font-bold text-purple-600">{stats.total_employees || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Tasks and Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Recent Tasks
                    <Button onClick={() => setActiveTab('tasks')} variant="outline" size="sm">
                      View All
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900">{task.title}</h4>
                          <p className="text-sm text-slate-600 truncate">{task.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                          <Badge className={getStatusColor(task.status)}>
                            {getStatusLabel(task.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <p className="text-center text-slate-500 py-8">No tasks yet. Create your first task!</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Activity Feed */}
              <ActivityFeed limit={10} />
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Task Management</h2>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-indigo-500 hover:bg-indigo-600 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateTask} className="space-y-4">
                    <div>
                      <Label htmlFor="title">Task Title</Label>
                      <Input
                        id="title"
                        value={newTask.title}
                        onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                        placeholder="Enter task title"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <textarea
                        id="description"
                        value={newTask.description}
                        onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                        placeholder="Enter task description"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        rows="3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="priority">Priority</Label>
                        <Select value={newTask.priority} onValueChange={(value) => setNewTask({...newTask, priority: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="assigned_to">Assign To</Label>
                        <Select value={newTask.assigned_to} onValueChange={(value) => setNewTask({...newTask, assigned_to: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="due_date">Due Date</Label>
                        <Input
                          id="due_date"
                          type="date"
                          value={newTask.due_date}
                          onChange={(e) => setNewTask({...newTask, due_date: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="estimated_hours">Est. Hours</Label>
                        <Input
                          id="estimated_hours"
                          type="number"
                          step="0.5"
                          value={newTask.estimated_hours}
                          onChange={(e) => setNewTask({...newTask, estimated_hours: e.target.value})}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex space-x-2 pt-4">
                      <Button type="submit" className="flex-1 bg-indigo-500 hover:bg-indigo-600">
                        Create Task
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {tasks.map((task) => (
                <Card key={task.id} className="card-shadow hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-slate-900">{task.title}</h3>
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                          <Badge className={getStatusColor(task.status)}>
                            {getStatusLabel(task.status)}
                          </Badge>
                        </div>
                        <p className="text-slate-600 mb-3">{task.description}</p>
                        <div className="flex items-center space-x-4 text-sm text-slate-500">
                          {task.assigned_to && (
                            <div className="flex items-center space-x-1">
                              <User className="w-4 h-4" />
                              <span>{employees.find(e => e.id === task.assigned_to)?.name || 'Unknown'}</span>
                            </div>
                          )}
                          {task.due_date && (
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(task.due_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {task.estimated_hours && (
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{task.estimated_hours}h estimated</span>
                            </div>
                          )}
                        </div>
                      </div>
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
                        <Button
                          onClick={() => handleDeleteTask(task.id)}
                          variant="outline"
                          size="sm"
                          className="hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {tasks.length === 0 && (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">No tasks yet</h3>
                  <p className="text-slate-500 mb-4">Create your first task to get started</p>
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">Team Members</h2>
            
            <div className="grid gap-4">
              {employees.map((employee) => (
                <Card key={employee.id} className="card-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{employee.name}</h3>
                          <p className="text-slate-600">{employee.email}</p>
                          <p className="text-sm text-slate-500">
                            Joined {new Date(employee.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          {employee.role}
                        </Badge>
                        <p className="text-sm text-slate-500 mt-1">
                          {tasks.filter(t => t.assigned_to === employee.id).length} tasks assigned
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {employees.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">No employees yet</h3>
                  <p className="text-slate-500">Team members will appear here once they register</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Real-time Components */}
      <RealTimeTaskUpdates 
        onTaskUpdate={handleRealTimeTaskUpdate}
        onTaskCreate={handleRealTimeTaskCreate}
        onTaskDelete={handleRealTimeTaskDelete}
      />
      
      {/* Chat System */}
      <ChatSystem 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </div>
  );
};

export default AdminDashboard;