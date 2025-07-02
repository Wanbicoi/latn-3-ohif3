import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabaseClient, testSupabaseConnection, debugDatabaseSchema, checkTablePermissions } from '../../../ui-next/src/lib/utils';

interface Comment {
  id: string;
  author_id: string;
  author_name: string;
  author_role?: string;
  comment: string;
  created_at: string;
  data?: any;
  status?: 'draft' | 'published' | 'resolved';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  attachments?: string[];
}

interface User {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  email?: string;
}

interface SegmentInfo {
  segmentationId: string;
  segmentIndex: string;
  taskId: string;
  studyInstanceUIDs: string;
  seriesDescription?: string;
}

const SegmentComments: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentPriority, setCommentPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [segmentInfo, setSegmentInfo] = useState<SegmentInfo | null>(null);
  const [activeView, setActiveView] = useState<'comments' | 'review' | 'history'>('comments');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all');
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed' | 'offline'>('unknown');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  // Note: projectId is now resolved dynamically via task assignment chain
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // URL parameters
  const segmentationId = searchParams.get('segmentationId') || 'demo-segmentation-id';
  const segmentIndex = searchParams.get('segmentIndex') || '1';
  const taskId = searchParams.get('taskId') || 'demo-task-id';
  const studyInstanceUIDs = searchParams.get('StudyInstanceUIDs') || searchParams.get('studyInstanceUIDs') || 'demo-study-uid';

  // Function to get user role from project membership via task chain
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
      
      console.log(`✅ Found task_id: ${taskAssignmentData.task_id}`);
      
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
      
      console.log(`✅ Found project_id: ${taskData.project_id}`);
      
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
      
      console.log('❌ No role found in _project_members');
      return 'Medical Professional';
      
    } catch (error) {
      console.log(`❌ Error getting role for user ${userId}:`, error);
      return 'Medical Professional';
    }
  };

  useEffect(() => {
    setSegmentInfo({
      segmentationId,
      segmentIndex,
      taskId,
      studyInstanceUIDs
    });

    const loadData = async () => {
      try {
        // Test database connection first
        const connectionTest = await Promise.race([
          testSupabaseConnection(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000))
        ]) as { success: boolean; error?: string; data?: any };
        
        if (connectionTest && connectionTest.success) {
          setConnectionStatus('connected');
          setIsOfflineMode(false);
          
          // Note: Project ID is now resolved dynamically via task chain
        } else {
          throw new Error('Database connection failed');
        }
        
        // Get current user with real role from database
        try {
          const { data: userData } = await supabaseClient.auth.getUser();
          if (userData?.user) {
            let userRole = 'Medical Professional';
            let userName = userData.user.email || 'Medical User';
            
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
              console.log('Could not get user profile');
            }
            
            // Get user's actual role using shared function
            userRole = await getUserRole(userData.user.id, taskId);
            
            setUser({
              id: userData.user.id,
              name: userName,
              email: userData.user.email,
              role: userRole,
            });
            
            console.log(`✅ Current user: ${userName} (${userRole})`);
          }
        } catch (authError) {
          console.warn('⚠️ Auth failed, using fallback user:', authError);
        }

        // Fetch comments from database
        if (taskId && studyInstanceUIDs) {
          await loadComments();
        }
        
      } catch (error) {
        console.error('❌ Failed to load data, switching to offline mode:', error);
        setConnectionStatus('offline');
        setIsOfflineMode(true);
        
        // Create offline demo data
        const offlineComments: Comment[] = [
          {
            id: 'offline-demo-1',
            author_id: 'offline-user',
            author_name: 'Dr. Offline Demo',
            author_role: 'Radiologist',
            comment: '🔌 OFFLINE MODE: This is a demo comment. Working offline.',
            created_at: new Date().toISOString(),
            data: { priority: 'medium', status: 'published' },
            status: 'published',
            priority: 'medium'
          }
        ];
        
        setComments(offlineComments);
        setUser({
          id: 'local-offline-user',
          name: 'Dr. Offline',
          role: 'Medical Professional (Offline)',
        });
      }
    };

    loadData();
  }, [taskId, studyInstanceUIDs, segmentationId, segmentIndex]);

  const loadComments = async () => {
    try {
      const actualTaskId = taskId || 'demo-task-id';
      const actualStudyUID = studyInstanceUIDs || 'demo-study-uid';
      
      // Note: We now get project_id via the task chain in getUserRole function
      // No need to pre-fetch project_id here anymore

      // Fetch comments with user data
      const { data: commentsData, error } = await supabaseClient
        .from('_annotation_comments')
        .select(`
          id,
          author_id,
          comment,
          created_at,
          data,
          _users!_annotation_comments_author_id_fkey (
            id,
            full_name,
            avatar_url,
            is_system
          )
        `)
        .eq('task_assignment_id', actualTaskId)
        .eq('series_instance_uid', actualStudyUID)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Database error loading comments:', error);
        const mockComments: Comment[] = [
          {
            id: 'demo-1',
            author_id: 'demo-user',
            author_name: 'Dr. Demo',
            author_role: 'Radiologist',
            comment: 'This is a demo comment. Database connection issues detected.',
            created_at: new Date().toISOString(),
            data: { priority: 'medium', status: 'published' },
            status: 'published',
            priority: 'medium'
          }
        ];
        setComments(mockComments);
        return;
      }

      // Process comments with real roles
      const formattedComments = await Promise.all(commentsData.map(async (comment: any) => {
        let authorName = 'Medical User';
        let authorRole = 'Medical Professional';
        
        if (comment._users) {
          authorName = comment._users.full_name || 'Medical User';
          
          if (comment._users.is_system) {
            authorRole = 'System User';
          } else {
            // Get real role using task assignment chain
            authorRole = await getUserRole(comment.author_id, actualTaskId);
          }
        }
        
        return {
          id: comment.id,
          author_id: comment.author_id,
          author_name: authorName,
          author_role: authorRole,
          comment: comment.comment || '',
          created_at: comment.created_at,
          data: comment.data || {},
          status: comment.data?.status || 'published',
          priority: comment.data?.priority || 'medium'
        };
      }));
      
      setComments(formattedComments);
      console.log('✅ Loaded comments with roles successfully:', formattedComments.length);
      
    } catch (error) {
      console.error('❌ Complete failure loading comments:', error);
      const welcomeComment: Comment = {
        id: 'welcome-1',
        author_id: 'system',
        author_name: 'System',
        author_role: 'System',
        comment: 'Welcome to the Medical Review System!',
        created_at: new Date().toISOString(),
        data: { priority: 'low', status: 'published' },
        status: 'published',
        priority: 'low'
      };
      setComments([welcomeComment]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setIsLoading(true);

    try {
      const actualTaskId = taskId || 'demo-task-id';
      const actualStudyUID = studyInstanceUIDs || 'demo-study-uid';

      // Get current user
      let currentUserId = null;
      let currentUserName = 'Medical User';
      let currentUserRole = 'Medical Professional';
      let isAuthenticated = false;
      
      try {
        const { data: userData, error: authError } = await supabaseClient.auth.getUser();
        
        if (userData?.user) {
          currentUserId = userData.user.id;
          isAuthenticated = true;
          
          // Get user name
          try {
            const { data: userProfile } = await supabaseClient
              .from('_users')
              .select('full_name')
              .eq('id', currentUserId)
              .single();
            currentUserName = userProfile?.full_name || userData.user.email || 'Medical User';
          } catch (e) {
            currentUserName = userData.user.email || 'Medical User';
          }
          
          // Get user role using task assignment chain
          currentUserRole = await getUserRole(currentUserId, actualTaskId);
        }
      } catch (authError) {
        console.warn('⚠️ Authentication failed:', authError);
      }

      if (!isAuthenticated || !currentUserId) {
        const localComment: Comment = {
          id: `local-${Date.now()}`,
          author_id: 'local-user',
          author_name: currentUserName,
          author_role: currentUserRole,
          comment: newComment.trim(),
          created_at: new Date().toISOString(),
          data: { priority: commentPriority, status: 'published' },
          status: 'published',
          priority: commentPriority
        };
        
        setComments([...comments, localComment]);
        setNewComment('');
        setCommentPriority('medium');
        alert('Comment saved locally. Please login for database sync.');
        setIsLoading(false);
        return;
      }

      const commentData = {
        task_assignment_id: actualTaskId,
        author_id: currentUserId,
        comment: newComment.trim(),
        series_instance_uid: actualStudyUID,
        data: { priority: commentPriority, status: 'published' }
      };

      const { data: savedComment, error } = await supabaseClient
        .from('_annotation_comments')
        .insert(commentData)
        .select('*')
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        const localComment: Comment = {
          id: `local-${Date.now()}`,
          author_id: currentUserId,
          author_name: currentUserName,
          author_role: currentUserRole,
          comment: newComment.trim(),
          created_at: new Date().toISOString(),
          data: commentData.data,
          status: 'published',
          priority: commentPriority
        };
        
        setComments([...comments, localComment]);
        alert('Comment saved locally. Database connection issue.');
      } else {
        const newCommentObj: Comment = {
          id: savedComment.id,
          author_id: savedComment.author_id,
          author_name: currentUserName,
          author_role: currentUserRole,
          comment: savedComment.comment,
          created_at: savedComment.created_at,
          data: savedComment.data || {},
          status: 'published',
          priority: commentPriority
        };
        setComments([...comments, newCommentObj]);
      }

      setNewComment('');
      setCommentPriority('medium');
      
    } catch (error) {
      console.error('❌ Failed to save comment:', error);
      alert(`Comment saved locally. Error: ${error.message || 'Unknown error'}`);
    }

    setIsLoading(false);
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      const { error } = await supabaseClient
        .from('_annotation_comments')
        .update({
          data: {
            ...comments.find(c => c.id === commentId)?.data,
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolved_by: user?.id
          }
        })
        .eq('id', commentId);

      if (!error) {
        setComments(comments.map(c => 
          c.id === commentId ? { ...c, status: 'resolved' as const } : c
        ));
      }
    } catch (error) {
      console.error('❌ Failed to resolve comment:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '📋';
      case 'low': return '💭';
      default: return '💭';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'published': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const handleBackToViewer = () => {
    const actualTaskId = taskId || 'demo-task-id';
    const actualStudyUID = studyInstanceUIDs || 'demo-study-uid';
    const viewerUrl = `/ohif3/monai-label?StudyInstanceUIDs=${actualStudyUID}&taskId=${actualTaskId}`;
    window.location.href = viewerUrl;
  };

  const filteredComments = comments.filter(comment => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'resolved') return comment.status === 'resolved';
    if (filterStatus === 'open') return comment.status !== 'resolved';
    return true;
  });

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600', 
      'from-purple-500 to-purple-600',
      'from-pink-500 to-pink-600',
      'from-indigo-500 to-indigo-600',
      'from-teal-500 to-teal-600'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const getRoleColor = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'reviewer': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'annotator': return 'bg-green-100 text-green-800 border-green-200';
      case 'router': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'mitl': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'system user': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-sm shadow-lg border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleBackToViewer}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl font-semibold"
              >
                ← Back to Viewer
              </button>
              <div className="h-8 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Medical Review & Discussion
                </h1>
                <p className="text-sm text-gray-600">Collaborative annotation review platform</p>
              </div>
            </div>
            
            {/* User Info */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">{user?.name}</div>
                <div className="flex items-center justify-end gap-1">
                  <span className="text-xs">{getRoleIcon(user?.role)}</span>
                  <span className="text-xs text-gray-600 font-medium">{user?.role}</span>
                </div>
              </div>
              <div className={`w-10 h-10 bg-gradient-to-br ${getAvatarColor(user?.name || '')} rounded-full flex items-center justify-center shadow-lg`}>
                <span className="text-white font-bold text-sm">{user?.name?.charAt(0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Segment Information Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 102 0V3h3v1a1 1 0 102 0V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">Segment Analysis & Review</h2>
              <p className="text-gray-600">Detailed discussion and quality assessment for medical annotations</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">Segmentation ID</div>
              <div className="text-sm font-mono text-blue-900 font-semibold">{segmentationId?.substring(0, 8) || 'N/A'}...</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-1">Segment Index</div>
              <div className="text-sm font-semibold text-purple-900">#{segmentIndex || 'N/A'}</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Task ID</div>
              <div className="text-sm font-mono text-green-900 font-semibold">{taskId?.substring(0, 8) || 'N/A'}...</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
              <div className="text-xs font-medium text-orange-600 uppercase tracking-wide mb-1">Study UID</div>
              <div className="text-sm font-mono text-orange-900 font-semibold">{studyInstanceUIDs?.substring(0, 8) || 'N/A'}...</div>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Comments & Reviews</h3>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {filteredComments.length} {filteredComments.length === 1 ? 'comment' : 'comments'}
              </span>
            </div>
          </div>

          <div className="p-6">
            {/* Comments List */}
            <div className="space-y-6 mb-8">
              {filteredComments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No comments yet</h3>
                  <p className="text-gray-500">Be the first to start the medical review discussion.</p>
                </div>
              ) : (
                filteredComments.map((comment) => (
                  <div key={comment.id} className="group">
                    <div className="flex gap-5 p-6 bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300">
                      <div className={`w-14 h-14 bg-gradient-to-br ${getAvatarColor(comment.author_name)} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-white`}>
                        <span className="text-white font-bold text-base">
                          {comment.author_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                              <h4 className="text-base font-bold text-gray-900">{comment.author_name}</h4>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleColor(comment.author_role)}`}>
                                {getRoleIcon(comment.author_role)} {comment.author_role}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {comment.priority && (
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border shadow-sm ${getPriorityColor(comment.priority)}`}>
                                  {getPriorityIcon(comment.priority)} {comment.priority.charAt(0).toUpperCase() + comment.priority.slice(1)}
                                </span>
                              )}
                              {comment.status && (
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${getStatusColor(comment.status)}`}>
                                  ✓ {comment.status === 'resolved' ? 'Resolved' : 'Active'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500 font-medium">{formatDate(comment.created_at)}</span>
                            {comment.status !== 'resolved' && comment.author_id !== user?.id && (
                              <button
                                onClick={() => handleResolveComment(comment.id)}
                                className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-semibold rounded-lg transition-all duration-200"
                              >
                                ✅ Resolve
                              </button>
                            )}
                          </div>
                        </div>
                        {comment.comment && (
                          <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-5 rounded-xl border border-gray-200 shadow-inner">
                            <p className="text-gray-800 leading-relaxed text-sm">{comment.comment}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* New Comment Form */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 bg-gradient-to-br ${getAvatarColor(user?.name || '')} rounded-full flex items-center justify-center shadow-lg`}>
                  <span className="text-white font-bold text-sm">{user?.name?.charAt(0) || 'U'}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Add Your Review</h3>
                  <p className="text-xs text-gray-600">
                    {getRoleIcon(user?.role)} Share your medical insights and observations
                  </p>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <textarea
                      ref={commentTextareaRef}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Share your medical insights, clinical observations, or feedback about this annotation..."
                      className="w-full p-4 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm"
                      rows={4}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-gray-700">Priority</label>
                    <select
                      value={commentPriority}
                      onChange={(e) => setCommentPriority(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      disabled={isLoading}
                    >
                      <option value="low">💭 Low</option>
                      <option value="medium">📋 Medium</option>
                      <option value="high">⚠️ High</option>
                      <option value="critical">🚨 Critical</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-500">
                    💡 Tip: Be specific and constructive in your feedback to help improve annotation quality
                  </p>
                  <button
                    type="submit"
                    disabled={!newComment.trim() || isLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl transition-all duration-300 hover:scale-105 shadow-lg disabled:hover:scale-100 font-semibold"
                  >
                    {isLoading ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                      </svg>
                    )}
                    {isLoading ? 'Posting...' : 'Post Review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SegmentComments; 