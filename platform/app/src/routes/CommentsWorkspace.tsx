import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Because this file lives under platform/app/src/routes we need to hop up three directories to reach ui-next util file
import { supabaseClient } from '../../../ui-next/src/lib/utils';

// Beautiful loading component
const Loading = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-gray-900 to-black">
    <div className="text-center">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
        <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-purple-500 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
      </div>
      <div className="mt-4 text-white font-medium">Loading your workspace...</div>
      <div className="text-gray-400 text-sm mt-1">Preparing professional review environment</div>
    </div>
  </div>
);

export default function CommentsWorkspace() {
  const { segmentName } = useParams<{ segmentName: string }>();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId');
  const seriesInstanceUID = searchParams.get('series');
  
  // Debug logging
  console.log('CommentsWorkspace loaded:', {
    segmentName,
    taskId,
    seriesInstanceUID,
    pathname: window.location.pathname,
    search: window.location.search
  });
  
  const [activeThread, setActiveThread] = useState<{
    segment_id: string;
    series_instance_uid: string;
    status?: string | null;
  } | null>(null);
  const [newComment, setNewComment] = useState('');
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  
  // Local state for instant UI updates
  const [localComments, setLocalComments] = useState<any[]>([]);
  const [pendingComments, setPendingComments] = useState<any[]>([]);
  
  // Refs for auto-scroll and smooth UX
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const realtimeChannelRef = useRef<any>(null);

  const queryClient = useQueryClient();

  // Sound effects utility
  const playSound = (type: 'sent' | 'received') => {
    try {
      // Create simple beep sounds using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies for different actions
      oscillator.frequency.value = type === 'sent' ? 800 : 600;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      // Fallback: silent if audio context fails
      console.log('Audio not available');
    }
  };

  // Get current user with beautiful profile and role
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        // Get profile with role from the view
        const { data: profile } = await supabaseClient
          .from('hd_profile_list')
          .select('first_name, last_name, role')
          .eq('id', user.id)
          .single();

        setCurrentUser({
          id: user.id,
          name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Anonymous',
          role: profile?.role || 'user',
          avatar: `https://ui-avatars.com/api/?name=${profile?.first_name}+${profile?.last_name}&background=3b82f6&color=fff&size=128`
        });
      }
    };
    getCurrentUser();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  /* Auto-select thread based on URL params */
  useEffect(() => {
    if (segmentName && seriesInstanceUID) {
      setActiveThread({
        segment_id: decodeURIComponent(segmentName),
        series_instance_uid: decodeURIComponent(seriesInstanceUID),
      });
    }
  }, [segmentName, seriesInstanceUID]);

  /* Auto-scroll to bottom when new messages arrive */
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    }
  };

  /* --------------------------------------------------------------------- */
  /* Fetch thread list with beautiful status indicators                   */
  /* --------------------------------------------------------------------- */
  const {
    data: threadRows,
    isLoading: isThreadLoading,
    error: threadError,
  } = useQuery({
    queryKey: ['threads', taskId],
    enabled: !!taskId,
    queryFn: async () => {
      if (!taskId) return [];
      const tid = parseInt(taskId as string, 10);
      if (Number.isNaN(tid)) return [];

      // Get threads with latest message info
      const { data, error } = await supabaseClient
        .from('hd_segment_status')
        .select('segment_id, series_instance_uid, status, updated_at')
        .eq('task_id', tid)
        .order('updated_at', { ascending: false });

      if (error || !data) {
        // Fallback to comments
        const { data: cmtData } = await supabaseClient
          .from('hd_comments')
          .select('segment_id, series_instance_uid, created_at')
          .eq('task_id', tid)
          .order('created_at', { ascending: false });

        const distinct = new Map<string, any>();
        (cmtData || []).forEach(row => {
          const key = `${row.segment_id}|${row.series_instance_uid}`;
          if (!distinct.has(key)) distinct.set(key, { ...row, status: null });
        });
        return Array.from(distinct.values());
      }

      return data;
    },
    staleTime: 10_000,
  });

  /* --------------------------------------------------------------------- */
  /* Fetch comments with user profiles for beautiful chat                 */
  /* --------------------------------------------------------------------- */
  const {
    data: serverComments = [],
    isLoading: isCommentsLoading,
    refetch: refetchComments,
  } = useQuery({
    queryKey: ['comments', taskId, activeThread?.segment_id, activeThread?.series_instance_uid],
    enabled: !!taskId && !!activeThread,
    queryFn: async () => {
      if (!taskId || !activeThread) return [];
      const tid = parseInt(taskId, 10);
      if (Number.isNaN(tid)) return [];

      const { data, error } = await supabaseClient
        .from('hd_comments')
        .select(`
          id, 
          content, 
          created_at, 
          user_id,
          hd_profiles!inner(first_name, last_name)
        `)
        .eq('task_id', tid)
        .eq('segment_id', activeThread.segment_id)
        .eq('series_instance_uid', activeThread.series_instance_uid)
        .order('created_at', { ascending: true }); // Ascending for chat order

      if (error) return [];
      
      // Transform data to include user names and avatars
      return (data || []).map(comment => {
        const profile = (comment as any).hd_profiles;
        let userName = 'Anonymous';
        
        if (Array.isArray(profile) && profile.length > 0) {
          userName = `${profile[0].first_name || ''} ${profile[0].last_name || ''}`.trim();
        } else if (profile && typeof profile === 'object') {
          userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        }
        
        return {
          ...comment,
          userName,
          avatar: `https://ui-avatars.com/api/?name=${userName.replace(' ', '+')}&background=random&size=128`
        };
      });
    },
    staleTime: 1_000, // Shorter stale time for more frequent updates
  });

  // Combine server comments with local/pending comments for instant UI
  const comments = React.useMemo(() => {
    const allComments = [...serverComments, ...localComments, ...pendingComments];
    // Sort by created_at and remove duplicates
    const uniqueComments = allComments.reduce((acc, comment) => {
      const existing = acc.find(c => c.id === comment.id);
      if (!existing) {
        acc.push(comment);
      }
      return acc;
    }, [] as any[]);
    
    return uniqueComments.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [serverComments, localComments, pendingComments]);

  // Auto-scroll when comments change
  useEffect(() => {
    if (comments.length > 0) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [comments]);

  // Clear local state when switching threads
  useEffect(() => {
    setPendingComments([]);
    setLocalComments([]);
  }, [activeThread]);

  /* --------------------------------------------------------------------- */
  /* Fetch status for active thread                                        */
  /* --------------------------------------------------------------------- */
  const {
    data: statusRow,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['status', taskId, activeThread?.segment_id, activeThread?.series_instance_uid],
    enabled: !!taskId && !!activeThread,
    queryFn: async () => {
      if (!taskId || !activeThread) return null;
      const tid = parseInt(taskId, 10);
      if (Number.isNaN(tid)) return null;
      const { data, error } = await supabaseClient
        .from('hd_segment_status')
        .select('status')
        .eq('task_id', tid)
        .eq('segment_id', activeThread.segment_id)
        .eq('series_instance_uid', activeThread.series_instance_uid)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    staleTime: 5_000,
  });

  useEffect(() => {
    setCurrentStatus(statusRow?.status || null);
  }, [statusRow]);

  /* --------------------------------------------------------------------- */
  /* Typing indicator with beautiful animation                             */
  /* --------------------------------------------------------------------- */
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  };

  /* --------------------------------------------------------------------- */
  /* Mutations with beautiful feedback and optimistic updates             */
  /* --------------------------------------------------------------------- */
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!taskId || !activeThread || !currentUser) return;
      const tid = parseInt(taskId, 10);
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const result = await supabaseClient
        .from('hd_comments')
        .insert({
          task_id: tid,
          segment_id: activeThread.segment_id,
          series_instance_uid: activeThread.series_instance_uid,
          content,
          user_id: user.id,
        })
        .select(`
          id, 
          content, 
          created_at, 
          user_id
        `)
        .single();
      
      return result.data;
    },
    onMutate: async (content: string) => {
      // Optimistic update - add message immediately to UI
      if (!currentUser || !activeThread) return;
      
      const optimisticComment = {
        id: `temp-${Date.now()}`, // Temporary ID
        content,
        created_at: new Date().toISOString(),
        user_id: currentUser.id,
        userName: currentUser.name,
        avatar: currentUser.avatar,
        isPending: true
      };
      
      setPendingComments(prev => [...prev, optimisticComment]);
      
      // Clear input immediately
      setNewComment('');
      setIsTyping(false);
      
      // Play sound immediately
      playSound('sent');
      
      // Focus back to input
      setTimeout(() => inputRef.current?.focus(), 50);
      
      return { optimisticComment };
    },
    onSuccess: (serverComment, content, context) => {
      // Remove the optimistic comment and let server data take over
      setPendingComments(prev => 
        prev.filter(comment => comment.id !== context?.optimisticComment?.id)
      );
      
      // Refetch to get the real server data
      refetchComments();
    },
    onError: (error, content, context) => {
      console.error('Failed to add comment:', error);
      
      // Remove the failed optimistic comment
      if (context?.optimisticComment) {
        setPendingComments(prev => 
          prev.filter(comment => comment.id !== context.optimisticComment.id)
        );
      }
      
      // Restore the content to input
      setNewComment(content);
      
      // Could show toast notification here
      alert('Failed to send message. Please try again.');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!taskId || !activeThread) return;
      const tid = parseInt(taskId, 10);
      return supabaseClient
        .from('hd_segment_status')
        .upsert({
          task_id: tid,
          segment_id: activeThread.segment_id,
          series_instance_uid: activeThread.series_instance_uid,
          status: newStatus,
        }, { onConflict: 'task_id,segment_id,series_instance_uid' });
    },
    onSuccess: () => {
      refetchStatus();
      refetchThreads();
    },
    onError: (error) => {
      console.error('Failed to update status:', error);
    }
  });

  /* --------------------------------------------------------------------- */
  /* REALTIME Supabase channel for instant messaging                      */
  /* --------------------------------------------------------------------- */
  useEffect(() => {
    if (!taskId || !activeThread) return;

    // Clean up existing channel
    if (realtimeChannelRef.current) {
      console.log('🧹 Cleaning up existing channel');
      supabaseClient.removeChannel(realtimeChannelRef.current);
    }

    // Create new channel specifically for this thread
    const channelName = `comments_${taskId}_${activeThread.segment_id}_${activeThread.series_instance_uid}`;
    console.log('🔗 Creating realtime channel:', channelName);
    
    const channel = supabaseClient.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: currentUser?.id }
      }
    });

    channel
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'hd_comments', 
        filter: `task_id=eq.${taskId}` 
      }, async (payload) => {
        console.log('💬 REALTIME: New comment received:', {
          payload,
          currentThread: activeThread,
          currentUser: currentUser?.id
        });
        
        // Check if this comment is for the current thread
        const newComment = payload.new;
        console.log('🔍 Checking comment thread match:', {
          newComment_segment: newComment.segment_id,
          activeThread_segment: activeThread.segment_id,
          newComment_series: newComment.series_instance_uid,
          activeThread_series: activeThread.series_instance_uid,
          isMatch: newComment.segment_id === activeThread.segment_id && 
                   newComment.series_instance_uid === activeThread.series_instance_uid
        });
        
        if (newComment.segment_id === activeThread.segment_id && 
            newComment.series_instance_uid === activeThread.series_instance_uid) {
          
          console.log('✅ Comment is for current thread');
          
          // If it's from another user, add it immediately to UI
          if (newComment.user_id !== currentUser?.id) {
            console.log('👤 Comment from another user, adding to UI');
            
            // Get user profile for the new comment
            const { data: profile } = await supabaseClient
              .from('hd_profiles')
              .select('first_name, last_name')
              .eq('id', newComment.user_id)
              .single();
            
            const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Anonymous';
            console.log('👤 User profile:', { profile, userName });
            
            const formattedComment = {
              ...newComment,
              userName,
              avatar: `https://ui-avatars.com/api/?name=${userName.replace(' ', '+')}&background=random&size=128`
            };
            
            console.log('📝 Formatted comment:', formattedComment);
            
            // Add to local state for immediate display
            setLocalComments(prev => {
              // Avoid duplicates
              const exists = prev.find(c => c.id === formattedComment.id);
              if (exists) {
                console.log('⚠️ Comment already exists in local state');
                return prev;
              }
              console.log('✨ Adding comment to local state');
              return [...prev, formattedComment];
            });
            
            // Play received sound
            playSound('received');
            
            // Show browser notification if page is not focused
            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('New medical review comment', {
                body: `Dr. ${userName}: ${newComment.content.substring(0, 50)}...`,
                icon: '/favicon.ico'
              });
            }
          } else {
            console.log('👤 Comment from current user, skipping local update');
          }
          
          // Refetch server data to sync after a short delay
          setTimeout(() => {
            console.log('🔄 Refetching comments from server');
            refetchComments();
          }, 1000);
        } else {
          console.log('❌ Comment not for current thread, ignoring');
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'hd_segment_status', 
        filter: `task_id=eq.${taskId}` 
      }, () => {
        console.log('📊 Status update received');
        refetchStatus();
        refetchThreads();
      })
      .subscribe((status) => {
        console.log('📡 Channel subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to realtime channel');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel subscription error');
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ Channel subscription timed out');
        }
      });

    realtimeChannelRef.current = channel;

    return () => {
      console.log('🧹 Cleaning up channel on unmount');
      if (realtimeChannelRef.current) {
        supabaseClient.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [taskId, activeThread, currentUser, refetchComments, refetchStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        console.log('🧹 Final cleanup on component unmount');
        supabaseClient.removeChannel(realtimeChannelRef.current);
      }
    };
  }, []);

  // Debug: Log when comments change
  useEffect(() => {
    console.log('📝 Comments updated:', {
      serverComments: serverComments.length,
      localComments: localComments.length,
      pendingComments: pendingComments.length,
      totalComments: comments.length
    });
  }, [comments, serverComments, localComments, pendingComments]);

  // helper
  const refetchThreads = () => {
    queryClient.invalidateQueries({ queryKey: ['threads', taskId] });
  };

  // Beautiful status button component
  const StatusButton = ({ value, label, icon, color }: { 
    value: string; 
    label: string; 
    icon: string;
    color: string;
  }) => (
    <button
      onClick={() => updateStatusMutation.mutate(value)}
      disabled={updateStatusMutation.isPending}
      className={`group relative px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 transform hover:scale-105 ${
        currentStatus === value 
          ? `${color} text-white shadow-lg` 
          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600/50'
      }`}
    >
      <span className="flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        {label}
      </span>
      {currentStatus === value && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
      )}
    </button>
  );

  // Beautiful message bubble component
  const MessageBubble = ({ comment, isOwn }: { comment: any; isOwn: boolean }) => (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 animate-fadeIn`}>
      <div className={`flex max-w-xs lg:max-w-md ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
        {/* Avatar */}
        {!isOwn && (
          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-blue-500/20">
            <img 
              src={comment.avatar} 
              alt={comment.userName}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        {/* Message content */}
        <div className={`relative px-4 py-3 rounded-2xl shadow-lg ${
          comment.isPending 
            ? 'bg-gray-300 text-gray-600' // Pending style
            : isOwn 
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-md' 
              : 'bg-white text-gray-800 rounded-bl-md border border-gray-200'
        }`}>
          {/* User name for others */}
          {!isOwn && (
            <div className="text-xs font-semibold text-blue-600 mb-1">
              Dr. {comment.userName}
            </div>
          )}
          
          {/* Message text */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</div>
          
          {/* Timestamp and status */}
          <div className={`text-xs mt-2 flex items-center gap-2 ${
            comment.isPending 
              ? 'text-gray-500' 
              : isOwn ? 'text-blue-100' : 'text-gray-500'
          }`}>
            <span>
              {new Date(comment.created_at).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            {comment.isPending && (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                Sending...
              </span>
            )}
          </div>
          
          {/* Message tail */}
          {!comment.isPending && (
            <div className={`absolute bottom-0 ${
              isOwn 
                ? '-right-2 border-l-8 border-l-blue-500 border-t-8 border-t-transparent' 
                : '-left-2 border-r-8 border-r-white border-t-8 border-t-transparent'
            }`}></div>
          )}
        </div>
      </div>
    </div>
  );

  // Beautiful typing indicator
  const TypingIndicator = () => (
    <div className="flex justify-start mb-4 animate-fadeIn">
      <div className="flex items-end gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-300 flex-shrink-0 animate-pulse"></div>
        <div className="bg-gray-200 text-gray-600 px-4 py-3 rounded-2xl rounded-bl-md shadow-lg">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-2">Dr. Anonymous is typing</span>
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Handle keyboard shortcuts
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newComment.trim() && !addCommentMutation.isPending) {
        addCommentMutation.mutate(newComment.trim());
      }
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewComment(e.target.value);
    handleTyping();
    
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  if (isThreadLoading) return <Loading />;
  if (threadError) return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-red-900/20 to-black">
      <div className="text-center text-white">
        <div className="text-4xl mb-4">⚠️</div>
        <div className="text-xl font-semibold mb-2">Unable to load workspace</div>
        <div className="text-gray-400">Please refresh the page or contact support</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-gray-900 via-gray-800 to-black overflow-hidden">
      {/* Beautiful Sidebar - Thread List */}
      <aside className="w-80 bg-gray-900/80 backdrop-blur-xl border-r border-gray-700/50 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-700/50 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">💬</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Medical Review</h1>
              <p className="text-xs text-gray-400">Professional Workspace</p>
            </div>
          </div>
          
          {/* Current user info */}
          {currentUser && (
            <div className="mt-4 flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl">
              <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-green-400/50">
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-medium">Dr. {currentUser.name}</div>
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  Online
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Segments ({threadRows?.length || 0})
            </div>
            
            {threadRows && threadRows.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <div className="text-3xl mb-3">📋</div>
                <div className="text-sm">No segments available</div>
                <div className="text-xs mt-1">Check back later for new cases</div>
              </div>
            )}
            
            {threadRows && threadRows.map((t: any) => {
              const isActive = activeThread && 
                activeThread.segment_id === t.segment_id && 
                activeThread.series_instance_uid === t.series_instance_uid;
              
              return (
                <div
                  key={`${t.segment_id}-${t.series_instance_uid}`}
                  className={`group cursor-pointer p-4 rounded-xl mb-2 transition-all duration-200 transform hover:scale-[1.02] ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 shadow-lg' 
                      : 'bg-gray-800/30 hover:bg-gray-700/50 border border-transparent'
                  }`}
                  onClick={() => setActiveThread(t)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        t.status === 'verify' ? 'bg-green-400 animate-pulse' :
                        t.status === 'review' ? 'bg-blue-400 animate-pulse' :
                        t.status === 'reject' ? 'bg-red-400 animate-pulse' :
                        'bg-gray-500'
                      }`}></div>
                      <span className="font-medium text-white text-sm group-hover:text-blue-300 transition-colors">
                        {t.segment_id}
                      </span>
                    </div>
                    
                    {t.status && (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        t.status === 'verify' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                        t.status === 'review' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                        t.status === 'reject' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                        'bg-gray-600/20 text-gray-300 border border-gray-600/30'
                      }`}>
                        {t.status}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-400 truncate">
                    Series: {t.series_instance_uid.substring(0, 25)}...
                  </div>
                  
                  {t.updated_at && (
                    <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <span>🕒</span>
                      {new Date(t.updated_at).toLocaleDateString('vi-VN')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-gray-50">
        {!activeThread && (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shadow-2xl">
                <span className="text-white text-4xl">💬</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Medical Review</h2>
              <p className="text-gray-600 mb-4">Select a segment from the sidebar to start professional discussion</p>
              <div className="text-sm text-gray-500">
                💡 Collaborate with colleagues in real-time
              </div>
            </div>
          </div>
        )}

        {activeThread && (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-lg">🔬</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-800 text-xl">{activeThread.segment_id}</h2>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <span>Series: {activeThread.series_instance_uid.substring(0, 20)}...</span>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-green-600 font-medium">Live Chat</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Status indicator */}
                {currentStatus && (
                  <div className={`px-4 py-2 rounded-full text-sm font-semibold shadow-lg ${
                    currentStatus === 'verify' ? 'bg-green-100 text-green-700 border border-green-200' :
                    currentStatus === 'review' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                    currentStatus === 'reject' ? 'bg-red-100 text-red-700 border border-red-200' :
                    'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}>
                    {currentStatus.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Bar */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200 p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700">Review Actions:</span>
                <div className="flex gap-2">
                  <StatusButton 
                    value="review" 
                    label="Review" 
                    icon="👁️" 
                    color="bg-gradient-to-r from-blue-500 to-blue-600" 
                  />
                  <StatusButton 
                    value="verify" 
                    label="Verify" 
                    icon="✅" 
                    color="bg-gradient-to-r from-green-500 to-green-600" 
                  />
                  <StatusButton 
                    value="reject" 
                    label="Reject" 
                    icon="❌" 
                    color="bg-gradient-to-r from-red-500 to-red-600" 
                  />
                </div>
              </div>
            </div>
            
            {/* Messages Area - INSTANT MESSENGER STYLE */}
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-blue-50/30 to-purple-50/30"
            >
              {isCommentsLoading && (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              )}
              
              {comments.length === 0 && !isCommentsLoading && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center">
                    <span className="text-2xl">💭</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Start the conversation</h3>
                  <p className="text-gray-500">Be the first to add a professional review comment</p>
                </div>
              )}
              
              {/* Messages */}
              {comments.map((comment: any) => (
                <MessageBubble 
                  key={comment.id} 
                  comment={comment}
                  isOwn={comment.user_id === currentUser?.id}
                />
              ))}
              
              {/* Typing indicator */}
              {typingUsers.length > 0 && <TypingIndicator />}
              
              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Message Input - INSTANT MESSENGER STYLE */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-end gap-3 max-w-4xl">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={newComment}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    rows={1}
                    placeholder="Type your message..."
                    className="w-full text-sm bg-gray-50 p-4 pr-12 rounded-2xl border border-gray-200 resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-gray-800 placeholder-gray-400 transition-all duration-200"
                    style={{ minHeight: '52px', maxHeight: '120px' }}
                    disabled={addCommentMutation.isPending}
                  />
                  
                  {/* Emoji button */}
                  <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    <span className="text-lg">😊</span>
                  </button>
                </div>
                
                <button
                  onClick={() => {
                    if (newComment.trim() && !addCommentMutation.isPending) {
                      addCommentMutation.mutate(newComment.trim());
                    }
                  }}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center"
                >
                  {addCommentMutation.isPending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  )}
                </button>
              </div>
              
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span>💡 Press Enter to send, Shift+Enter for new line</span>
                  {isTyping && (
                    <div className="flex items-center gap-1 text-blue-500">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span>You are typing...</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-green-500">●</span>
                  <span>Instant messaging enabled</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
} 