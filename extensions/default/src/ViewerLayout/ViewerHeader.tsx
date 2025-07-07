import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserPreferences } from '@ohif/ui';
import { Toolbar } from '../Toolbar/Toolbar';
import HeaderPatientInfo from './HeaderPatientInfo';
import { PatientInfoVisibility } from './HeaderPatientInfo/HeaderPatientInfo';
import AccessGuard from './AccessGuard';

// Add CSS animation for toast
const toastStyles = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

// Inject styles into head
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = toastStyles;
  document.head.appendChild(styleSheet);
}

// Import Supabase
import { supabaseClient } from '../../../../platform/ui-next/src/lib/utils';
import { createClient } from '@supabase/supabase-js';

// Toast Notification Component
const ToastNotification = ({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-[slideInRight_0.3s_ease-out] max-w-sm">
      <div className={`rounded-xl shadow-2xl border-2 backdrop-blur-sm p-4 ${
        type === 'success' 
          ? 'bg-gradient-to-r from-green-500/90 to-emerald-500/90 border-green-400/50 text-white' 
          : 'bg-gradient-to-r from-red-500/90 to-rose-500/90 border-red-400/50 text-white'
      }`}>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {type === 'success' ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-tight">
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// Toast Container Component
const ToastContainer = ({ toasts, onRemove }: { toasts: Array<{id: number, message: string, type: 'success' | 'error'}>, onRemove: (id: number) => void }) => {
  return (
    <>
      {toasts.map((toast) => (
        <ToastNotification
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </>
  );
};

// Refresh Button Component
const RefreshButton = ({ onRefresh }: { onRefresh: () => void }) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 backdrop-blur-sm border font-medium text-sm shadow-lg hover:shadow-xl bg-slate-600/80 hover:bg-slate-600 text-white border-slate-500/50 hover:scale-105 disabled:opacity-50"
      >
        <svg 
          className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* Compact Tooltip */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[9999]">
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent" style={{borderBottomColor: '#0f172a'}}></div>
        
                 <div className="rounded-lg shadow-2xl border-2 border-slate-600 backdrop-blur-sm overflow-hidden" style={{backgroundColor: '#0f172a', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.8), 0 10px 10px -5px rgba(0, 0, 0, 0.4)'}}>
          <div className="px-3 py-2 text-white text-sm font-medium flex items-center gap-2" style={{backgroundColor: 'rgba(71, 85, 105, 0.9)'}}>
            <span className="text-lg">🔄</span>
            <span className="font-semibold whitespace-nowrap">
              {isRefreshing ? 'Syncing...' : 'Sync Status'}
            </span>
          </div>
          
          <div className="px-3 py-2">
            <div className="text-slate-100 text-xs leading-relaxed font-medium">
              {isRefreshing ? 'Updating thread status' : 'Refresh thread status'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Approve Button Component
const ApproveButton = ({ refreshTrigger, showToast }: { refreshTrigger?: number, showToast: (message: string, type: 'success' | 'error') => void }) => {
  const [isSubmittingApproval, setIsSubmittingApproval] = React.useState(false);
  const [threads, setThreads] = React.useState([]);
  const [isLoadingThreads, setIsLoadingThreads] = React.useState(false);

  // Load comments/threads for current task
  const loadThreads = async () => {
    try {
      setIsLoadingThreads(true);
      
      const urlParams = new URLSearchParams(window.location.search);
      const taskId = urlParams.get('taskId');
      
      if (!taskId) {
        setThreads([]);
        return;
      }

      const supabaseUrl = 'https://bmeemseeqpnsqgwdpcoj.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZWVtc2VlcXBuc3Fnd2RwY29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MjM0OTcsImV4cCI6MjA1OTM5OTQ5N30.qGfF6_6sw5K-9QzDOcwjE-XOpMb-q2D5HgxFRB8LcYA';
      const client = createClient(supabaseUrl, supabaseKey, {
        db: { schema: 'public_v2' }
      });

      const { data: commentsData } = await client
        .from('_annotation_comments')
        .select('id, data')
        .eq('task_assignment_id', taskId);

      // Filter only parent comments (threads), not replies
      const parentComments = (commentsData || []).filter(comment => 
        !comment.data?.parent_comment_id
      );
      
      setThreads(parentComments);
    } catch (error) {
      console.error('Error loading threads:', error);
      setThreads([]);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  React.useEffect(() => {
    loadThreads();
  }, []);

  // Refresh when triggered from parent
  React.useEffect(() => {
    if (refreshTrigger) {
      loadThreads();
    }
  }, [refreshTrigger]);

  const areAllThreadsResolved = (): boolean => {
    if (threads.length === 0) return false;
    return threads.every((thread: any) => thread.data?.status === 'resolved');
  };

  const getUnresolvedCount = (): number => {
    return threads.filter((thread: any) => thread.data?.status !== 'resolved').length;
  };

  const handleApprove = async () => {
    if (!areAllThreadsResolved() || isSubmittingApproval) return;
    
    setIsSubmittingApproval(true);
    
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const taskId = urlParams.get('taskId');
      
      if (!taskId) {
        showToast('No task ID found', 'error');
        return;
      }

      const supabaseUrl = 'https://bmeemseeqpnsqgwdpcoj.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZWVtc2VlcXBuc3Fnd2RwY29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MjM0OTcsImV4cCI6MjA1OTM5OTQ5N30.qGfF6_6sw5K-9QzDOcwjE-XOpMb-q2D5HgxFRB8LcYA';
      const client = createClient(supabaseUrl, supabaseKey, {
        db: { schema: 'public_v2' }
      });

      const { error } = await client.rpc('workflow_annotate_approve', {
        task_assignment_id: taskId
      });
      
      if (error) {
        showToast(`Approval failed: ${error.message}`, 'error');
      } else {
        showToast('Task approved successfully! 🎉', 'success');
        // Refresh threads after approval
        await loadThreads();
      }
    } catch (error) {
      console.error('Approval error:', error);
      showToast('An error occurred while approving', 'error');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const getButtonText = () => {
    if (isLoadingThreads) return 'Loading...';
    if (threads.length === 0) return 'No Threads';
    if (areAllThreadsResolved()) return 'Approve Task';
    const unresolvedCount = getUnresolvedCount();
    return `Review ${unresolvedCount}`;
  };

  const getButtonState = () => {
    if (isLoadingThreads || threads.length === 0 || !areAllThreadsResolved()) {
      return 'disabled';
    }
    return 'ready';
  };

  const getTooltipText = () => {
    if (isLoadingThreads) return 'Loading...';
    if (threads.length === 0) return 'No threads yet';
    if (areAllThreadsResolved()) return 'All threads resolved!';
    const unresolvedCount = getUnresolvedCount();
    return `${unresolvedCount} thread${unresolvedCount === 1 ? '' : 's'} pending. Resolve all to approve.`;
  };

  const buttonState = getButtonState();

  return (
    <div className="relative group">
      <button
        onClick={handleApprove}
        disabled={buttonState === 'disabled' || isSubmittingApproval}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 backdrop-blur-sm border font-medium text-sm shadow-lg hover:shadow-xl ${
          buttonState === 'ready' 
            ? 'bg-green-600/80 hover:bg-green-600 text-white border-green-500/50 hover:scale-105' 
            : threads.length === 0
              ? 'bg-orange-500/50 text-orange-200 border-orange-400/30 cursor-not-allowed opacity-80'
              : 'bg-blue-500/50 text-blue-200 border-blue-400/30 cursor-not-allowed opacity-80'
        }`}
      >
        {/* Icon */}
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          {isSubmittingApproval ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          ) : threads.length === 0 ? (
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          ) : areAllThreadsResolved() ? (
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
          ) : (
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
          )}
        </svg>
        
        {/* Text */}
        <span className="whitespace-nowrap">
          {isSubmittingApproval ? 'Approving...' : getButtonText()}
        </span>
        

      </button>

      {/* Simple Tooltip */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[9999]">
        <div className="relative bg-white text-gray-800 px-3 py-2 rounded-lg shadow-lg border border-gray-200"
          style={{
            minWidth: '180px',
            background: '#ffffff',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          <div className="text-center text-sm font-medium">
            {getTooltipText()}
          </div>
          {/* Clean Arrow */}
          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45"></div>
        </div>
      </div>
    </div>
  );
};

// User Account Component  
const UserAccountHeaderOHIF = () => {
  const [user, setUser] = React.useState(null);
  const [isDropdown, setIsDropdown] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  // Function to get user role from database chain
  const getUserRole = async (userId: string, taskAssignmentId: string): Promise<string> => {
    if (!taskAssignmentId || !userId) return 'Medical Professional';
    
    try {
      console.log(`🔍 Getting role for user ${userId} via task assignment ${taskAssignmentId}`);
      
      // Step 1: Get task_id from _task_assignments
      const { data: taskAssignmentData } = await supabaseClient
        .from('_task_assignments')
        .select('task_id')
        .eq('id', taskAssignmentId)
        .single();
      
      if (!taskAssignmentData?.task_id) {
        console.log('❌ No task_id found in _task_assignments');
        return 'Medical Professional';
      }
      
      // Step 2: Get project_id from _tasks
      const { data: taskData } = await supabaseClient
        .from('_tasks')
        .select('project_id')
        .eq('id', taskAssignmentData.task_id)
        .single();
      
      if (!taskData?.project_id) {
        console.log('❌ No project_id found in _tasks');
        return 'Medical Professional';
      }
      
      // Step 3: Get role from _project_members using project_id
      const { data: memberData } = await supabaseClient
        .from('_project_members')
        .select(`
          role_id,
          _roles!_project_members_role_id_fkey (
            name,
            description
          )
        `)
        .eq('project_id', taskData.project_id)
        .eq('user_id', userId)
        .single();
      
      if (memberData?._roles) {
        const roleData = Array.isArray(memberData._roles) ? memberData._roles[0] : memberData._roles;
        const roleName = roleData?.name || 'Medical Professional';
        console.log(`✅ Found role for user ${userId}: ${roleName}`);
        return roleName;
      }
      
      return 'Medical Professional';
      
    } catch (error) {
      console.log(`❌ Error getting role for user ${userId}:`, error);
      return 'Medical Professional';
    }
  };

  React.useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true);
      
      try {
        // Get URL params
        const urlParams = new URLSearchParams(window.location.search);
        const taskId = urlParams.get('taskId');
        
        // Get authenticated user
        const { data: userData, error: authError } = await supabaseClient.auth.getUser();
        
        if (authError || !userData?.user) {
          console.log('❌ No authenticated user found, using fallback');
          setUser({
            name: 'Dr. Medical User',
            role: 'Medical Professional',
            avatar: null,
            taskId: taskId,
            isAuthenticated: false
          });
          setIsLoading(false);
          return;
        }

        let userName = userData.user.email || 'Medical User';
        let userRole = 'Medical Professional';
        
        // Get user's full name from _users table
        try {
          const { data: userProfile } = await supabaseClient
            .from('_users')
            .select('full_name')
            .eq('id', userData.user.id)
            .single();
          
          if (userProfile?.full_name) {
            userName = userProfile.full_name;
          }
        } catch (e) {
          console.log('Could not get user profile from _users');
        }
        
        // Get user role using task assignment chain
        if (taskId) {
          userRole = await getUserRole(userData.user.id, taskId);
        }
        
        setUser({
          name: userName,
          role: userRole,
          avatar: null,
          taskId: taskId,
          isAuthenticated: true,
          userId: userData.user.id
        });
        
        console.log(`✅ Loaded user: ${userName} (${userRole})`);
        
      } catch (error) {
        console.error('❌ Error loading user data:', error);
        
        // Fallback user
        setUser({
          name: 'Dr. Medical User',
          role: 'Medical Professional',
          avatar: null,
          taskId: null,
          isAuthenticated: false
        });
      }
      
      setIsLoading(false);
    };

    loadUserData();
  }, []);

  const handleLogout = async () => {
    try {
      if (user?.isAuthenticated) {
        await supabaseClient.auth.signOut();
      }
      window.location.href = 'http://localhost:3000';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = 'http://localhost:3000';
    }
  };

  // Get role icon
  const getRoleIcon = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'admin': return '👑';
      case 'reviewer': return '🔍';
      case 'annotator': return '✏️';
      case 'router': return '🔄';
      case 'mitl': return '🤖';
      case 'system user': return '⚙️';
      default: return '👨‍⚕️';
    }
  };

  // Get role color
  const getRoleColor = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'from-red-400 to-red-500';
      case 'reviewer': return 'from-purple-400 to-purple-500';
      case 'annotator': return 'from-green-400 to-green-500';
      case 'router': return 'from-orange-400 to-orange-500';
      case 'mitl': return 'from-pink-400 to-pink-500';
      case 'system user': return 'from-gray-400 to-gray-500';
      default: return 'from-blue-400 to-blue-500';
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-800/50 backdrop-blur-sm text-white/70 animate-pulse">
        <div className="w-8 h-8 bg-slate-700 rounded-lg"></div>
        <div className="hidden md:block">
          <div className="w-20 h-3 bg-slate-700 rounded mb-1"></div>
          <div className="w-16 h-2 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdown(!isDropdown)}
        className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 transition-all duration-300 border border-slate-600/50 backdrop-blur-sm text-white hover:scale-[1.02] shadow-lg hover:shadow-xl group"
      >
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getRoleColor(user.role)} flex items-center justify-center shadow-lg ring-2 ring-slate-600/30 group-hover:ring-slate-500/50 transition-all duration-300`}>
          <span className="text-white text-sm">
            {getRoleIcon(user.role)}
          </span>
        </div>
        <div className="hidden lg:flex flex-col items-start min-w-0 gap-0.5">
          <div className="text-sm font-semibold truncate max-w-32 text-white group-hover:text-emerald-300 transition-colors">
            {user.name}
          </div>
          <div className="text-slate-400 text-xs font-medium bg-slate-700/50 px-2 py-0.5 rounded-md">
            {user.role}
          </div>
        </div>
        <div className="hidden md:block lg:hidden">
          <div className="text-xs font-semibold text-white">
            {user.name?.split(' ')[0] || 'User'}
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform hidden md:block ${isDropdown ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isDropdown && (
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setIsDropdown(false)} 
          />
          <div 
            className="absolute right-0 top-full mt-3 w-72 bg-slate-900 rounded-xl shadow-2xl border border-slate-600/50 z-[9999] overflow-hidden"
            style={{ 
              position: 'absolute',
              zIndex: 9999,
              maxHeight: '80vh',
              overflowY: 'auto',
              backgroundColor: '#0f172a'
            }}
          >
            {/* Clean Header Section */}
            <div className={`bg-gradient-to-r ${getRoleColor(user.role)} p-4`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/25 flex items-center justify-center shadow-lg">
                  <span className="text-white text-lg font-semibold">
                    {getRoleIcon(user.role)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-base truncate">{user.name}</div>
                  <div className="text-white/85 text-sm bg-white/20 px-2 py-0.5 rounded-md inline-block mt-1">
                    {user.role}
                  </div>
                </div>
              </div>
              {user.taskId && (
                <div className="text-white/80 text-xs mt-3 flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Active Task: {user.taskId.substring(0, 8)}...
                </div>
              )}
            </div>

                         {/* Clean Menu Section */}
             <div className="bg-slate-900" style={{ backgroundColor: '#0f172a' }}>
              {/* Status Info */}
              <div className="px-4 py-3 border-b border-slate-700/50">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className={`w-2 h-2 rounded-full ${user.isAuthenticated ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                  {user.isAuthenticated ? 'Authenticated Session' : 'Guest Session'}
                </div>
              </div>

              {/* Dashboard Button */}
              <button
                onClick={() => window.open('http://localhost:3000', '_blank')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/40 transition-colors text-left group border-none bg-transparent"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium text-sm">Management Dashboard</div>
                  <div className="text-slate-400 text-xs">Project management panel</div>
                </div>
                <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Divider */}
              <div className="border-t border-slate-700/50 mx-4"></div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-900/20 transition-colors text-left group border-none bg-transparent"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-red-400 font-medium text-sm">Sign Out</div>
                  <div className="text-red-400/60 text-xs">End current session</div>
                </div>
                <svg className="w-4 h-4 text-red-400/60 group-hover:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Main ViewerHeader Component wrapped with AccessGuard
function ViewerHeaderContent({
  servicesManager,
  appConfig,
}: any) {
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const [toasts, setToasts] = React.useState<Array<{id: number, message: string, type: 'success' | 'error'}>>([]);
  
  const handleRefresh = async () => {
    // Trigger refresh in ApproveButton
    setRefreshTrigger(prev => prev + 1);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  const { t } = useTranslation();

  return (
    <>
      <div 
        className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 shadow-2xl"
        style={{ height: '64px' }}
      >
        {/* Modern Dark Header */}
        <div className="flex items-center justify-between h-full px-6">
          {/* Left - Clean Medical Branding */}
          <div className="flex items-center gap-4 min-w-0">
            <div 
              className="flex items-center gap-4 cursor-pointer group"
              onClick={() => window.location.href = 'http://localhost:3000'}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-all duration-300">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
                </svg>
              </div>
              <div className="hidden lg:block">
                <h1 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Medical AI Platform
                </h1>
                <p className="text-slate-400 text-xs -mt-1 font-medium">
                  Advanced Medical Imaging
                </p>
              </div>
              <div className="hidden md:block lg:hidden">
                <h1 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Medical AI
                </h1>
              </div>
            </div>
            
            {/* Patient Information */}
            <div className="hidden md:block ml-4 pl-4 border-l border-slate-600/50">
              <HeaderPatientInfo 
                servicesManager={servicesManager} 
                appConfig={{ 
                  ...appConfig, 
                  showPatientInfo: PatientInfoVisibility.VISIBLE 
                }} 
              />
            </div>
          </div>

          {/* Center - Clean Toolbar */}
          <div className="flex-1 max-w-2xl mx-6">
            <div 
              className="bg-slate-800/60 backdrop-blur-sm rounded-2xl px-6 py-2.5 border border-slate-600/30 shadow-lg"
              style={{ 
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap'
                }}
                className="[&_button]:w-10 [&_button]:h-10 [&_button]:rounded-xl [&_button]:transition-all [&_button]:duration-300 [&_button]:hover:bg-slate-700 [&_button]:hover:scale-110 [&_button]:border-slate-600/50 [&_button]:flex [&_button]:items-center [&_button]:justify-center [&_button]:shadow-md [&_button]:hover:shadow-lg [&_button]:text-slate-300 [&_button]:hover:text-emerald-400 [&_button]:bg-slate-700/50"
              >
          <Toolbar servicesManager={servicesManager} />
              </div>
            </div>
          </div>

          {/* Right - Comment & Review Buttons + User Account */}
          <div className="flex items-center gap-4">
            {/* 🎯 Comment & Review Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const urlParams = new URLSearchParams(window.location.search);
                  const taskId = urlParams.get('taskId');
                  const studyInstanceUIDs = urlParams.get('StudyInstanceUIDs');
                  
                  if (taskId) {
                    // Create dynamic URL based on current location
                    const currentURL = new URL(window.location.href);
                    
                    // Build comment URL - replace last part of path with 'comments'
                    const pathParts = currentURL.pathname.split('/');
                    pathParts[pathParts.length - 1] = 'comments';
                    const commentPath = pathParts.join('/');
                    
                    const commentURL = new URL(currentURL.origin + commentPath);
                    
                    // Add only the needed parameters
                    const commentParams = new URLSearchParams();
                    if (taskId) commentParams.set('taskId', taskId);
                    if (studyInstanceUIDs) commentParams.set('StudyInstanceUIDs', studyInstanceUIDs);
                    
                    commentURL.search = commentParams.toString();
                    
                    window.open(commentURL.toString(), '_blank');
                  } else {
                    alert('No task ID found in URL');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-xl transition-all duration-300 backdrop-blur-sm border border-blue-500/50 font-medium text-sm shadow-lg hover:shadow-xl hover:scale-105"
                title="Open task comments and discussion"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd"/>
                </svg>
                Comments
              </button>
              
              <ApproveButton refreshTrigger={refreshTrigger} showToast={showToast} />
            </div>
            
            {/* 🔄 Refresh Button - Positioned between Approve and Profile */}
            <RefreshButton onRefresh={handleRefresh} />
            
            <UserAccountHeaderOHIF />
          </div>
        </div>
      </div>
      
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

// Exported component with AccessGuard protection
function ViewerHeader(props: any) {
  return (
    <AccessGuard>
      <ViewerHeaderContent {...props} />
    </AccessGuard>
  );
}

export default ViewerHeader;
