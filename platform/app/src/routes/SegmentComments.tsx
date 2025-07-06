import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { supabaseClient, testSupabaseConnection, debugDatabaseSchema, checkTablePermissions } from '../../../ui-next/src/lib/utils';

// Enhanced Comment Interface with all features
interface Comment {
  id: string;
  author_id: string;
  author_name: string;
  author_role?: string;
  comment: string;
  created_at: string;
  data?: {
    status?: 'draft' | 'published' | 'resolved';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    parent_comment_id?: string; // For threading
    reactions?: {
      [reaction: string]: string[]; // reaction type -> array of user IDs
    };
    resolved_by?: string;
    resolved_at?: string;
  };
  status?: 'draft' | 'published' | 'resolved';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  attachments?: string[];
  replies?: Comment[]; // Nested replies
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
  studyInstanceUIDs: string; // Study level (parent)
  seriesInstanceUID: string; // Series level (specific SEG)
  seriesDescription?: string;
  segmentLabel?: string;
}

// 🎨 Toast Notification Interface
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
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
  const seriesInstanceUID = searchParams.get('seriesInstanceUID') || 'demo-series-uid';

  // Enhanced State Management
  const [replyMode, setReplyMode] = useState<{[key: string]: boolean}>({});
  const [replyTexts, setReplyTexts] = useState<{[key: string]: string}>({});
  const [isSubmittingReply, setIsSubmittingReply] = useState<{[key: string]: boolean}>({});
  const [showReplies, setShowReplies] = useState<{[key: string]: boolean}>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState<{[key: string]: boolean}>({});
  const [showDropdown, setShowDropdown] = useState<{[key: string]: boolean}>({});
  const [userNames, setUserNames] = useState<{[userId: string]: string}>({});
  const [resolvedTooltips, setResolvedTooltips] = useState<{[commentId: string]: string}>({});
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  
  // Enhanced Delete System
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, commentId: string | null}>({
    show: false, 
    commentId: null
  });
  
  // 🎨 Toast Notification State
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Approve Button State
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Refs
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  
  // 🎨 Toast Notification Functions
  const showToast = (type: Toast['type'], title: string, message?: string, duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, type, title, message, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove after duration
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };
  
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  
  // Toast utility shortcuts
  const showError = (title: string, message?: string) => showToast('error', title, message);
  const showSuccess = (title: string, message?: string) => showToast('success', title, message);
  const showWarning = (title: string, message?: string) => showToast('warning', title, message);
  const showInfo = (title: string, message?: string) => showToast('info', title, message);

  // Enhanced Supabase Configuration  
  const supabaseUrl = 'https://bmeemseeqpnsqgwdpcoj.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZWVtc2VlcXBuc3Fnd2RwY29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MjM0OTcsImV4cCI6MjA1OTM5OTQ5N30.qGfF6_6sw5K-9QzDOcwjE-XOpMb-q2D5HgxFRB8LcYA';
  
  const supabaseClient = createClient(supabaseUrl, supabaseKey, {
    db: {
      schema: 'public_v2'
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });



  // Helper Functions
  const getSegmentName = () => {
    return segmentationId || seriesInstanceUID || 'Unknown Segment';
  };

  const getUserRole = async (userId: string, taskAssignmentId: string): Promise<string> => {
    try {
      console.log(`🔍 Getting role for user ${userId} in task assignment ${taskAssignmentId}`);
      
      // Step 1: Get task_id from _task_assignments table
      const { data: taskAssignment, error: taskAssignError } = await supabaseClient
        .from('_task_assignments')
        .select('task_id')
        .eq('id', taskAssignmentId)
        .single();

      if (taskAssignError || !taskAssignment?.task_id) {
        console.log('⚠️ No task found, using default role');
        return 'Clinical Specialist';
      }

      console.log(`✅ Found task_id: ${taskAssignment.task_id}`);
      
      // Step 2: Get project_id from _tasks table
      const { data: task, error: taskError } = await supabaseClient
        .from('_tasks')
        .select('project_id')
        .eq('id', taskAssignment.task_id)
        .single();

      if (taskError || !task?.project_id) {
        console.log('⚠️ No project found, using default role');
        return 'Clinical Specialist';
      }

      console.log(`✅ Found project_id: ${task.project_id}`);
      
      // Step 3: Get role_id from _project_members table
      const { data: projectMember, error: memberError } = await supabaseClient
        .from('_project_members')
        .select('role_id')
        .eq('project_id', task.project_id)
        .eq('user_id', userId)
        .single();

      if (memberError || !projectMember?.role_id) {
        console.log('⚠️ No project membership found, using default role');
        return 'Clinical Specialist';
      }

      console.log(`✅ Found role_id: ${projectMember.role_id}`);
      
      // Step 4: Get role name from _roles table
      const { data: role, error: roleError } = await supabaseClient
        .from('_roles')
        .select('name, description')
        .eq('id', projectMember.role_id)
        .single();

      if (roleError || !role?.name) {
        console.log('⚠️ Role not found, using default');
        return 'Clinical Specialist';
      }

      const roleName = role.name || 'Clinical Specialist';
      console.log(`✅ Final role for user ${userId}: ${roleName}`);
      return roleName;
       
    } catch (error) {
      console.error('❌ Error getting user role:', error);
      return 'Clinical Specialist';
    }
  };

  // Get user name from user ID with caching
  const getUserName = async (userId: string): Promise<string> => {
    if (!userId) return 'Unknown User';
    
    // Check cache first
    if (userNames[userId]) {
      return userNames[userId];
    }

    try {
      const { data, error } = await supabaseClient
        .from('_users')
        .select('full_name')
        .eq('id', userId)
        .single();

      if (!error && data?.full_name) {
        // Cache the result
        setUserNames(prev => ({ ...prev, [userId]: data.full_name }));
        return data.full_name;
      }
    } catch (error) {
      console.warn(`Could not fetch user name for ${userId}:`, error);
    }

    return 'Unknown User';
  };

  // Generate tooltip for resolved comments
  const getResolvedTooltip = async (comment: Comment): Promise<string> => {
    if (comment.data?.status !== 'resolved') return '';
    
    const resolvedBy = comment.data?.resolved_by;
    const resolvedAt = comment.data?.resolved_at;
    
    if (!resolvedBy || !resolvedAt) return '';
    
    const resolverName = await getUserName(resolvedBy);
    const resolvedDate = new Date(resolvedAt);
    
    return `Resolved by ${resolverName} on ${resolvedDate.toLocaleDateString()} at ${resolvedDate.toLocaleTimeString()}`;
  };

  // Enhanced Data Loading
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: userData, error: authError } = await supabaseClient.auth.getUser();
        
        if (userData?.user) {
          const actualTaskId = taskId || 'demo-task-id';
          const role = await getUserRole(userData.user.id, actualTaskId);
          
          const { data: userProfile } = await supabaseClient
            .from('_users')
            .select('full_name')
            .eq('id', userData.user.id)
            .single();

          setUser({
            id: userData.user.id,
            name: userProfile?.full_name || userData.user.email || 'Medical User',
            role: role,
            email: userData.user.email || ''
          });
        } else {
          setUser({
            id: 'demo-user',
            name: 'Dr. Demo',
            role: 'Clinical Specialist',
            email: 'demo@medical.com'
          });
        }
      } catch (error) {
        console.error('❌ Error loading user data:', error);
        setUser({
          id: 'demo-user',
          name: 'Dr. Demo', 
          role: 'Clinical Specialist',
          email: 'demo@medical.com'
        });
      }
    };

    loadData();
  }, [taskId]);

  // Enhanced Comments Loading
  const loadComments = async () => {
    try {
      const actualTaskId = taskId || 'demo-task-id';
      const actualSeriesUID = seriesInstanceUID || 'demo-series-uid';
      


      const { data: commentsData, error } = await supabaseClient
        .from('_annotation_comments')
        .select(`
          id,
          author_id,
          comment,
          created_at,
          data,
          series_instance_uid,
          _users!_annotation_comments_author_id_fkey (
            id,
            full_name,
            avatar_url,
            is_system
          )
        `)
        .eq('task_assignment_id', actualTaskId)
        .eq('series_instance_uid', actualSeriesUID)
        .order('created_at', { ascending: false });

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

      const formattedComments = await Promise.all(commentsData.map(async (comment: any) => {
        let authorName = 'Medical User';
        let authorRole = 'Clinical Specialist';
        
        if (comment._users) {
          authorName = comment._users.full_name || 'Medical User';
          
          if (comment._users.is_system) {
            authorRole = 'System User';
          } else {
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
      
    } catch (error) {
      console.error('❌ Complete failure loading comments:', error);
      const welcomeComment: Comment = {
        id: 'welcome-1',
        author_id: 'system',
        author_name: 'System',
        author_role: 'System',
        comment: 'Welcome to the AI-Powered Medical Review Platform!',
        created_at: new Date().toISOString(),
        data: { priority: 'low', status: 'published' },
        status: 'published',
        priority: 'low'
      };
      setComments([welcomeComment]);
    }
  };

  useEffect(() => {
    loadComments();
  }, [taskId, seriesInstanceUID]);

  // Load resolved tooltips when comments change
  useEffect(() => {
    const loadTooltips = async () => {
      const tooltips: {[commentId: string]: string} = {};
      
      for (const comment of comments) {
        if (comment.data?.status === 'resolved') {
          const tooltip = await getResolvedTooltip(comment);
          if (tooltip) {
            tooltips[comment.id] = tooltip;
          }
        }
      }
      
      setResolvedTooltips(tooltips);
    };

    if (comments.length > 0) {
      loadTooltips();
    }
  }, [comments]);

  // 🔥 REFACTORED: Simplified Comment Submission using Workflow Function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setIsLoading(true);

    try {
      const actualTaskId = taskId || 'demo-task-id';
      const actualSeriesUID = seriesInstanceUID || 'demo-series-uid';

      // 🎯 PRIMARY METHOD: Use workflow function (handles auth, permissions, and business logic)
      try {
        const { error: workflowError } = await supabaseClient.rpc('workflow_annotate_comment', {
          task_assignment_id: actualTaskId,
          comment: newComment.trim(),
          series_instance_uid: actualSeriesUID,
          data: { 
            priority: commentPriority, 
            status: 'published',
            source: 'ohif_ui',
            timestamp: new Date().toISOString()
          }
        });

        if (!workflowError) {
          // ✅ SUCCESS: Function handled everything (auth, insert, workflow progression)
          console.log('✅ Comment submitted successfully via workflow function');
          
          // Reload comments to show the new one
          await loadComments();
          
          // Reset form
          setNewComment('');
          setCommentPriority('medium');
          
          setIsLoading(false);
          return;
        } else {
          console.warn('⚠️ Workflow function failed:', workflowError);
          
          // Check if it's a permission error - STOP immediately, no fallback
          if (workflowError.message && workflowError.message.includes('permission')) {
            showError(
              'Permission Denied',
              'You don\'t have permission to comment on this task. Please contact admin to setup your permissions.'
            );
            setIsLoading(false);
            return;
          }
          
          throw new Error(workflowError.message || 'Workflow function failed');
        }
      } catch (workflowErr) {
        console.warn('⚠️ Workflow function error, trying fallback:', workflowErr);
      }

      // 🔄 FALLBACK METHOD: Direct insert (only if workflow function fails)
      console.log('🔄 Using fallback: Direct database insert');
      
      // Check authentication for fallback
      const { data: userData, error: authError } = await supabaseClient.auth.getUser();
      
      if (authError || !userData?.user) {
        // 💾 OFFLINE FALLBACK: Local storage
        const localComment: Comment = {
          id: `local-${Date.now()}`,
          author_id: 'local-user',
          author_name: 'Offline User',
          author_role: 'Clinical Specialist',
          comment: newComment.trim(),
          created_at: new Date().toISOString(),
          data: { priority: commentPriority, status: 'draft' },
          status: 'draft' as const,
          priority: commentPriority
        };
        
        setComments([...comments, localComment]);
        setNewComment('');
        setCommentPriority('medium');
        console.log('💾 Comment saved locally. Please login to sync to database.');
        setIsLoading(false);
        return;
      }

      // Get user info for fallback
      let currentUserName = userData.user.email || 'Medical User';
      let currentUserRole = 'Clinical Specialist';
      
      try {
        const { data: userProfile } = await supabaseClient
          .from('_users')
          .select('full_name')
          .eq('id', userData.user.id)
          .single();
        currentUserName = userProfile?.full_name || currentUserName;
        currentUserRole = await getUserRole(userData.user.id, actualTaskId);
      } catch (e) {
        console.warn('Could not fetch user profile, using defaults');
      }

      // Direct insert as fallback
      const commentData = {
        task_assignment_id: actualTaskId,
        author_id: userData.user.id,
        comment: newComment.trim(),
        series_instance_uid: actualSeriesUID,
        data: { 
          priority: commentPriority, 
          status: 'published',
          source: 'ohif_ui_fallback',
          fallback_reason: 'workflow_function_unavailable'
        }
      };

      const { data: savedComment, error } = await supabaseClient
        .from('_annotation_comments')
        .insert(commentData)
        .select('*')
        .single();

      if (error) {
        console.error('❌ Fallback insert failed:', error);
        throw new Error(`Database insert failed: ${error.message}`);
      }

      // Add to UI
      const newCommentObj: Comment = {
        id: savedComment.id,
        author_id: savedComment.author_id,
        author_name: currentUserName,
        author_role: currentUserRole,
        comment: savedComment.comment,
        created_at: savedComment.created_at,
        data: savedComment.data || {},
        status: 'published' as const,
        priority: commentPriority
      };
      setComments([...comments, newCommentObj]);

      // Reset form
      setNewComment('');
      setCommentPriority('medium');
      
      console.log('⚠️ Comment saved via fallback method (workflow progression skipped)');
      
    } catch (error) {
      console.error('❌ All comment submission methods failed:', error);
      
      // 💾 LAST RESORT: Local storage for network/server errors only
      const emergencyComment: Comment = {
        id: `emergency-${Date.now()}`,
        author_id: 'emergency-user',
        author_name: 'Emergency User',
        author_role: 'Clinical Specialist',
        comment: newComment.trim(),
        created_at: new Date().toISOString(),
        data: { 
          priority: commentPriority, 
          status: 'draft'
        },
        status: 'draft' as const,
        priority: commentPriority
      };
      
      setComments([...comments, emergencyComment]);
      setNewComment('');
      setCommentPriority('medium');
      
      console.log('💾 Comment saved locally due to error:', error.message || 'Unknown error');
      showWarning(
        'Connection Error',
        'Comment saved locally and will sync when connection is restored.'
      );
    }

    setIsLoading(false);
  };

  // Enhanced Toggle Resolve/Unresolve System
  const handleToggleResolveComment = async (commentId: string) => {
    try {
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;
      
      const isCurrentlyResolved = comment.data?.status === 'resolved';
      const newStatus = isCurrentlyResolved ? 'published' : 'resolved';
      
      const updateData = isCurrentlyResolved 
        ? { 
            ...comment.data,
            status: newStatus as 'published',
            resolved_by: null,
            resolved_at: null
          }
        : { 
            ...comment.data,
            status: newStatus as 'resolved',
            resolved_by: user?.id,
            resolved_at: new Date().toISOString()
          };

      const { error } = await supabaseClient
        .from('_annotation_comments')
        .update({ data: updateData })
        .eq('id', commentId);

      if (!error) {
        setComments(prev => prev.map(c => 
          c.id === commentId 
            ? { 
                ...c, 
                status: newStatus as 'published' | 'resolved', 
                data: { ...c.data, ...updateData }
              } 
            : c
        ));
      }
    } catch (error) {
      console.error('❌ Error toggling resolve status:', error);
    }
  };

  // Date Formatting
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

  // Priority and Status Styling
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-yellow-200 text-yellow-900 border-yellow-400';
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

  // Navigation
  const handleBackToViewer = () => {
    const actualTaskId = taskId || 'demo-task-id';
    const actualStudyUID = studyInstanceUIDs || 'demo-study-uid';
    const viewerUrl = `/ohif3/monai-label?StudyInstanceUIDs=${actualStudyUID}&taskId=${actualTaskId}`;
    window.location.href = viewerUrl;
  };

  // User dropdown handlers
  const handleLogout = async () => {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        console.error('❌ Logout error:', error);
      }
      // Redirect to login or home page
      window.location.href = '/';
    } catch (error) {
      console.error('❌ Error during logout:', error);
      // Force redirect even if logout fails
      window.location.href = '/';
    }
    setShowUserDropdown(false);
  };

  const handleProfile = () => {
    // Navigate to profile page (implement as needed)
    console.log('Navigate to profile');
    setShowUserDropdown(false);
  };

  const handleSettings = () => {
    // Navigate to settings page (implement as needed)
    console.log('Navigate to settings');
    setShowUserDropdown(false);
  };

  // Filtered Comments
  const filteredComments = comments.filter(comment => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'resolved') return comment.data?.status === 'resolved';
    if (filterStatus === 'open') return comment.data?.status !== 'resolved';
    return true;
  });

  // Avatar and Role Styling
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

  // OHIF-style role gradient colors for dropdown
  const getRoleGradientColor = (role?: string) => {
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

  // Enhanced Threading and Reply System
  const handleReply = (commentId: string) => {
    setReplyMode(prev => ({ ...prev, [commentId]: !prev[commentId] }));
    setReplyTexts(prev => ({ ...prev, [commentId]: prev[commentId] || '' }));
  };

  const handleReplySubmit = async (e: React.FormEvent, parentCommentId: string) => {
    e.preventDefault();
    const replyText = replyTexts[parentCommentId];
    if (!replyText?.trim() || !user?.id || isSubmittingReply[parentCommentId]) return;

    setIsSubmittingReply(prev => ({ ...prev, [parentCommentId]: true }));

    try {
      const actualTaskId = taskId || 'demo-task-id';
      const actualSeriesUID = seriesInstanceUID || 'demo-series-uid';

      const replyData = {
        task_assignment_id: actualTaskId,
        author_id: user.id,
        comment: replyText.trim(),
        series_instance_uid: actualSeriesUID,
        data: { 
          priority: 'medium' as const, 
          status: 'published' as const,
          parent_comment_id: parentCommentId
        }
      };

      const { data: savedReply, error } = await supabaseClient
        .from('_annotation_comments')
        .insert(replyData)
        .select('*')
        .single();

      if (!error && savedReply) {
        const newReply: Comment = {
          id: savedReply.id,
          author_id: savedReply.author_id,
          author_name: user.name,
          author_role: user.role,
          comment: savedReply.comment,
          created_at: savedReply.created_at,
          data: savedReply.data || {},
          status: 'published' as const,
          priority: 'medium'
        };
        
        setComments(prev => [...prev, newReply]);
        setReplyTexts(prev => ({ ...prev, [parentCommentId]: '' }));
        setReplyMode(prev => ({ ...prev, [parentCommentId]: false }));
      }
    } catch (error) {
      console.error('❌ Failed to save reply:', error);
    } finally {
      setIsSubmittingReply(prev => ({ ...prev, [parentCommentId]: false }));
    }
  };

  // Enhanced Reactions System (GitLab-style)
  const handleReaction = async (commentId: string, reaction: string) => {
    if (!user?.id) return;

    try {
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;

      const currentReactions = comment.data?.reactions || {};
      const reactionUsers = currentReactions[reaction] || [];
      
      let updatedReactionUsers: string[];
      if (reactionUsers.includes(user.id)) {
        // Remove reaction
        updatedReactionUsers = reactionUsers.filter(id => id !== user.id);
      } else {
        // Add reaction
        updatedReactionUsers = [...reactionUsers, user.id];
      }

      const updatedReactions = {
        ...currentReactions,
        [reaction]: updatedReactionUsers
      };

      // Clean up empty reaction arrays
      Object.keys(updatedReactions).forEach(key => {
        if (updatedReactions[key].length === 0) {
          delete updatedReactions[key];
        }
      });

      const { error } = await supabaseClient
        .from('_annotation_comments')
        .update({
          data: {
            ...comment.data,
            reactions: updatedReactions
          }
        })
        .eq('id', commentId);

      if (!error) {
        setComments(prev => prev.map(c => 
          c.id === commentId 
            ? { ...c, data: { ...c.data, reactions: updatedReactions } } 
            : c
        ));
      }
    } catch (error) {
      console.error('❌ Failed to update reaction:', error);
    }
  };

  // Threading Helper Functions
  const getThreadedComments = () => {
    const parentComments = comments.filter(c => !c.data?.parent_comment_id);
    const childComments = comments.filter(c => c.data?.parent_comment_id);
    
    return parentComments.map(parent => ({
      ...parent,
      replies: childComments.filter(child => child.data?.parent_comment_id === parent.id)
    }));
  };

  // Enhanced Statistics for Header
  const getThreadsStats = () => {
    const threads = getThreadedComments();
    const totalThreads = threads.length;
    const resolvedThreads = threads.filter(thread => thread.data?.status === 'resolved').length;
    const openThreads = totalThreads - resolvedThreads;
    return { totalThreads, resolvedThreads, openThreads };
  };

  const getPriorityStats = () => {
    const criticalCount = comments.filter(c => c.priority === 'critical').length;
    const highCount = comments.filter(c => c.priority === 'high').length;
    const mediumCount = comments.filter(c => c.priority === 'medium').length;
    const lowCount = comments.filter(c => c.priority === 'low').length;
    return { criticalCount, highCount, mediumCount, lowCount };
  };

  // 🎯 Approve Button Functions
  const areAllThreadsResolved = (): boolean => {
    const threads = getThreadedComments();
    // Must have at least 1 thread AND all threads must be resolved
    if (threads.length === 0) return false;
    return threads.length > 0 && threads.every(thread => thread.data?.status === 'resolved');
  };

  const handleApproveAll = async () => {
    if (!areAllThreadsResolved() || isSubmittingApproval) return;
    
    setIsSubmittingApproval(true);
    
    try {
      const actualTaskId = taskId || 'demo-task-id';
      const actualSegmentationId = segmentationId || 'demo-segmentation-id';
      
      console.log('🎯 Submitting approval for:', {
        task_assignment_id: actualTaskId,
        segmentation_id: actualSegmentationId
      });
      
      // Call the workflow function
      const { error } = await supabaseClient.rpc('workflow_annotate_submit', {
        task_assignment_id: actualTaskId,
        segmentation_id: actualSegmentationId
      });
      
      if (error) {
        console.error('❌ Approval failed:', error);
        showError('Approval Failed', error.message || 'Failed to submit approval. Please try again.');
      } else {
        console.log('✅ Approval submitted successfully');
        showSuccess('Approval Submitted', 'All threads have been reviewed and approved successfully!');
        
        // Optionally reload comments or update UI state
        await loadComments();
      }
    } catch (error) {
      console.error('❌ Approval error:', error);
      showError('Approval Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const toggleReplies = (commentId: string) => {
    setShowReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  // Enhanced Delete System with Professional Dialog
  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabaseClient
        .from('_annotation_comments')
        .delete()
        .eq('id', commentId);

      if (!error) {
        setComments(prev => {
          const updatedComments = prev.filter(c => c.id !== commentId);
          
          if (updatedComments.length === prev.length) {
            return prev.map(comment => ({
              ...comment,
              replies: comment.replies?.filter(reply => reply.id !== commentId) || []
            }));
          }
          
          return updatedComments;
        });
        
        setDeleteConfirm({show: false, commentId: null});
      } else {
        console.error('❌ Failed to delete comment:', error);
        alert('Failed to delete comment. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error deleting comment:', error);
      alert('Error deleting comment. Please try again.');
    }
  };

  const confirmDeleteComment = (commentId: string) => {
    setDeleteConfirm({show: true, commentId});
  };

  const canDeleteComment = (comment: Comment) => {
    return comment.author_id === user?.id || user?.role?.toLowerCase() === 'admin';
  };

  // UI State Management
  const toggleDropdown = (commentId: string) => {
    setShowDropdown(prev => ({ ...prev, [commentId]: !prev[commentId] }));
    setShowEmojiPicker(prev => ({ ...prev, [commentId]: false }));
  };

  const toggleEmojiPicker = (commentId: string) => {
    setShowEmojiPicker(prev => ({ ...prev, [commentId]: !prev[commentId] }));
    setShowDropdown(prev => ({ ...prev, [commentId]: false }));
  };

  // Enhanced Click Outside Handler
  useEffect(() => {
    const handleClickOutside = () => {
      setShowDropdown({});
      setShowEmojiPicker({});
      setShowUserDropdown(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Enhanced Enter Key Handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newComment.trim() && !isLoading) {
        handleSubmit(e as any);
      }
    }
  };

  // Auto-focus Enhancement
  useEffect(() => {
    if (commentInputRef.current && activeView === 'comments') {
      commentInputRef.current.focus();
    }
  }, [activeView]);

  // Enhanced CSS Class Application
  useEffect(() => {
    document.body.classList.add('medical-interface', 'comment-page-body');
    
    return () => {
      document.body.classList.remove('medical-interface', 'comment-page-body');
    };
  }, []);

  return (
    <div className="comment-page-wrapper min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Enhanced Professional Header */}
      <div className="header-section">
        <div className="w-full px-6 py-3">
          <div className="flex items-center justify-between w-full">
            {/* Left Section */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-white/20">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              
              <div>
                <h1 className="text-lg font-bold text-white" style={{color: '#ffffff'}}>AI-Powered Medical Review</h1>
                <p className="text-blue-200 text-xs" style={{color: '#ffffff'}}>Advanced Diagnostic Assessment Platform</p>
              </div>
              
              <button 
                onClick={handleBackToViewer}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 backdrop-blur-sm border border-white/20 font-medium text-sm ml-6"
                style={{color: '#ffffff'}}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span style={{color: '#ffffff'}}>Viewer</span>
              </button>
            </div>
            {/* Right Section - OHIF-style User Dropdown */}
            <div className="flex items-center">
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUserDropdown(!showUserDropdown);
                  }}
                  className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 transition-all duration-300 border border-slate-600/50 backdrop-blur-sm text-white hover:scale-[1.02] shadow-lg hover:shadow-xl group"
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getRoleGradientColor(user?.role)} flex items-center justify-center shadow-lg ring-2 ring-slate-600/30 group-hover:ring-slate-500/50 transition-all duration-300`}>
                    <span className="text-white text-sm">
                      {getRoleIcon(user?.role)}
                    </span>
                  </div>
                  <div className="hidden lg:flex flex-col items-start min-w-0 gap-0.5">
                    <div className="text-sm font-semibold truncate max-w-32 text-white group-hover:text-emerald-300 transition-colors">
                      {user?.name || 'Medical Professional'}
                    </div>
                    <div className="text-slate-400 text-xs font-medium bg-slate-700/50 px-2 py-0.5 rounded-md">
                      {user?.role || 'Professional'}
                    </div>
                  </div>
                  <div className="hidden md:block lg:hidden">
                    <div className="text-xs font-semibold text-white">
                      {user?.name?.split(' ')[0] || 'User'}
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform hidden md:block ${showUserDropdown ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* OHIF-style Dropdown Menu */}
                {showUserDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-[9998]" 
                      onClick={() => setShowUserDropdown(false)} 
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
                      {/* Header Section with Role-based Gradient */}
                      <div className={`bg-gradient-to-r ${getRoleGradientColor(user?.role)} p-4`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/25 flex items-center justify-center shadow-lg">
                            <span className="text-white text-lg font-semibold">
                              {getRoleIcon(user?.role)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-bold text-base truncate">{user?.name || 'Medical Professional'}</div>
                            <div className="text-white/85 text-sm bg-white/20 px-2 py-0.5 rounded-md inline-block mt-1">
                              {user?.role || 'Professional'}
                            </div>
                          </div>
                        </div>
                        {(taskId || segmentationId) && (
                          <div className="text-white/80 text-xs mt-3 flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Active Task: {(taskId || segmentationId)?.substring(0, 8)}...
                          </div>
                        )}
                      </div>

                      {/* Menu Section */}
                      <div className="bg-slate-900" style={{ backgroundColor: '#0f172a' }}>
                        {/* Status Info */}
                        <div className="px-4 py-3 border-b border-slate-700/50">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <div className={`w-2 h-2 rounded-full ${user?.id !== 'demo-user' ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                            {user?.id !== 'demo-user' ? 'Authenticated Session' : 'Demo Session'}
                          </div>
                        </div>

                        {/* Management Dashboard Button */}
                        <button
                          onClick={() => {
                            window.open('http://localhost:3000', '_blank');
                            setShowUserDropdown(false);
                          }}
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
                          onClick={() => {
                            handleLogout();
                            setShowUserDropdown(false);
                          }}
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
            </div>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="comment-page-content">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Enhanced SEG Information Card */}
          <div className="bg-gradient-to-br from-white via-slate-50 to-blue-50 rounded-3xl shadow-2xl border border-slate-200/50 p-8 mb-8 backdrop-blur-sm">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-white/50">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold text-black" style={{color: '#000000'}}>
                    Clinical Assessment
                  </h2>
                  <span className="series-badge">
                    🎯 DICOM Series
                  </span>
                </div>
                <p className="text-black font-medium text-sm" style={{color: '#000000'}}>Professional medical annotation review & diagnostic discussion platform</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/80 rounded-xl border border-slate-200 shadow-sm">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-black" style={{color: '#000000'}}>Live Session</span>
              </div>
            </div>
            
            {/* Enhanced Grid with Hierarchy Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Study Level */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-5 border border-blue-200/60 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">Study Level</div>
                    <div className="text-xs text-blue-600">Parent Container</div>
                  </div>
                </div>
                <div className="id-display text-blue-900 p-3 rounded-lg border border-blue-200/50">
                  {studyInstanceUIDs || 'N/A'}
                </div>
              </div>

              {/* Series Level - Current SEG */}
              <div className="current-seg-enhanced rounded-2xl p-5 border-2 shadow-lg ring-2 ring-emerald-200/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="current-seg-text text-xs uppercase tracking-wider">CURRENT SEG</div>
                    <div className="current-seg-text text-xs">{getSegmentName()}</div>
                  </div>
                </div>
                <div className="id-display current-seg-text bg-white/20 p-3 rounded-lg border border-white/30">
                  {seriesInstanceUID || 'N/A'}
                </div>
              </div>

              {/* Task Level */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-100 rounded-2xl p-5 border border-purple-200/60 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-purple-700 uppercase tracking-wider">Task Level</div>
                    <div className="text-xs text-purple-600">Assignment Context</div>
                  </div>
                </div>
                <div className="id-display text-purple-900 p-3 rounded-lg border border-purple-200/50">
                  {taskId || 'N/A'}
                </div>
              </div>
            </div>

            {/* Enhanced Stats Header */}
            <div className="bg-white mt-6 p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 flex-wrap">
                  {/* Total Comments - Gray */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd"/>
                    </svg>
                    <span className="text-gray-700 text-sm font-medium">
                      <span className="font-bold text-gray-900">{comments.length}</span> total {comments.length === 1 ? 'comment' : 'comments'}
                    </span>
                  </div>

                  {/* Threads - Blue */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
                      <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/>
                    </svg>
                    <span className="text-blue-700 text-sm font-medium">
                      <span className="font-bold text-blue-900">{getThreadsStats().totalThreads}</span> {getThreadsStats().totalThreads === 1 ? 'thread' : 'threads'}
                    </span>
                  </div>

                  {/* Resolved - Green */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    <span className="text-green-700 text-sm font-medium">
                      <span className="font-bold text-green-900">{getThreadsStats().resolvedThreads}</span> resolved
                    </span>
                  </div>

                  {/* Open - Orange */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg border border-orange-200">
                    <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                    </svg>
                    <span className="text-orange-700 text-sm font-medium">
                      <span className="font-bold text-orange-900">{getThreadsStats().openThreads}</span> open
                    </span>
                  </div>

                  {/* Priority Badges */}
                  {getPriorityStats().criticalCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
                      <span className="text-red-600 text-lg">🚨</span>
                      <span className="text-red-700 text-sm font-medium">
                        <span className="font-bold text-red-900">{getPriorityStats().criticalCount}</span> critical issues
                      </span>
                    </div>
                  )}
                  {getPriorityStats().highCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-lg border border-yellow-200">
                      <span className="text-yellow-600 text-lg">⚠️</span>
                      <span className="text-yellow-700 text-sm font-medium">
                        <span className="font-bold text-yellow-900">{getPriorityStats().highCount}</span> high priority
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>Real-time</span>
                  </div>
                  <span>•</span>
                  <span>🔒 Secure</span>
                  <span>•</span>
                  <span>💾 Auto-saved</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Comments Section */}
          <div className="bg-gradient-to-br from-white via-slate-50 to-blue-50 rounded-3xl shadow-2xl border border-slate-200/50 mb-8 backdrop-blur-sm">
            {/* Header with Tabs */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between mb-6">
                                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-xl transform hover:scale-105 transition-all duration-300">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-xl font-bold text-black">
                          Diagnostic Review
                        </h3>
                        <p className="text-sm text-gray-500 font-medium">Advanced clinical analysis & assessment</p>
                      </div>
                      <span className="px-3 py-1.5 bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 rounded-full text-sm font-semibold shadow-md">
                        📊 Clinical Data
                      </span>
                    </div>
                  <span className="comment-count-badge">
                    📊 {filteredComments.length} {filteredComments.length === 1 ? 'review' : 'reviews'}
                  </span>
                  
                  {/* 🎯 Professional Approve Button */}
                  {getThreadsStats().totalThreads === 0 ? (
                    <div className="relative ml-6 px-8 py-4 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl font-bold text-sm shadow-lg border-2 backdrop-blur-sm opacity-60"
                      style={{
                        background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 50%, #4b5563 100%)',
                        boxShadow: '0 8px 32px rgba(156, 163, 175, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                        filter: 'drop-shadow(0 4px 8px rgba(156, 163, 175, 0.2))',
                        borderColor: 'rgba(209, 213, 219, 0.5)',
                        color: '#ffffff'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                          </svg>
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="font-bold text-sm tracking-wide" style={{ color: '#ffffff', textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)' }}>
                            NO THREADS YET
                          </span>
                          <span className="text-xs font-medium" style={{ color: '#f3f4f6', textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)' }}>
                            Start discussion to enable approval
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : areAllThreadsResolved() ? (
                    <button
                      onClick={handleApproveAll}
                      disabled={isSubmittingApproval}
                      className="relative ml-6 px-8 py-4 text-white rounded-xl font-bold text-sm transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl border-2 backdrop-blur-sm"
                      style={{
                        background: isSubmittingApproval 
                          ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%)' 
                          : 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                        boxShadow: isSubmittingApproval 
                          ? '0 8px 32px rgba(107, 114, 128, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)' 
                          : '0 8px 32px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                        filter: isSubmittingApproval 
                          ? 'drop-shadow(0 4px 8px rgba(107, 114, 128, 0.3))' 
                          : 'drop-shadow(0 4px 8px rgba(16, 185, 129, 0.3))',
                        borderColor: isSubmittingApproval ? 'rgba(156, 163, 175, 0.5)' : 'rgba(52, 211, 153, 0.6)',
                        color: '#ffffff'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                          {isSubmittingApproval ? (
                            <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                            </svg>
                          )}
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="font-bold text-sm tracking-wide" style={{ color: '#ffffff', textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)' }}>
                            {isSubmittingApproval ? 'SUBMITTING...' : 'APPROVE ALL'}
                          </span>
                          <span className="text-xs font-medium" style={{ color: '#f0fdf4', textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)' }}>
                            {isSubmittingApproval ? 'Processing approval' : 'All threads resolved'}
                          </span>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="status-group relative ml-6 group">
                      {/* Enhanced Review Status Button */}
                      <div className="status-button medical-button-pending relative px-8 py-4 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl border-2 backdrop-blur-sm transition-all duration-300 transform hover:scale-105 cursor-pointer"
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 40%, #1d4ed8 70%, #1e40af 100%)',
                          boxShadow: '0 8px 32px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                          textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                          filter: 'drop-shadow(0 4px 8px rgba(59, 130, 246, 0.3))',
                          borderColor: 'rgba(147, 197, 253, 0.6)',
                          color: '#ffffff'
                        }}
                        title={`${getThreadsStats().openThreads} threads need to be resolved before approval`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                            </svg>
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-bold text-sm tracking-wide" style={{ color: '#ffffff', textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)' }}>
                              REVIEW STATUS
                            </span>
                            <span className="text-xs font-medium" style={{ color: '#e0f2fe', textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)' }}>
                              Pending clinical review
                            </span>
                          </div>
                        </div>
                        
                        {/* Animated Progress Bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 rounded-b-xl overflow-hidden">
                          <div 
                            className="progress-bar h-full transition-all duration-500 ease-out"
                            style={{
                              width: `${(getThreadsStats().resolvedThreads / getThreadsStats().totalThreads) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Animated Notification Badge */}
                      <div className="notification-badge absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-red-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                        style={{
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4), 0 0 0 4px rgba(239, 68, 68, 0.1)'
                        }}
                      >
                        <span className="text-white text-xs font-bold counter-badge">
                          {getThreadsStats().openThreads}
                        </span>
                      </div>
                      
                      {/* Friendly Status Tooltip */}
                      <div className="status-tooltip absolute -bottom-20 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-20">
                        <div className="bg-white text-gray-800 px-5 py-4 rounded-2xl shadow-2xl border border-gray-200 backdrop-blur-sm"
                          style={{
                            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.1)',
                            backdropFilter: 'blur(12px)',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif'
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                              <span className="text-white text-xs">📊</span>
                            </div>
                            <span className="text-gray-700 font-medium text-base leading-relaxed"
                              style={{ 
                                fontWeight: '500', 
                                letterSpacing: '0.01em',
                                lineHeight: '1.5'
                              }}
                            >
                              {getThreadsStats().resolvedThreads} of {getThreadsStats().totalThreads} threads completed
                            </span>
                          </div>
                          {/* Friendly Tooltip Arrow */}
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45"
                            style={{
                              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                            }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Subtle Glow Effect */}
                      <div className="glow-background absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-indigo-600/20 blur-xl -z-10"></div>
                    </div>
                  )}
                </div>
                
                {/* Real-time indicator */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 rounded-xl border border-slate-200 shadow-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-black" style={{color: '#000000'}}>Live</span>
                  </div>
                  
                  {/* Filter dropdown */}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                  >
                    <option value="all">All Assessments</option>
                    <option value="open">Pending Review</option>
                    <option value="resolved">Completed</option>
                  </select>
                  

                </div>
              </div>

              {/* Enhanced Navigation Tabs */}
              <div className="enhanced-tabs">
                              {[
                { id: 'comments', label: '💬 Medical Reviews', icon: '💬' },
                { id: 'review', label: '📊 Clinical Analytics', icon: '📊' },
                { id: 'history', label: '🏥 Activity Timeline', icon: '🏥' }
              ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveView(tab.id as any)}
                    className={`enhanced-tab flex-1 ${
                      activeView === tab.id ? 'active' : ''
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {/* GitLab-Style Medical Comment System */}
              {activeView === 'comments' && (
                <div className="medical-comment-system bg-white rounded-lg border border-gray-200 shadow-sm">
                  
                  {/* New Comment Form with Enter Key Support */}
                  <div className="border-b border-gray-200 p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 bg-gradient-to-br ${getAvatarColor(user?.name || '')} rounded-full flex items-center justify-center shadow-md flex-shrink-0`}>
                        <span className="text-white font-bold text-sm">{user?.name?.charAt(0) || 'U'}</span>
                      </div>
                      <div className="flex-1">
                        <div className="mb-3">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-semibold text-gray-900">{user?.name || 'Clinical Specialist'}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user?.role)}`}>
                              {getRoleIcon(user?.role)} {user?.role || 'Professional'}
                            </span>
                          </div>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div>
                            <textarea
                              ref={commentInputRef}
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              onKeyDown={handleKeyDown}
                              placeholder={`Add your clinical assessment for ... (Press Enter to send, Shift+Enter for new line)`}
                              className="main-comment-textarea w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-vertical min-h-[100px]"
                              rows={4}
                              disabled={isLoading}
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Priority:</label>
                                <select
                                  value={commentPriority}
                                  onChange={(e) => setCommentPriority(e.target.value as any)}
                                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                  <option value="low">💭 Low Priority</option>
                                  <option value="medium">📋 Medium Priority</option>
                                  <option value="high">⚠️ High Priority</option>
                                  <option value="critical">🚨 Critical Issue</option>
                                </select>
                              </div>
                              
                              <div className="comment-hints flex items-center gap-4 text-xs text-gray-500">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                                  </svg>
                                  <span>💡 Use markdown for formatting</span>
                                </div>
                                <div className="keyboard-hint">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                                  </svg>
                                  <span>⌨️ Enter to send, Shift+Enter for new line</span>
                                </div>
                              </div>
                            </div>
                            
                            <button
                              type="submit"
                              disabled={!newComment.trim() || isLoading}
                              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {isLoading ? (
                                <>
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                  </svg>
                                  Submitting...
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd"/>
                                  </svg>
                                  Comment
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Threaded Comments Display */}
                  <div className="divide-y divide-gray-200">
                    {getThreadedComments().length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No comments yet</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                          Start the clinical discussion by adding your professional assessment of the {getSegmentName()} annotation above.
                        </p>
                      </div>
                    ) : (
                      getThreadedComments()
                        .filter(comment => {
                          if (filterStatus === 'all') return true;
                          if (filterStatus === 'resolved') return comment.data?.status === 'resolved';
                          if (filterStatus === 'open') return comment.data?.status !== 'resolved';
                          return true;
                        })
                        .map((comment) => {
                          const isResolved = comment.data?.status === 'resolved';
                          return (
                            <div 
                              key={comment.id} 
                              className={`p-6 ${isResolved ? 'comment-resolved bg-green-50 border-l-4 border-green-400' : ''}`}
                              title={isResolved ? resolvedTooltips[comment.id] || 'This comment has been resolved' : ''}
                            >

                              
                              {/* Main Comment */}
                              <div className="flex items-start gap-4">
                                {/* User Avatar */}
                                <div className={`w-10 h-10 bg-gradient-to-br ${getAvatarColor(comment.author_name)} rounded-full flex items-center justify-center flex-shrink-0 shadow-md`}>
                                  <span className="text-white font-bold text-sm">
                                    {comment.author_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                  </span>
                                </div>
                                
                                {/* Comment Content */}
                                <div className="flex-1 min-w-0">
                                  {/* Header */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                      <span className="font-semibold text-gray-900">{comment.author_name}</span>
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(comment.author_role)}`}>
                                        {getRoleIcon(comment.author_role)} {comment.author_role}
                                      </span>
                                      {comment.priority && comment.priority !== 'medium' && (
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(comment.priority)}`}>
                                          {getPriorityIcon(comment.priority)} {comment.priority.toUpperCase()}
                                        </span>
                                      )}
                                      <span className="text-sm text-gray-500">
                                        {formatDate(comment.created_at)}
                                      </span>
                                    </div>
                                    
                                    {/* Dropdown Menu */}
                                    {canDeleteComment(comment) && (
                                      <div className="relative">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleDropdown(comment.id);
                                          }}
                                          className="dropdown-button"
                                        >
                                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                                          </svg>
                                        </button>
                                        
                                        {showDropdown[comment.id] && (
                                          <div className="absolute right-0 top-8 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                            <button
                                              onClick={() => {
                                                confirmDeleteComment(comment.id);
                                                setShowDropdown(prev => ({ ...prev, [comment.id]: false }));
                                              }}
                                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                              Delete
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Comment Body */}
                                  <div className="prose prose-sm max-w-none mb-4">
                                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                                      {comment.comment}
                                    </p>
                                  </div>

                                  {/* Enhanced GitLab-style Reactions */}
                                  {comment.data?.reactions && Object.keys(comment.data.reactions).length > 0 && (
                                    <div className="flex items-center flex-wrap gap-2 mb-3">
                                      {Object.entries(comment.data.reactions).map(([reaction, users]) => (
                                        users.length > 0 && (
                                          <button
                                            key={reaction}
                                            onClick={() => handleReaction(comment.id, reaction)}
                                            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 hover:scale-105 ${
                                              users.includes(user?.id || '') 
                                                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm' 
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200'
                                            }`}
                                            title={`${users.length} ${users.length === 1 ? 'person' : 'people'} reacted with ${reaction}`}
                                          >
                                            <span className="text-lg">
                                              {reaction === 'like' ? '👍' : 
                                               reaction === 'heart' ? '❤️' : 
                                               reaction === 'laugh' ? '😄' : 
                                               reaction === 'sad' ? '😢' :
                                               reaction === 'angry' ? '😠' :
                                               reaction === 'wow' ? '😮' :
                                               reaction === 'clap' ? '👏' :
                                               reaction === 'fire' ? '🔥' :
                                               reaction === 'rocket' ? '🚀' :
                                               reaction === 'eyes' ? '👀' :
                                               reaction === 'thinking' ? '🤔' :
                                               reaction === 'party' ? '🎉' :
                                               reaction === 'check' ? '✅' :
                                               reaction === 'cross' ? '❌' :
                                               reaction === 'question' ? '❓' :
                                               reaction === 'exclamation' ? '❗' : '👀'}
                                            </span>
                                            <span className="font-semibold">{users.length}</span>
                                          </button>
                                        )
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* Enhanced Actions with Resolve Toggle */}
                                  <div className="flex items-center gap-2 mb-4">
                                    {/* Always show action buttons, style resolve differently */}
                                    <button
                                      onClick={() => handleToggleResolveComment(comment.id)}
                                      className={`comment-action-button ${
                                        comment.data?.status === 'resolved' 
                                          ? 'resolve-button-active' 
                                          : 'resolve-button-inactive'
                                      }`}
                                    >
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        {comment.data?.status === 'resolved' ? (
                                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                                        ) : (
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                        )}
                                      </svg>
                                      {comment.data?.status === 'resolved' ? 'Unresolve' : 'Resolve'}
                                    </button>
                                    
                                    <button 
                                      onClick={() => handleReply(comment.id)}
                                      className="comment-action-button reply-button"
                                    >
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd"/>
                                      </svg>
                                      Reply
                                    </button>
                                    
                                    {/* Enhanced Emoji Picker - Discord/GitLab Style */}
                                    <div className="relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleEmojiPicker(comment.id);
                                        }}
                                        className="comment-action-button react-button"
                                      >
                                        <span className="text-base">😊</span>
                                        <span>React</span>
                                      </button>
                                      
                                      {/* Emoji Picker Popup */}
                                      {showEmojiPicker[comment.id] && (
                                        <div className="emoji-picker-popup">
                                          {/* Frequently Used */}
                                          <div className="mb-3">
                                            <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Frequently used</h4>
                                            <div className="flex items-center gap-1">
                                              {[
                                                { key: 'like', emoji: '👍' },
                                                { key: 'heart', emoji: '❤️' },
                                                { key: 'laugh', emoji: '😄' }
                                              ].map(({ key, emoji }) => (
                                                <button
                                                  key={key}
                                                  onClick={() => {
                                                    handleReaction(comment.id, key);
                                                    setShowEmojiPicker(prev => ({ ...prev, [comment.id]: false }));
                                                  }}
                                                  className="emoji-grid-button"
                                                >
                                                  {emoji}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                          
                                          {/* All Reactions */}
                                          <div>
                                            <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">People</h4>
                                            <div className="grid grid-cols-8 gap-1">
                                              {[
                                                { key: 'like', emoji: '👍' },
                                                { key: 'heart', emoji: '❤️' },
                                                { key: 'laugh', emoji: '😄' },
                                                { key: 'wow', emoji: '😮' },
                                                { key: 'sad', emoji: '😢' },
                                                { key: 'angry', emoji: '😠' },
                                                { key: 'clap', emoji: '👏' },
                                                { key: 'fire', emoji: '🔥' },
                                                { key: 'rocket', emoji: '🚀' },
                                                { key: 'eyes', emoji: '👀' },
                                                { key: 'thinking', emoji: '🤔' },
                                                { key: 'party', emoji: '🎉' },
                                                { key: 'check', emoji: '✅' },
                                                { key: 'cross', emoji: '❌' },
                                                { key: 'question', emoji: '❓' },
                                                { key: 'exclamation', emoji: '❗' }
                                              ].map(({ key, emoji }) => (
                                                <button
                                                  key={key}
                                                  onClick={() => {
                                                    handleReaction(comment.id, key);
                                                    setShowEmojiPicker(prev => ({ ...prev, [comment.id]: false }));
                                                  }}
                                                  className="emoji-grid-button"
                                                  style={{width: '32px', height: '32px'}}
                                                  title={key}
                                                >
                                                  {emoji}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {comment.priority === 'critical' && (
                                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full ml-auto">
                                        🚨 Requires Immediate Attention
                                      </span>
                                    )}
                                  </div>

                                  {/* Reply Form */}
                                  {replyMode[comment.id] && (
                                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                      <form onSubmit={(e) => handleReplySubmit(e, comment.id)} className="space-y-3">
                                        <div className="flex items-start gap-3">
                                          <div className={`w-8 h-8 bg-gradient-to-br ${getAvatarColor(user?.name || '')} rounded-full flex items-center justify-center flex-shrink-0`}>
                                            <span className="text-white font-bold text-xs">{user?.name?.charAt(0) || 'U'}</span>
                                          </div>
                                          <textarea
                                            value={replyTexts[comment.id] || ''}
                                            onChange={(e) => setReplyTexts(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (replyTexts[comment.id]?.trim()) {
                                                  handleReplySubmit(e as any, comment.id);
                                                }
                                              }
                                            }}
                                            placeholder="Write a reply... (Press Enter to send, Shift+Enter for new line)"
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            rows={3}
                                          />
                                        </div>
                                        <div className="flex items-center justify-end gap-2 pl-11">
                                          <button
                                            type="button"
                                            onClick={() => handleReply(comment.id)}
                                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="submit"
                                            disabled={!replyTexts[comment.id]?.trim() || isSubmittingReply[comment.id]}
                                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm rounded-md font-medium"
                                          >
                                            {isSubmittingReply[comment.id] ? 'Sending...' : 'Reply'}
                                          </button>
                                        </div>
                                      </form>
                                    </div>
                                  )}

                                  {/* Replies Thread */}
                                  {comment.replies && comment.replies.length > 0 && (
                                    <div className="mt-4">
                                      <button
                                        onClick={() => toggleReplies(comment.id)}
                                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium mb-3"
                                      >
                                        <svg className={`w-4 h-4 transition-transform ${showReplies[comment.id] ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                                        </svg>
                                        {showReplies[comment.id] ? 'Hide' : 'Show'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                                      </button>
                                      
                                      {showReplies[comment.id] && (
                                        <div className="pl-6 border-l-2 border-gray-200 space-y-4">
                                          {comment.replies.map((reply) => (
                                            <div key={reply.id} className="flex items-start gap-3">
                                              <div className={`w-8 h-8 bg-gradient-to-br ${getAvatarColor(reply.author_name)} rounded-full flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                                <span className="text-white font-bold text-xs">
                                                  {reply.author_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                </span>
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900 text-sm">{reply.author_name}</span>
                                                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${getRoleColor(reply.author_role)}`}>
                                                      {getRoleIcon(reply.author_role)}
                                                    </span>
                                                    <span className="text-xs text-gray-500">{formatDate(reply.created_at)}</span>
                                                  </div>
                                                  
                                                  {/* Dropdown Menu for Replies */}
                                                  {canDeleteComment(reply) && (
                                                    <div className="relative">
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          toggleDropdown(reply.id);
                                                        }}
                                                        className="dropdown-button"
                                                        style={{padding: '4px'}}
                                                      >
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                                                        </svg>
                                                      </button>
                                                    
                                                      {showDropdown[reply.id] && (
                                                        <div className="absolute right-0 top-8 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                                          <button
                                                            onClick={() => {
                                                              confirmDeleteComment(reply.id);
                                                              setShowDropdown(prev => ({ ...prev, [reply.id]: false }));
                                                            }}
                                                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                          >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            Delete
                                                          </button>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{reply.comment}</p>
                                                
                                                {/* Enhanced Reply reactions */}
                                                <div className="flex items-center gap-1 mt-2">
                                                  {/* Show existing reactions */}
                                                  {reply.data?.reactions && Object.entries(reply.data.reactions).map(([reaction, users]) => (
                                                    users.length > 0 && (
                                                      <button
                                                        key={reaction}
                                                        onClick={() => handleReaction(reply.id, reaction)}
                                                        className={`group flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all duration-200 hover:scale-105 ${
                                                          users.includes(user?.id || '') 
                                                            ? 'bg-blue-50 border-blue-300 text-blue-700' 
                                                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200'
                                                        }`}
                                                        title={`${users.length} ${users.length === 1 ? 'person' : 'people'} reacted with ${reaction}`}
                                                      >
                                                        <span>
                                                          {reaction === 'like' ? '👍' : 
                                                           reaction === 'heart' ? '❤️' : 
                                                           reaction === 'laugh' ? '😄' : 
                                                           reaction === 'sad' ? '😢' :
                                                           reaction === 'angry' ? '😠' :
                                                           reaction === 'wow' ? '😮' :
                                                           reaction === 'clap' ? '👏' :
                                                           reaction === 'fire' ? '🔥' :
                                                           reaction === 'rocket' ? '🚀' :
                                                           reaction === 'eyes' ? '👀' :
                                                           reaction === 'thinking' ? '🤔' :
                                                           reaction === 'party' ? '🎉' :
                                                           reaction === 'check' ? '✅' :
                                                           reaction === 'cross' ? '❌' :
                                                           reaction === 'question' ? '❓' :
                                                           reaction === 'exclamation' ? '❗' : '👀'}
                                                        </span>
                                                        <span className="font-semibold">{users.length}</span>
                                                      </button>
                                                    )
                                                  ))}
                                                  
                                                  {/* Emoji Picker for Replies */}
                                                  <div className="relative">
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleEmojiPicker(reply.id);
                                                      }}
                                                      className="flex items-center justify-center w-6 h-6 text-sm hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110"
                                                      title="Add reaction"
                                                    >
                                                      <span>😊</span>
                                                    </button>
                                                    
                                                    {/* Reply Emoji Picker Popup */}
                                                    {showEmojiPicker[reply.id] && (
                                                      <div className="emoji-picker-popup" style={{minWidth: '240px', left: '-120px'}}>
                                                        {/* Frequently Used */}
                                                        <div className="mb-2">
                                                          <h4 className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Quick</h4>
                                                          <div className="flex items-center gap-1">
                                                            {[
                                                              { key: 'like', emoji: '👍' },
                                                              { key: 'heart', emoji: '❤️' },
                                                              { key: 'laugh', emoji: '😄' }
                                                            ].map(({ key, emoji }) => (
                                                              <button
                                                                key={key}
                                                                onClick={() => {
                                                                  handleReaction(reply.id, key);
                                                                  setShowEmojiPicker(prev => ({ ...prev, [reply.id]: false }));
                                                                }}
                                                                className="emoji-grid-button"
                                                              >
                                                                {emoji}
                                                              </button>
                                                            ))}
                                                          </div>
                                                        </div>
                                                        
                                                        {/* More Reactions */}
                                                        <div>
                                                          <h4 className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">More</h4>
                                                          <div className="grid grid-cols-6 gap-1">
                                                            {[
                                                              { key: 'wow', emoji: '😮' },
                                                              { key: 'sad', emoji: '😢' },
                                                              { key: 'angry', emoji: '😠' },
                                                              { key: 'clap', emoji: '👏' },
                                                              { key: 'fire', emoji: '🔥' },
                                                              { key: 'check', emoji: '✅' }
                                                            ].map(({ key, emoji }) => (
                                                              <button
                                                                key={key}
                                                                onClick={() => {
                                                                  handleReaction(reply.id, key);
                                                                  setShowEmojiPicker(prev => ({ ...prev, [reply.id]: false }));
                                                                }}
                                                                className="emoji-grid-button"
                                                                style={{width: '32px', height: '32px'}}
                                                                title={key}
                                                              >
                                                                {emoji}
                                                              </button>
                                                            ))}
                                                          </div>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>

                  {/* Summary Footer */}
                  <div className="bg-gray-50 px-6 py-4 rounded-b-lg">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-6">
                        <span className="text-gray-600">
                          <strong>{comments.length}</strong> total {comments.length === 1 ? 'comment' : 'comments'}
                        </span>
                        <span className="text-blue-600">
                          <strong>{getThreadedComments().length}</strong> {getThreadedComments().length === 1 ? 'thread' : 'threads'}
                        </span>
                        <span className="text-green-600">
                          <strong>{getThreadsStats().resolvedThreads}</strong> resolved
                        </span>
                        <span className="text-orange-600">
                          <strong>{getThreadsStats().openThreads}</strong> open
                        </span>
                        {getPriorityStats().criticalCount > 0 && (
                          <span className="text-red-600 font-medium">
                            🚨 <strong>{getPriorityStats().criticalCount}</strong> critical issues
                          </span>
                        )}
                        {getPriorityStats().highCount > 0 && (
                          <span className="text-amber-600 font-medium">
                            ⚠️ <strong>{getPriorityStats().highCount}</strong> high priority
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500">
                        Last updated {comments.length > 0 ? formatDate(comments[comments.length - 1].created_at) : 'never'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced Review Tab */}
              {activeView === 'review' && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">📊 Clinical Analytics Dashboard</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                      {/* Overall Stats */}
                      <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-200">
                        <div className="text-3xl font-bold text-blue-600 mb-2">{comments.length}</div>
                        <div className="text-sm text-blue-700 font-medium">Total Comments</div>
                      </div>
                      
                      <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200">
                        <div className="text-3xl font-bold text-green-600 mb-2">{getThreadsStats().resolvedThreads}</div>
                        <div className="text-sm text-green-700 font-medium">Resolved</div>
                      </div>
                      
                      <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-amber-100 rounded-xl border border-orange-200">
                        <div className="text-3xl font-bold text-orange-600 mb-2">{getThreadsStats().openThreads}</div>
                        <div className="text-sm text-orange-700 font-medium">Open Threads</div>
                      </div>
                      
                      <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-violet-100 rounded-xl border border-purple-200">
                        <div className="text-3xl font-bold text-purple-600 mb-2">{getPriorityStats().criticalCount}</div>
                        <div className="text-sm text-purple-700 font-medium">Critical Issues</div>
                      </div>
                    </div>

                    {/* Enhanced Priority Distribution */}
                    <div className="priority-grid">
                      <div className="priority-item">
                        <div className="text-2xl font-bold text-red-600 mb-1">{getPriorityStats().criticalCount}</div>
                        <div className="text-sm text-red-700 font-medium">🚨 Critical</div>
                        <div className="text-xs text-red-600 mt-1">Immediate Action</div>
                      </div>
                      
                      <div className="priority-item">
                                          <div className="text-2xl font-bold text-yellow-700 mb-1">{getPriorityStats().highCount}</div>
                  <div className="text-sm text-yellow-800 font-medium">⚠️ High</div>
                  <div className="text-xs text-yellow-700 mt-1">Urgent Review</div>
                      </div>
                      
                      <div className="priority-item">
                        <div className="text-2xl font-bold text-blue-600 mb-1">{getPriorityStats().mediumCount}</div>
                        <div className="text-sm text-blue-700 font-medium">📋 Medium</div>
                        <div className="text-xs text-blue-600 mt-1">Standard Priority</div>
                      </div>
                      
                      <div className="priority-item">
                        <div className="text-2xl font-bold text-gray-600 mb-1">{getPriorityStats().lowCount}</div>
                        <div className="text-sm text-gray-700 font-medium">💭 Low</div>
                        <div className="text-xs text-gray-600 mt-1">For Information</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced History Tab */}
              {activeView === 'history' && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">🏥 Medical Activity Timeline</h3>
                    
                    <div className="space-y-4">
                      {comments.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p>No activity recorded yet</p>
                        </div>
                      ) : (
                        comments
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((comment, index) => (
                            <div key={comment.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                              <div className={`w-10 h-10 bg-gradient-to-br ${getAvatarColor(comment.author_name)} rounded-full flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                <span className="text-white font-bold text-sm">
                                  {comment.author_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <span className="font-semibold text-gray-900">{comment.author_name}</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(comment.author_role)}`}>
                                      {getRoleIcon(comment.author_role)} {comment.author_role}
                                    </span>
                                    <span className="text-sm text-gray-500">{formatDate(comment.created_at)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {comment.priority && (
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(comment.priority)}`}>
                                        {getPriorityIcon(comment.priority)} {comment.priority.toUpperCase()}
                                      </span>
                                    )}
                                    {comment.data?.status === 'resolved' && (
                                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                        ✅ Resolved
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-gray-700 text-sm leading-relaxed">
                                  {comment.comment.length > 150 
                                    ? `${comment.comment.substring(0, 150)}...` 
                                    : comment.comment
                                  }
                                </p>
                                {comment.data?.reactions && Object.keys(comment.data.reactions).length > 0 && (
                                  <div className="flex items-center gap-2 mt-2">
                                    {Object.entries(comment.data.reactions).map(([reaction, users]) => (
                                      users.length > 0 && (
                                        <span key={reaction} className="flex items-center gap-1 text-xs text-gray-500">
                                          <span>
                                            {reaction === 'like' ? '👍' : 
                                             reaction === 'heart' ? '❤️' : 
                                             reaction === 'laugh' ? '😄' : '👀'}
                                          </span>
                                          <span>{users.length}</span>
                                        </span>
                                      )
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Professional Delete Confirmation Dialog */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform animate-slide-up">
            <div className="p-6">
              {/* Icon and Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Delete Comment</h3>
                  <p className="text-sm text-gray-600 mt-1">This action cannot be undone</p>
                </div>
              </div>
              
              {/* Content */}
              <div className="mb-6">
                <p className="text-gray-700 leading-relaxed">
                  Are you sure you want to delete this medical comment? This will permanently remove the comment 
                  and all associated data from the review system.
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm({show: false, commentId: null})}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteConfirm.commentId && handleDeleteComment(deleteConfirm.commentId)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                >
                  Delete Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 🎨 Toast Notification Container - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              transform transition-all duration-300 ease-in-out
              bg-white rounded-lg shadow-lg border-l-4 p-4 min-w-80
              ${toast.type === 'error' ? 'border-red-500' : ''}
              ${toast.type === 'success' ? 'border-green-500' : ''}
              ${toast.type === 'warning' ? 'border-yellow-500' : ''}
              ${toast.type === 'info' ? 'border-blue-500' : ''}
            `}
            style={{
              animation: 'slideInRight 0.3s ease-out',
            }}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {toast.type === 'error' && (
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {toast.type === 'success' && (
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {toast.type === 'warning' && (
                  <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {toast.type === 'info' && (
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              
              <div className="ml-3 flex-1">
                <h4 className={`text-sm font-semibold ${
                  toast.type === 'error' ? 'text-red-800' : ''
                }${toast.type === 'success' ? 'text-green-800' : ''
                }${toast.type === 'warning' ? 'text-yellow-800' : ''
                }${toast.type === 'info' ? 'text-blue-800' : ''
                }`}>
                  {toast.title}
                </h4>
                {toast.message && (
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                    {toast.message}
                  </p>
                )}
              </div>
              
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Toast Animation Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
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
        `
      }} />
    </div>
  );
};

export default SegmentComments; 