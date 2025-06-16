// @ts-nocheck
import React, { useState } from 'react';
import { PanelSection, ScrollArea, Checkbox, Label, Button, Icons } from '../../components';
import { useSegmentationTableContext } from './SegmentationTableContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabaseClient } from '../../lib/utils';
import { Eye, Check, X as XIcon, MessageCircle, ChevronUp, ChevronDown, Minimize2, Maximize2 } from 'lucide-react';

const taskId = new URLSearchParams(window.location.search).get('taskId');

export const SegmentationComments: React.FC<{
  segmentation?: any;
  representation?: any;
  activeSegmentId: number;
  servicesManager?: any;
}> = ({ segmentation, representation, activeSegmentId, servicesManager }) => {
  const { activeSegmentationId, data } = useSegmentationTableContext('SegmentationTable.Segments');
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isNoSegDismissed, setIsNoSegDismissed] = useState(() => {
    // Check if user has dismissed the "No SEG Series" notification
    return localStorage.getItem('ohif-no-seg-dismissed') === 'true';
  });

  const dismissNoSegNotification = () => {
    setIsNoSegDismissed(true);
    localStorage.setItem('ohif-no-seg-dismissed', 'true');
  };

  // Get SeriesInstanceUID from segmentation
  const getSeriesInstanceUID = () => {
    try {
      if (servicesManager && activeSegmentationId) {
        const { displaySetService } = servicesManager.services;
        const displaySet = displaySetService.getDisplaySetByUID(activeSegmentationId);
        return displaySet?.SeriesInstanceUID || null;
      }
    } catch (error) {
      console.error('Error getting SeriesInstanceUID:', error);
    }
    return null;
  };

  const seriesInstanceUID = getSeriesInstanceUID();

  // Get segment name từ segmentation service
  let segmentName = `Segment ${activeSegmentId}`;
  let segmentColor = '#666';
  let segmentId = `${activeSegmentId}`;

  try {
    if (servicesManager && activeSegmentationId) {
      const { segmentationService } = servicesManager.services;
      const segmentation = segmentationService.getSegmentation(activeSegmentationId);
      
      if (segmentation && segmentation.segments && segmentation.segments[activeSegmentId]) {
        const segment = segmentation.segments[activeSegmentId];
        segmentName = segment.label || segmentName;
        
        if (segment.color && Array.isArray(segment.color) && segment.color.length >= 3) {
          segmentColor = `rgb(${segment.color[0]}, ${segment.color[1]}, ${segment.color[2]})`;
        }
        
        segmentId = segment.label || `${activeSegmentId}`;
      }
    }
  } catch (error) {
    console.error('Error getting segment info:', error);
  }

  // Query để lấy comments
  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['comments', taskId, segmentId, seriesInstanceUID],
    queryFn: async () => {
      if (!taskId || !segmentId || !seriesInstanceUID) return [];
      
      const { data, error } = await supabaseClient
        .from('hd_comments')
        .select(`
          *,
          hd_users!inner(name)
        `)
        .eq('task_id', parseInt(taskId))
        .eq('segment_id', segmentId)
        .eq('series_instance_uid', seriesInstanceUID)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching comments:', error);
        return [];
      }

      return data.map(comment => ({
        ...comment,
        name: comment.hd_users?.name || 'Unknown User'
      }));
    },
    enabled: !!taskId && !!segmentId && !!seriesInstanceUID,
    refetchInterval: 5000,
  });

  // Query để lấy status
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['segment-status', taskId, segmentId, seriesInstanceUID],
    queryFn: async () => {
      if (!taskId || !segmentId || !seriesInstanceUID) return null;
      
      const { data, error } = await supabaseClient
        .from('hd_segment_status')
        .select('status')
        .eq('task_id', parseInt(taskId))
        .eq('segment_id', segmentId)
        .eq('series_instance_uid', seriesInstanceUID)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching status:', error);
        return null;
      }

      return data;
    },
    enabled: !!taskId && !!segmentId && !!seriesInstanceUID,
  });

  const currentStatus = statusData?.status || null;

  // Mutation để thêm comment
  const addCommentMutation = useMutation({
    mutationFn: async (newComment: string) => {
      // Get the current authenticated user
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      
      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabaseClient
        .from('hd_comments')
        .insert({
          task_id: parseInt(taskId),
          segment_id: segmentId,
          series_instance_uid: seriesInstanceUID,
          content: newComment,
          user_id: user.id, // Use actual authenticated user ID
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setComment('');
      refetchComments();
    },
    onError: (error) => {
      console.error('Error adding comment:', error);
    }
  });

  // Mutation để update status
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      setIsLoading(true);
      
      const { data, error } = await supabaseClient
        .from('hd_segment_status')
        .upsert({
          task_id: parseInt(taskId),
          segment_id: segmentId,
          series_instance_uid: seriesInstanceUID,
          status: newStatus,
        }, {
          onConflict: 'task_id,segment_id,series_instance_uid',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetchStatus();
      setIsLoading(false);
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      setIsLoading(false);
    }
  });

  const handleCommentSubmit = () => {
    if (comment.trim()) {
      addCommentMutation.mutate(comment.trim());
    }
  };

  const handleStatusChange = (status: string) => {
    updateStatusMutation.mutate(status);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommentSubmit();
    }
  };

  const getStatusColor = (status: string) => {
    if (currentStatus === status) {
      switch (status) {
        case 'review': return 'bg-blue-500 hover:bg-blue-600 text-white';
        case 'verify': return 'bg-green-500 hover:bg-green-600 text-white';
        case 'reject': return 'bg-red-500 hover:bg-red-600 text-white';
        default: return 'bg-gray-500 hover:bg-gray-600 text-white';
      }
    }
    return 'bg-gray-600 hover:bg-gray-500 text-gray-300 border border-gray-500';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'review': return <Eye className="w-4 h-4" />;
      case 'verify': return <Check className="w-4 h-4" />;
      case 'reject': return <XIcon className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  // Early return if no seriesInstanceUID - don't show comment/review functionality
  if (!seriesInstanceUID && !isNoSegDismissed) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-yellow-900/90 backdrop-blur-sm border border-yellow-600 rounded-lg p-3 max-w-sm shadow-lg">
          <div className="flex items-center gap-2">
            <div className="text-yellow-400 text-lg">⚠️</div>
            <div className="flex-1">
              <div className="text-yellow-200 font-semibold text-xs">No SEG Series</div>
              <div className="text-yellow-300 text-xs">
                Comments require a segmentation series
              </div>
            </div>
            <button
              onClick={dismissNoSegNotification}
              className="text-yellow-400 hover:text-yellow-200 transition-colors ml-2 p-1 rounded hover:bg-yellow-800/50"
              title="Dismiss notification"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Don't render anything if dismissed and no series
  if (!seriesInstanceUID && isNoSegDismissed) {
    return null;
  }

  // Minimized state - just a floating button
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition-all duration-200 transform hover:scale-105"
          title="Open Comments & Review"
        >
          <MessageCircle className="w-5 h-5" />
          {comments.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {comments.length}
            </span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-80">
      <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-600 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-200" />
              <span className="text-white font-semibold text-sm">Comments & Review</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-blue-700 rounded text-blue-200 hover:text-white transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>
              <Button
                onClick={() => setIsMinimized(true)}
                className="p-1 hover:bg-blue-700 rounded text-blue-200 hover:text-white transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Active Segment Info */}
          <div className="mt-2 flex items-center justify-between">
            <span 
              className="px-2 py-1 rounded-full text-xs font-semibold shadow-sm max-w-[60%] truncate"
              style={{
                backgroundColor: segmentColor,
                color: segmentColor && 
                  (parseInt(segmentColor.replace('#', '').replace('rgb(', '').replace(')', ''), 16) > 0xffffff/2) ? '#000' : '#fff'
              }}
              title={segmentId}
            >
              {segmentId}
            </span>
            {seriesInstanceUID && (
              <div className="text-right cursor-help hover:text-blue-300" title={`Full Series ID: ${seriesInstanceUID}`}>
                <div className="text-xs text-blue-200">Series</div>
                <div className="text-xs text-white font-mono">
                  {seriesInstanceUID.substring(0, 6)}...
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expandable Content */}
        {isExpanded && (
          <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
            {/* Status Buttons - Compact */}
            <div className="space-y-2">
              <Label className="text-white text-sm font-semibold">Review Status</Label>
              <div className="grid grid-cols-3 gap-1">
                {['review', 'verify', 'reject'].map((status) => (
                  <Button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={isLoading || updateStatusMutation.isPending}
                    className={`
                      ${getStatusColor(status)}
                      py-1.5 px-1 rounded text-xs font-medium
                      transition-all duration-200 ease-in-out
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transform hover:scale-105 flex items-center justify-center gap-1
                    `}
                  >
                    {getStatusIcon(status)}
                    <span className="hidden sm:inline">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    <span className="sm:hidden">{status.charAt(0).toUpperCase()}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Comment Input */}
            <div className="space-y-2">
              <Label className="text-white text-sm font-semibold">Add Comment</Label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add your comment..."
                className="w-full p-2 text-sm bg-gray-800 border border-gray-600 rounded resize-none text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                rows={2}
                disabled={addCommentMutation.isPending}
              />
              <Button
                onClick={handleCommentSubmit}
                disabled={!comment.trim() || addCommentMutation.isPending}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-1.5 px-3 rounded text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
              >
                {addCommentMutation.isPending ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Adding...
                  </div>
                ) : (
                  'Add Comment'
                )}
              </Button>
            </div>

            {/* Comments List */}
            <div className="space-y-2">
              <Label className="text-white text-sm font-semibold">
                Comments ({comments.length})
              </Label>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {comments.length === 0 ? (
                  <div className="text-gray-400 text-xs text-center py-3 border border-dashed border-gray-600 rounded">
                    <div className="mb-1">💬</div>
                    <div>No comments yet</div>
                  </div>
                ) : (
                  comments.map((comment: any, index: number) => (
                    <div key={index} className="bg-gray-800 border border-gray-600 p-2 rounded hover:bg-gray-750 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-blue-400 text-xs font-semibold truncate max-w-[60%]">
                          {comment.name || 'Anonymous'}
                        </span>
                        <span className="text-gray-400 text-xs whitespace-nowrap">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-white text-xs leading-relaxed whitespace-pre-wrap break-words">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Collapsed state - show summary */}
        {!isExpanded && (
          <div className="p-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-300">Status:</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  currentStatus === 'review' ? 'bg-blue-500 text-white' :
                  currentStatus === 'verify' ? 'bg-green-500 text-white' :
                  currentStatus === 'reject' ? 'bg-red-500 text-white' :
                  'bg-gray-600 text-gray-300'
                }`}>
                  {currentStatus || 'None'}
                </span>
              </div>
              <div className="text-gray-300">
                {comments.length} comment{comments.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
