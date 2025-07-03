import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabaseClient } from '../../lib/utils';
import { MessageCircle, Send, User, Clock, TestTube } from 'lucide-react';

interface TestSeriesCommentsProps {
  taskAssignmentId?: string;
  seriesInstanceUID?: string;
}

export const TestSeriesComments: React.FC<TestSeriesCommentsProps> = ({
  taskAssignmentId: propTaskAssignmentId,
  seriesInstanceUID: propSeriesInstanceUID
}) => {
  const [testTaskAssignmentId, setTestTaskAssignmentId] = useState(
    propTaskAssignmentId || '421e1138-860a-41b0-9db4-ce5ea60088f' // Example from your table
  );
  const [testSeriesInstanceUID, setTestSeriesInstanceUID] = useState(
    propSeriesInstanceUID || '1.2.840.113704.1.111.6904.1682663281.1' // Example series
  );
  const [newComment, setNewComment] = useState('');

  // Query comments for this series
  const { data: comments = [], refetch: refetchComments, isLoading } = useQuery({
    queryKey: ['test-series-comments', testTaskAssignmentId, testSeriesInstanceUID],
    queryFn: async () => {
      if (!testTaskAssignmentId || !testSeriesInstanceUID) return [];
      
      console.log('🧪 Test: Fetching comments for:', { testTaskAssignmentId, testSeriesInstanceUID });
      
      const { data, error } = await supabaseClient
        .from('_annotation_comments')
        .select(`
          *,
          _users!author_id(full_name, avatar_url)
        `)
        .eq('task_assignment_id', testTaskAssignmentId)
        .eq('series_instance_uid', testSeriesInstanceUID)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error:', error);
        throw error;
      }

      console.log('✅ Comments loaded:', data);
      return data || [];
    },
    enabled: !!testTaskAssignmentId && !!testSeriesInstanceUID,
    retry: 1,
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      console.log('🧪 Test: Adding comment:', { 
        task_assignment_id: testTaskAssignmentId,
        series_instance_uid: testSeriesInstanceUID,
        comment 
      });

      const { data, error } = await supabaseClient
        .from('_annotation_comments')
        .insert({
          task_assignment_id: testTaskAssignmentId,
          author_id: user.id,
          comment: comment,
          series_instance_uid: testSeriesInstanceUID,
          data: {}
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
      setNewComment('');
      refetchComments();
      console.log('✅ Comment added successfully');
    },
    onError: (error) => {
      console.error('❌ Failed to add comment:', error);
      alert('Failed to add comment: ' + error.message);
    }
  });

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment.trim());
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <TestTube className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900">Test Series Comments</h2>
      </div>

      {/* Test Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Task Assignment ID
          </label>
          <input
            type="text"
            value={testTaskAssignmentId}
            onChange={(e) => setTestTaskAssignmentId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
            placeholder="421e1138-860a-41b0-9db4-ce5ea60088f"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Series Instance UID
          </label>
          <input
            type="text"
            value={testSeriesInstanceUID}
            onChange={(e) => setTestSeriesInstanceUID(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
            placeholder="1.2.840.113704.1.111.6904.1682663281.1"
          />
        </div>
      </div>

      {/* Comments Display */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Comments ({comments.length})
          </h3>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>

        <div className="space-y-4 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-4">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No comments found for this series</p>
              <p className="text-sm text-gray-400 mt-1">Add the first comment below</p>
            </div>
          ) : (
            comments.map((comment: any) => (
              <div key={comment.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  {comment._users?.avatar_url ? (
                    <img 
                      src={comment._users.avatar_url} 
                      alt={comment._users.full_name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <User className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {comment._users?.full_name || 'Anonymous'}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {new Date(comment.created_at).toLocaleString()}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {comment.comment}
                  </p>
                  <div className="text-xs text-gray-400 mt-1 font-mono">
                    ID: {comment.id}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Comment Form */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-md font-semibold text-gray-900 mb-3">Add New Comment</h4>
        <div className="flex gap-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Enter your test comment here..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || addCommentMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {addCommentMutation.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Debug Info */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
          🔍 Debug Information
        </summary>
        <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono">
          <div><strong>Task Assignment ID:</strong> {testTaskAssignmentId}</div>
          <div><strong>Series Instance UID:</strong> {testSeriesInstanceUID}</div>
          <div><strong>Comments Count:</strong> {comments.length}</div>
          <div><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</div>
          <div><strong>Database Table:</strong> public_v2._annotation_comments</div>
        </div>
      </details>
    </div>
  );
}; 