// @ts-nocheck
import React, { useState } from 'react';
import { PanelSection, ScrollArea, Checkbox, Label, Button, Icons } from '../../components';
import { useSegmentationTableContext } from './SegmentationTableContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabaseClient } from '../../lib/utils';
import { Eye, Check, X as XIcon } from 'lucide-react';

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
  
  try {
    // Lấy từ segmentation service
    if (servicesManager && activeSegmentationId) {
      const { segmentationService } = servicesManager.services;
      const segmentationData = segmentationService.getSegmentation(activeSegmentationId);
      
      // Lấy tên từ segmentation data
      if (segmentationData?.segments?.[activeSegmentId]) {
        const segment = segmentationData.segments[activeSegmentId];
        segmentName = segment.label || segment.text || segment.name || segmentName;
      }
    }
    
    // Fallback: thử lấy từ representation/segmentation props
    if (segmentName === `Segment ${activeSegmentId}`) {
      if (representation?.segmentation?.segments?.[activeSegmentId]) {
        const segment = representation.segmentation.segments[activeSegmentId];
        segmentName = segment.label || segment.name || segment.text || segmentName;
      }
      
      if (segmentation?.segments?.[activeSegmentId]) {
        const segment = segmentation.segments[activeSegmentId];
        segmentName = segment.label || segment.name || segment.text || segmentName;
      }
    }
    
    // Lấy màu từ representation
    if (representation?.segments?.[activeSegmentId]?.color) {
      const color = representation.segments[activeSegmentId].color;
      segmentColor = Array.isArray(color) ? `rgb(${color[0]},${color[1]},${color[2]})` : color;
    }
    
  } catch (error) {
    console.error('Error getting segment info:', error);
  }
  
  const segmentId = segmentName;

  // Query segment status - move hooks above early return
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['segmentStatus', taskId, segmentId, seriesInstanceUID],
    queryFn: async () => {
      let query = supabaseClient
        .from('hd_segment_status')
        .select('status')
        .eq('task_id', taskId)
        .eq('segment_id', segmentId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (seriesInstanceUID) {
        query = query.eq('series_instance_uid', seriesInstanceUID);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching status:', error);
        return null;
      }

      return data?.[0] || null;
    },
    enabled: !!taskId && !!segmentId && !!seriesInstanceUID,
  });

  // Query comments - move hooks above early return
  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['segmentComments', taskId, segmentId, seriesInstanceUID],
    queryFn: async () => {
      let query = supabaseClient
        .from('hd_task_comments')
        .select('*')
        .eq('task_id', taskId)
        .eq('segment_id', segmentId)
        .order('created_at', { ascending: false });

      if (seriesInstanceUID) {
        query = query.eq('series_instance_uid', seriesInstanceUID);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching comments:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!taskId && !!segmentId && !!seriesInstanceUID,
  });

  const currentStatus = statusData?.status || 'review';

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
      case 'review': return <Eye className="w-5 h-5" />;
      case 'verify': return <Check className="w-5 h-5" />;
      case 'reject': return <XIcon className="w-5 h-5" />;
      default: return <Eye className="w-5 h-5" />;
    }
  };

  // Early return if no seriesInstanceUID - don't show comment/review functionality
  if (!seriesInstanceUID) {
    return (
      <PanelSection className="bg-primary-dark">
        <div className="space-y-4 p-4">
          {/* Segment Info */}
          <div className="w-full">
            <div className="w-full bg-gradient-to-r from-gray-600 to-gray-800 rounded-lg p-3 mb-4">
              <div className="flex flex-col gap-3">
                <div className="text-sm text-gray-300 mb-1">Active Segment</div>
                <div className="flex items-center justify-center">
                  <span 
                    className="px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg"
                    style={{
                      backgroundColor: segmentColor,
                      color: segmentColor && 
                        (parseInt(segmentColor.replace('#', '').replace('rgb(', '').replace(')', ''), 16) > 0xffffff/2) ? '#000' : '#fff'
                    }}
                    title={segmentId}
                  >
                    {segmentId}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* No SeriesInstanceUID Message */}
          <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="text-yellow-400 text-2xl">⚠️</div>
              <div>
                <div className="text-yellow-200 font-semibold text-sm">No Series Instance UID</div>
                <div className="text-yellow-300 text-xs mt-1">
                  Comments and review status are only available for SEG series. 
                  Please load a segmentation series to enable this functionality.
                </div>
              </div>
            </div>
          </div>
        </div>
      </PanelSection>
    );
  }

  return (
    <PanelSection className="bg-primary-dark">
      <div className="space-y-4 p-4">
        {/* Segment Info - Improved layout for long names */}
        <div className="w-full">
          <div className="w-full bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-3 mb-4">
            <div className="flex flex-col gap-3">
              <div className="text-sm text-blue-200 mb-1">Active Segment</div>
              <div className="flex items-center justify-between">
                <span 
                  className="px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg max-w-[60%] truncate"
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
                  <div className="text-right cursor-help hover:text-gray-400" title={`Full Series ID: ${seriesInstanceUID}`}>
                    <div className="text-xs text-blue-200">Series ID</div>
                    <div className="text-xs text-white font-mono">
                      {seriesInstanceUID.substring(0, 8)}...
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status Buttons - Compact layout */}
        <div className="space-y-3">
          <Label className="text-white text-base font-semibold">Review Status</Label>
          <div className="grid grid-cols-3 gap-2">
            {['review', 'verify', 'reject'].map((status) => (
              <Button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={isLoading || updateStatusMutation.isPending}
                className={`
                  ${getStatusColor(status)}
                  py-2 px-2 rounded-lg flex items-center justify-center gap-1 font-medium text-sm
                  transition-all duration-200 ease-in-out
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transform hover:scale-105
                `}
              >
                {getStatusIcon(status)}
                <span className="hidden sm:inline">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                <span className="sm:hidden">{status.charAt(0).toUpperCase()}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Comments Section - Optimized spacing */}
        <div className="space-y-3">
          <Label className="text-white text-base font-semibold">Comments</Label>
          
          {/* Comment Input */}
          <div className="space-y-3">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Add your comment here..."
              className="w-full p-3 text-sm bg-gray-800 border border-gray-600 rounded-lg resize-none text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              rows={3}
              disabled={addCommentMutation.isPending}
            />
            <Button
              onClick={handleCommentSubmit}
              disabled={!comment.trim() || addCommentMutation.isPending}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
            >
              {addCommentMutation.isPending ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Adding...
                </div>
              ) : (
                'Add Comment'
              )}
            </Button>
          </div>

          {/* Comments List */}
          <div className="h-40 w-full overflow-y-auto bg-gray-900 border border-gray-600 rounded-lg">
            <div className="space-y-3 p-3">
              {comments.length === 0 ? (
                <div className="text-gray-400 text-sm text-center py-6 border-2 border-dashed border-gray-600 rounded-lg">
                  <div className="mb-2">💬</div>
                  <div>No comments yet</div>
                  <div className="text-xs">Be the first to leave a comment!</div>
                </div>
              ) : (
                comments.map((comment: any, index: number) => (
                  <div key={index} className="bg-gray-800 border border-gray-600 p-3 rounded-lg hover:bg-gray-750 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-blue-400 text-sm font-semibold truncate max-w-[60%]">
                        {comment.name || 'Anonymous'}
                      </span>
                      <span className="text-gray-400 text-xs whitespace-nowrap">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </PanelSection>
  );
};
