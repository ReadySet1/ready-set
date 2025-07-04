'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logError } from '@/utils/error-logging';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  lastLogin?: string;
}

export default function UsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);
  
  // Fetch users with error handling
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      

      
      // Simulated API call
      const response = await fetch('/api/admin/users');
      
      // Check if response is ok
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setUsers(data.users || []);
      

      
    } catch (err) {
      // Set local state
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      
      // Log to Highlight
      logError(error, {
        message: 'Failed to fetch admin users',
        source: 'api:other',
        additionalContext: {
          component: 'UsersClient',
          path: window.location.pathname
        }
      });
      

      
    } finally {
      setLoading(false);
    }
  };
  
  // Function to handle user status toggle with error tracking
  const toggleUserStatus = async (userId: string, currentStatus: 'active' | 'inactive' | 'pending') => {
    try {
      // Determine new status
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      

      
      // Make API call
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update user status: ${response.status} ${response.statusText}`);
      }
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, status: newStatus as 'active' | 'inactive' | 'pending' } 
          : user
      ));
      

      
    } catch (err) {
      // Create proper error object
      const error = err instanceof Error ? err : new Error(String(err));
      
      // Log to Highlight
      logError(error, {
        message: `Failed to update user status for user ${userId}`,
        source: 'api:other',
        additionalContext: {
          component: 'UsersClient',
          userId,
          currentStatus,
          action: 'toggleUserStatus'
        }
      });
      

      
      // Show error to user (in a real app, you'd likely use a toast notification)
      alert(`Error: ${error.message}`);
    }
  };

  // Render loading state
  if (loading) {
    return <div className="p-4">Loading users...</div>;
  }
  
  // Render error state
  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded">
        <h3 className="text-lg font-semibold text-red-700">Error loading users</h3>
        <p className="text-red-600 mt-2">{error.message}</p>
        <Button 
          onClick={fetchUsers} 
          className="mt-4 bg-red-600 text-white hover:bg-red-700"
        >
          Try Again
        </Button>
      </div>
    );
  }
  
  // Render users
  return (
    <div className="p-4">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold">Users</h2>
        <Button onClick={fetchUsers}>Refresh</Button>
      </div>
      
      {users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-4 border text-left">Name</th>
                <th className="py-2 px-4 border text-left">Email</th>
                <th className="py-2 px-4 border text-left">Role</th>
                <th className="py-2 px-4 border text-left">Status</th>
                <th className="py-2 px-4 border text-left">Last Login</th>
                <th className="py-2 px-4 border text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border">{user.name}</td>
                  <td className="py-2 px-4 border">{user.email}</td>
                  <td className="py-2 px-4 border">{user.role}</td>
                  <td className="py-2 px-4 border">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold
                      ${user.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : user.status === 'inactive' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-yellow-100 text-yellow-800'}`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="py-2 px-4 border">{user.lastLogin || 'Never'}</td>
                  <td className="py-2 px-4 border">
                    <Button 
                      onClick={() => toggleUserStatus(user.id, user.status)}
                      size="sm" 
                      variant={user.status === 'active' ? 'destructive' : 'outline'}
                    >
                      {user.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 