import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import type { NextPage } from 'next';
import type { SafeUser } from '@/lib/saml/userService';

const AdminUsersPage: NextPage = () => {
  const router = useRouter();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  
  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/users');
        
        if (response.status === 401) {
          // Not authenticated, redirect to login
          router.push('/login?redirect=/admin/users');
          return;
        }
        
        if (response.status === 403) {
          // Authenticated but not authorized
          setError('You do not have permission to access this page.');
          setIsLoading(false);
          return;
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }
        
        const data = await response.json();
        setUsers(data.users);
        setCurrentUser(data.currentUser);
      } catch (err) {
        setError('Error loading users. Please try again.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUsers();
  }, [router]);
  
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <Head>
        <title>LAAC IdP - User Management</title>
      </Head>
      
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">LAAC Identity Provider - User Management</h1>
          
          {currentUser && (
            <div className="mb-4 text-sm text-gray-600">
              Logged in as: {currentUser.name} ({currentUser.email}) - {currentUser.role}
            </div>
          )}
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          {isLoading ? (
            <div className="text-center py-6">Loading users...</div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold mb-3">Users</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.role}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 text-center">
          <button
            onClick={() => router.push('/api/saml/logout')}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminUsersPage; 