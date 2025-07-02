// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Label, Button } from '../../components';
import { useSegmentationTableContext } from './SegmentationTableContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabaseClient } from '../../lib/utils';
import { 
  MessageCircle, 
  ChevronUp, 
  ChevronDown, 
  Minimize2, 
  Maximize2,
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  User,
  Clock,
  Image as ImageIcon,
  Sparkles
} from 'lucide-react';

// Get taskId from URL parameters with fallback
const getTaskIdFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('taskId') || null;
};

// Get SeriesInstanceUID from URL parameters
const getSeriesInstanceUIDFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  // Try multiple possible parameter names
  return urlParams.get('StudyInstanceUIDs') || 
         urlParams.get('SeriesInstanceUID') || 
         urlParams.get('studyInstanceUID') || 
         null;
};

export const FloatingSegmentationComments: React.FC<{
  segmentation?: any;
  representation?: any;
  activeSegmentId: number;
  servicesManager?: any;
}> = ({ segmentation, representation, activeSegmentId, servicesManager }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [comment, setComment] = useState('');
  
  // Get task assignment ID and series instance UID from URL
  const taskAssignmentId = getTaskIdFromUrl(); // This is actually task_assignment_id
  const seriesInstanceUID = getSeriesInstanceUIDFromUrl();
  
  console.log('💬 FloatingSegmentationComments:', { 
    taskAssignmentId, 
    seriesInstanceUID,
    activeSegmentId 
  });

  // 🆕 NEW LOGIC: Query comments by series_instance_uid only (not per segment)
  const { data: comments = [], refetch: refetchComments, isLoading } = useQuery({
    queryKey: ['series-comments', taskAssignmentId, seriesInstanceUID],
    queryFn: async () => {
      if (!taskAssignmentId || !seriesInstanceUID) {
        console.log('❌ Missing taskAssignmentId or seriesInstanceUID');
        return [];
      }
      
      try {
        console.log('🔍 Fetching comments for series:', { taskAssignmentId, seriesInstanceUID });
        
        const { data, error } = await supabaseClient
          .from('_annotation_comments')
          .select(`
            *,
            _users!author_id(full_name, avatar_url)
          `)
          .eq('task_assignment_id', taskAssignmentId)
          .eq('series_instance_uid', seriesInstanceUID)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('❌ Error fetching comments:', error);
          return [];
        }

        console.log('✅ Comments fetched:', data);
        
        // Format comments with user info
        return (data || []).map(comment => ({
          ...comment,
          author_name: comment._users?.full_name || 'Anonymous',
          avatar_url: comment._users?.avatar_url || null
        }));
        
      } catch (error) {
        console.error('❌ Error in comments query:', error);
        return [];
      }
    },
    enabled: !!taskAssignmentId && !!seriesInstanceUID,
    refetchInterval: isExpanded ? 15000 : false, // Auto-refresh when expanded
    retry: 1,
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });

  // Add new comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (newComment: string) => {
      if (!taskAssignmentId || !seriesInstanceUID) {
        throw new Error('Missing task assignment ID or series instance UID');
      }

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      console.log('💬 Adding comment:', { taskAssignmentId, seriesInstanceUID, comment: newComment });

      const { data, error } = await supabaseClient
        .from('_annotation_comments')
        .insert({
          task_assignment_id: taskAssignmentId,
          author_id: user.id,
          comment: newComment,
          series_instance_uid: seriesInstanceUID,
          data: {} // Empty jsonb object
        })
        .select(`
          *,
          _users!author_id(full_name, avatar_url)
        `)
        .single();

      if (error) {
        console.error('❌ Error adding comment:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      setComment('');
      refetchComments();
      console.log('✅ Comment added successfully');
    },
    onError: (error) => {
      console.error('❌ Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    }
  });

  const handleSubmitComment = () => {
    if (!comment.trim()) return;
    addCommentMutation.mutate(comment.trim());
  };

  // Don't render if no task or series info
  if (!taskAssignmentId || !seriesInstanceUID) {
    return (
      <div className="fixed top-20 right-6 z-50 max-w-sm">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-800 mb-1">
                Missing Information
              </h4>
              <p className="text-sm text-amber-700 mb-2">
                Series comments require task and study information in URL.
              </p>
              <div className="text-xs text-amber-600 bg-amber-100 rounded px-2 py-1 font-mono">
                ?taskId=...&StudyInstanceUIDs=...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 backdrop-blur-sm border border-blue-500/30"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="font-medium">Series Comments</span>
          {comments.length > 0 && (
            <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full font-semibold">
              {comments.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-6 right-6 z-50 w-96">
      <div className="bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl border border-gray-200/50 overflow-hidden">
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Series Comments</h3>
                <div className="flex items-center gap-2 text-blue-100 text-sm">
                  <ImageIcon className="w-3 h-3" />
                  <span className="truncate max-w-48">
                    {seriesInstanceUID?.substring(0, 25)}...
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {comments.length > 0 && (
                <div className="bg-white/20 text-white text-sm px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {comments.length}
                </div>
              )}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className="p-2 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col h-full">
          {/* Comments List */}
          {isExpanded && (
            <div className="flex-1 max-h-80 overflow-y-auto p-4 space-y-4">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
              
              {!isLoading && comments.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-8 h-8 text-blue-500" />
                  </div>
                  <h4 className="text-gray-900 font-semibold mb-2">No comments yet</h4>
                  <p className="text-gray-500 text-sm">Start a conversation about this series</p>
                </div>
              )}

              {!isLoading && comments.map((comment) => (
                <div key={comment.id} className="group">
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                      {comment.avatar_url ? (
                        <img 
                          src={comment.avatar_url} 
                          alt={comment.author_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white text-sm font-semibold">
                          {comment.author_name?.charAt(0) || 'A'}
                        </span>
                      )}
                    </div>

                    {/* Comment Content */}
                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-50 rounded-xl p-3 group-hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {comment.author_name}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {new Date(comment.created_at).toLocaleDateString()} {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {comment.comment}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Comment Form */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="space-y-3">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts about this series..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/80 backdrop-blur-sm"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitComment();
                  }
                }}
              />
              
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Press Enter to send, Shift+Enter for new line
                </div>
                <button
                  onClick={handleSubmitComment}
                  disabled={!comment.trim() || addCommentMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 font-medium shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  {addCommentMutation.isPending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 