import React, { useState, useEffect } from 'react';
import { User, LogOut, ChevronDown, Shield, UserCircle, Settings, Bell } from 'lucide-react';
import { supabaseClient } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';

interface UserInfo {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
}

export const UserAccountHeader: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);

  // Get current authenticated user
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !authUser) {
        throw new Error('Not authenticated');
      }

      // Get additional user info from _users table
      const { data: userProfile, error: profileError } = await supabaseClient
        .from('_users')
        .select('full_name, avatar_url')
        .eq('id', authUser.id)
        .single();

      // Get user role (simplified - you can enhance this with proper role lookup)
      const { data: memberInfo } = await supabaseClient
        .from('members')
        .select('*')
        .eq('id', authUser.id)
        .single();

      return {
        id: authUser.id,
        email: authUser.email || '',
        full_name: userProfile?.full_name || memberInfo?.full_name || 'Anonymous',
        avatar_url: userProfile?.avatar_url || memberInfo?.avatar_url,
        role: 'Annotator' // Default role - you can enhance this with proper role system
      };
    },
    retry: 1,
    staleTime: 30000,
  });

  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
    }
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await supabaseClient.auth.signOut();
      window.location.reload(); // Refresh to clear all state
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
        <div className="w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <UserCircle className="w-5 h-5" />
        <span className="text-sm">Not logged in</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* User Account Button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/20 backdrop-blur-sm"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center overflow-hidden">
          {user.avatar_url ? (
            <img 
              src={user.avatar_url} 
              alt={user.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white text-sm font-semibold">
              {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
            </span>
          )}
        </div>

        {/* User Info */}
        <div className="flex flex-col items-start min-w-0">
          <div className="text-white text-sm font-medium truncate max-w-32">
            {user.full_name || user.email}
          </div>
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-blue-300" />
            <span className="text-blue-200 text-xs">{user.role}</span>
          </div>
        </div>

        <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
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
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold truncate">
                    {user.full_name || 'Anonymous User'}
                  </div>
                  <div className="text-blue-100 text-sm truncate">
                    {user.email}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Shield className="w-3 h-3 text-blue-200" />
                    <span className="text-blue-200 text-xs font-medium">{user.role}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <Settings className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Account Settings</span>
              </button>

              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <Bell className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Notifications</span>
              </button>

              <div className="border-t border-gray-100 my-2"></div>

              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-red-600 hover:text-red-700"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>

            {/* Footer Info */}
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                <div>User ID: {user.id.substring(0, 8)}...</div>
                <div>Last login: {new Date().toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}; 