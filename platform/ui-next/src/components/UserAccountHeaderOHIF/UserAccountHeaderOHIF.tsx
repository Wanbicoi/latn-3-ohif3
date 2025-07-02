import React, { useState, useEffect } from 'react';
import { User, LogOut, ChevronDown, Shield, UserCircle, Settings, Bell } from 'lucide-react';
import { supabaseClient } from '../../lib/utils';

interface UserInfo {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  project_role?: string;
}

export const UserAccountHeaderOHIF: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get current authenticated user with project role
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setIsLoading(true);
        const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !authUser) {
          setUser(null);
          return;
        }

        // Get additional user info from _users table
        const { data: userProfile } = await supabaseClient
          .from('_users')
          .select('full_name, avatar_url')
          .eq('id', authUser.id)
          .single();

        // Get project role from URL params if available
        const urlParams = new URLSearchParams(window.location.search);
        const taskId = urlParams.get('taskId');
        let projectRole = 'Annotator'; // Default role

        if (taskId) {
          try {
            // Get project info from task assignment
            const { data: taskInfo } = await supabaseClient
              .from('_task_assignments')
              .select(`
                _tasks!inner(
                  project_id
                )
              `)
              .eq('id', taskId)
              .single();

            const projectId = (taskInfo as any)?._tasks?.project_id;
            if (projectId) {
              // Get user's role in this project
              const { data: memberInfo } = await supabaseClient
                .from('_project_members')
                .select('role')
                .eq('user_id', authUser.id)
                .eq('project_id', projectId)
                .single();

              if (memberInfo?.role) {
                projectRole = memberInfo.role;
              }
            }
          } catch (error) {
            console.log('Could not fetch project role:', error);
            // Continue with default role
          }
        }

        setUser({
          id: authUser.id,
          email: authUser.email || '',
          full_name: userProfile?.full_name || 'Anonymous User',
          avatar_url: userProfile?.avatar_url,
          role: 'Medical Professional',
          project_role: projectRole
        });
      } catch (error) {
        console.error('Error fetching user info:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  const handleLogout = async () => {
    try {
      await supabaseClient.auth.signOut();
      // Redirect to latn-5 login or refresh
      window.location.href = 'http://localhost:3000';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm animate-pulse">
        <div className="w-6 h-6 bg-gray-300 rounded-full"></div>
        <div className="w-16 h-3 bg-gray-300 rounded"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2 text-gray-300 text-sm">
        <UserCircle className="w-4 h-4" />
        <span>Not logged in</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* User Account Button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/20 backdrop-blur-sm text-white"
      >
        {/* Avatar */}
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center overflow-hidden">
          {user.avatar_url ? (
            <img 
              src={user.avatar_url} 
              alt={user.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white text-xs font-semibold">
              {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
            </span>
          )}
        </div>

        {/* User Info */}
        <div className="flex flex-col items-start min-w-0">
          <div className="text-sm font-medium truncate max-w-24">
            {user.full_name}
          </div>
          <div className="flex items-center gap-1">
            <Shield className="w-2.5 h-2.5 text-blue-300" />
            <span className="text-blue-200 text-xs">{user.project_role}</span>
          </div>
        </div>

        <ChevronDown className={`w-3 h-3 text-white/70 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsDropdownOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold truncate">
                    {user.full_name}
                  </div>
                  <div className="text-blue-100 text-sm truncate">
                    {user.email}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Shield className="w-3 h-3 text-blue-200" />
                    <span className="text-blue-200 text-xs font-medium">{user.project_role}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <button 
                onClick={() => window.open('http://localhost:3000', '_blank')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <Settings className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Management Dashboard</span>
              </button>

              <button 
                onClick={() => window.open('http://localhost:3001/professional-demo', '_blank')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <Bell className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Platform Overview</span>
              </button>

              <div className="border-t border-gray-100 my-2"></div>

              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-red-600 hover:text-red-700 text-left"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>

            {/* Footer Info */}
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                <div>User ID: {user.id.substring(0, 8)}...</div>
                <div>Session: Active</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}; 