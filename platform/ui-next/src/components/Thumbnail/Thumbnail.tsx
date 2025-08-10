import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useDrag } from 'react-dnd';
import { Icons } from '../Icons';
import { DisplaySetMessageListTooltip } from '../DisplaySetMessageListTooltip';
import { TooltipTrigger, TooltipContent, Tooltip } from '../Tooltip';
import { Button } from '../Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../DropdownMenu';
import { Dialog, ButtonEnums } from '@ohif/ui';
// import { SeriesDownloadButton } from '../SegmentationTable/SeriesDownloadButton';
import { toast } from '../Sonner';
import { supabaseClient } from '../../lib/utils';
import { SegmentationSelectionModal } from '../SegmentationSelectionModal';
import { createClient } from '@supabase/supabase-js';

// Global type declarations
declare global {
  interface Window {
    selectedSegmentationForApproval?: {
      segmentationId: string;
      seriesInstanceUID: string;
      label: string;
      timestamp: number;
      isApproved?: boolean;
      approvedBy?: string;
    };
    showToast?: (message: string, type: 'success' | 'error') => void;
    taskCompletionStatus?: {
      isCompleted: boolean;
      completedBy?: string;
      completedAt?: string;
    };
  }
}

interface IUserProfile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

/**
 * Display a thumbnail for a display set.
 */
const Thumbnail = ({
  seriesInstanceUID,
  displaySetInstanceUID,
  className,
  imageSrc,
  imageAltText,
  description,
  seriesNumber,
  numInstances,
  loadingProgress,
  countIcon,
  messages,
  dragData = {},
  isActive,
  onClick,
  onDoubleClick,
  viewPreset = 'thumbnails',
  modality,
  isHydratedForDerivedDisplaySet = false,
  canReject = false,
  onReject = () => {},
  isTracked = false,
  thumbnailType = 'thumbnail',
  onClickUntrack = () => {},
  onThumbnailContextMenu,
  servicesManager,
}): React.ReactNode => {
  // State for clinical validation selection
  const [isSelectedForValidation, setIsSelectedForValidation] = useState(false);
  // State for selection modal
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{
    currentSelection: string;
    newSelection: string;
  } | null>(null);

  // Add state for threads checking
  const [threads, setThreads] = useState([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);

  // Add state for approved segmentation tracking
  const [isApproved, setIsApproved] = useState(false);
  const [approvedBy, setApprovedBy] = useState<string | null>(null);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);

  // Function to load approved segmentation from database
  const loadApprovedSegmentation = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const taskId = urlParams.get('taskId');

      if (!taskId) {
        return;
      }

      const supabaseUrl = 'https://bmeemseeqpnsqgwdpcoj.supabase.co';
      const supabaseKey =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZWVtc2VlcXBuc3Fnd2RwY29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MjM0OTcsImV4cCI6MjA1OTM5OTQ5N30.qGfF6_6sw5K-9QzDOcwjE-XOpMb-q2D5HgxFRB8LcYA';
      const client = createClient(supabaseUrl, supabaseKey, {
        db: { schema: 'public_v2' },
      });

      // Get task segmentation info using the view
      const { data: segmentationData } = await client
        .from('task_assignment_segmentations')
        .select('*')
        .eq('task_assignment_id', taskId)
        .eq('segmentation_id', seriesInstanceUID || displaySetInstanceUID)
        .eq('is_approved', true)
        .single();

      if (segmentationData) {
        // This SEG is already approved
        setIsApproved(true);
        setApprovedBy(segmentationData.user_full_name);
        setApprovedAt(segmentationData.created_at);

        // Set as selected for validation since it's approved
        setIsSelectedForValidation(true);

        // Check if global state is already set correctly to avoid race condition
        const currentGlobalSelection = window.selectedSegmentationForApproval;
        const shouldUpdateGlobal =
          !currentGlobalSelection ||
          currentGlobalSelection.segmentationId !== displaySetInstanceUID ||
          !currentGlobalSelection.isApproved;

        if (shouldUpdateGlobal) {
          // Update global state to reflect approved status
          window.selectedSegmentationForApproval = {
            segmentationId: displaySetInstanceUID,
            seriesInstanceUID: seriesInstanceUID || displaySetInstanceUID,
            label: description || `SEG S${seriesNumber}`,
            timestamp: Date.now(),
            isApproved: true,
            approvedBy: segmentationData.user_full_name,
          };

          // Dispatch event to update all other thumbnails/components
          // Use longer delay to ensure all thumbnails have finished initializing
          setTimeout(() => {
            if (window.selectedSegmentationForApproval) {
              window.dispatchEvent(
                new CustomEvent('segmentationSelectionChanged', {
                  detail: { newSelection: window.selectedSegmentationForApproval },
                })
              );
              console.log(
                '🔔 Dispatched approved segmentation selection event:',
                window.selectedSegmentationForApproval.label
              );
            }
          }, 500); // Longer delay to ensure all components are fully mounted and ready
        }

        console.log('✅ Found approved segmentation:', {
          segmentationId: seriesInstanceUID || displaySetInstanceUID,
          approvedBy: segmentationData.user_full_name,
          approvedAt: segmentationData.created_at,
        });
      } else {
        // Check if any other SEG is approved for this task to prevent conflicts
        const { data: otherApprovedSegs } = await client
          .from('task_assignment_segmentations')
          .select('*')
          .eq('task_assignment_id', taskId)
          .eq('is_approved', true);

        if (otherApprovedSegs && otherApprovedSegs.length > 0) {
          // Another SEG is already approved, clear this selection if it exists
          const approvedSeg = otherApprovedSegs[0];
          console.log('ℹ️ Another SEG is already approved:', approvedSeg.segmentation_id);

          // Clear this thumbnail if it was previously selected
          if (isSelectedForValidation && !isApproved) {
            setIsSelectedForValidation(false);
          }
        }
      }
    } catch (error) {
      console.error('Error loading approved segmentation:', error);
    }
  };

  // Load threads and approved segmentation on component mount
  useEffect(() => {
    loadThreads();
    // Add delay to avoid race condition with multiple thumbnails loading simultaneously
    const timer = setTimeout(
      () => {
        loadApprovedSegmentation();
      },
      Math.random() * 300 + 100
    ); // Random delay 100-400ms to stagger loads and ensure proper initialization

    return () => clearTimeout(timer);
  }, [seriesInstanceUID, displaySetInstanceUID]); // Add dependencies to ensure reload when data changes

  // Listen for task completion events to disable interactions
  useEffect(() => {
    const handleTaskCompleted = (event: CustomEvent) => {
      const { isCompleted } = event.detail;
      if (isCompleted) {
        // Task is completed, disable all interactions
        console.log('🔒 Task completed - disabling SEG interactions for:', displaySetInstanceUID);
      }
    };

    window.addEventListener('taskCompleted', handleTaskCompleted as EventListener);

    return () => {
      window.removeEventListener('taskCompleted', handleTaskCompleted as EventListener);
    };
  }, []);

  // Function to load and check threads status
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
      const supabaseKey =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZWVtc2VlcXBuc3Fnd2RwY29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MjM0OTcsImV4cCI6MjA1OTM5OTQ5N30.qGfF6_6sw5K-9QzDOcwjE-XOpMb-q2D5HgxFRB8LcYA';
      const client = createClient(supabaseUrl, supabaseKey, {
        db: { schema: 'public_v2' },
      });

      const { data: commentsData } = await client
        .from('_annotation_comments')
        .select('id, data')
        .eq('task_assignment_id', taskId);

      // Filter only parent comments (threads), not replies
      const parentComments = (commentsData || []).filter(
        comment => !comment.data?.parent_comment_id
      );

      setThreads(parentComments);
    } catch (error) {
      console.error('Error loading threads:', error);
      setThreads([]);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  // Function to check if all threads are resolved
  const areAllThreadsResolved = (): boolean => {
    if (threads.length === 0) return true; // No threads = OK to proceed
    return threads.every((thread: any) => thread.data?.status === 'resolved');
  };

  // Function to get unresolved thread count
  const getUnresolvedCount = (): number => {
    return threads.filter((thread: any) => thread.data?.status !== 'resolved').length;
  };

  // Check if this SEG is currently selected for validation
  useEffect(() => {
    if (isApproved) {
      // If approved, always show as selected and update global state if needed
      setIsSelectedForValidation(true);

      // Ensure global state reflects this approved SEG if not already set
      if (
        !window.selectedSegmentationForApproval ||
        !window.selectedSegmentationForApproval.isApproved
      ) {
        window.selectedSegmentationForApproval = {
          segmentationId: displaySetInstanceUID,
          seriesInstanceUID: seriesInstanceUID || displaySetInstanceUID,
          label: description || `SEG S${seriesNumber}`,
          timestamp: Date.now(),
          isApproved: true,
          approvedBy: approvedBy,
        };
        console.log('🔄 Updated global state for approved SEG:', description);
      }
      return;
    }

    const selectedSeg = window.selectedSegmentationForApproval;
    const isCurrentlySelected =
      selectedSeg?.seriesInstanceUID === seriesInstanceUID ||
      selectedSeg?.segmentationId === displaySetInstanceUID;
    setIsSelectedForValidation(isCurrentlySelected);
  }, [seriesInstanceUID, displaySetInstanceUID, isApproved, description, seriesNumber, approvedBy]);

  // Listen for global segmentation selection changes
  useEffect(() => {
    const handleSelectionChange = event => {
      const { newSelection } = event.detail;

      if (isApproved) {
        // If this SEG is approved, always keep it selected and don't change its state
        setIsSelectedForValidation(true);
        console.log('🔒 Keeping approved SEG selected:', description);
        return;
      }

      if (newSelection === null) {
        // Clear all non-approved selections
        setIsSelectedForValidation(false);
      } else {
        const isCurrentlySelected =
          newSelection?.seriesInstanceUID === seriesInstanceUID ||
          newSelection?.segmentationId === displaySetInstanceUID;
        setIsSelectedForValidation(isCurrentlySelected);

        if (isCurrentlySelected) {
          console.log('🎯 Updated selection state for:', description);
        }
      }
    };

    window.addEventListener('segmentationSelectionChanged', handleSelectionChange);

    return () => {
      window.removeEventListener('segmentationSelectionChanged', handleSelectionChange);
    };
  }, [seriesInstanceUID, displaySetInstanceUID, isApproved, description]);

  // TODO: We should wrap our thumbnail to create a "DraggableThumbnail", as
  // this will still allow for "drag", even if there is no drop target for the
  // specified item.
  const [collectedProps, drag, dragPreview] = useDrag({
    type: 'displayset',
    item: { ...dragData },
    canDrag: function (monitor) {
      return Object.keys(dragData).length !== 0;
    },
  });

  const [lastTap, setLastTap] = useState(0);
  const [userProfile, setUserProfile] = useState<IUserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch user profile and role on component mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();
        if (user?.id) {
          const { data: profileData, error } = await supabaseClient
            .from('hd_profile_list')
            .select('id, first_name, last_name, role')
            .eq('id', user.id)
            .single();

          if (profileData && !error) {
            setUserProfile(profileData);
            setIsAdmin(profileData.role === 'admin');
          } else {
            // Fallback: if no profile found, assume not admin
            setIsAdmin(false);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        setIsAdmin(false);
      }
    };

    fetchUserProfile();
  }, []);

  const handleTouchEnd = e => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
      onDoubleClick(e);
    } else {
      onClick(e);
    }
    setLastTap(currentTime);
  };

  const handleRequestRemove = async () => {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    const taskId = new URLSearchParams(location.search).get('taskId');
    await supabaseClient.rpc('hd_create_notification', {
      p_content: `${user.email} has requested clinical review for segment: ${description} in task: ${taskId}`,
      p_ref_id: seriesInstanceUID,
      p_type: 'SEGMENT_REQUEST_REMOVE',
    });
    servicesManager.services.uiNotificationService.show({
      title: 'Clinical Review Requested',
      message: 'Your removal request has been submitted for administrative review',
      type: 'success',
      duration: 4000,
    });
  };

  const handleDeleteClick = () => {
    // IMPORTANT: Removed admin check - anyone can now delete SEG series
    // Show beautiful confirmation dialog
    const dialogId = 'delete-segmentation-confirm';
    const { uiDialogService } = servicesManager.services;

    uiDialogService.create({
      id: dialogId,
      centralize: true,
      isDraggable: false,
      showOverlay: true,
      content: Dialog,
      contentProps: {
        title: '🗑️ Delete Segmentation',
        body: () => (
          <div className="bg-primary-dark p-6 text-white">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                  <Icons.Trash className="h-6 w-6 text-red-400" />
                </div>
              </div>
              <div className="flex-1">
                <p className="mb-3 text-lg font-semibold text-white">
                  Are you sure you want to delete this segmentation?
                </p>
                <div className="bg-secondary-dark mb-4 rounded-lg p-4">
                  <div className="mb-2 text-sm text-gray-300">
                    <span className="font-medium text-blue-400">Series:</span> {description}
                  </div>
                  <div className="mb-2 text-sm text-gray-300">
                    <span className="font-medium text-blue-400">Modality:</span> {modality}
                  </div>
                  <div className="text-sm text-gray-300">
                    <span className="font-medium text-blue-400">Series Number:</span>{' '}
                    {seriesNumber}
                  </div>
                </div>
                <div className="rounded-lg border border-red-500/50 bg-red-900/30 p-3">
                  <p className="text-sm text-red-200">
                    ⚠️ <strong>Warning:</strong> This action cannot be undone. All segmentation
                    data will be permanently removed from the system.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ),
        actions: [
          {
            id: 'cancel',
            text: 'Cancel',
            type: ButtonEnums.type.secondary,
          },
          {
            id: 'delete',
            text: 'Delete Permanently',
            type: ButtonEnums.type.primary,
            classes: ['bg-red-600', 'hover:bg-red-700', 'border-red-600'],
          },
        ],
        onClose: () => uiDialogService.dismiss({ id: dialogId }),
        onSubmit: async ({ action }) => {
          switch (action.id) {
            case 'delete':
              onReject();
              uiDialogService.dismiss({ id: dialogId });
              // Show success notification
              servicesManager.services.uiNotificationService.show({
                title: 'Segmentation Deleted',
                message: `Successfully deleted: ${description}`,
                type: 'success',
                duration: 3000,
              });
              break;
            case 'cancel':
              uiDialogService.dismiss({ id: dialogId });
              break;
          }
        },
      },
    });
  };

  // Handle clinical validation selection with threads check
  const handleClinicalValidation = async () => {
    // Check if task is completed first
    if (window.taskCompletionStatus?.isCompleted) {
      if (window.showToast) {
        window.showToast(
          'This task has been completed and locked. No further modifications are allowed.',
          'error'
        );
      }
      return;
    }

    // If already approved, show information instead of allowing change
    if (isApproved) {
      if (window.showToast) {
        window.showToast(
          `This segmentation is already approved by ${approvedBy}. Cannot modify approved selections.`,
          'success'
        );
      }
      return;
    }

    // Refresh threads status before proceeding
    await loadThreads();

    // Check if threads are resolved before allowing selection
    if (!areAllThreadsResolved()) {
      const unresolvedCount = getUnresolvedCount();

      // Show error notification at bottom-right
      if (window.showToast) {
        window.showToast(
          `Cannot select segmentation for validation. ${unresolvedCount} review thread${unresolvedCount === 1 ? '' : 's'} pending. Please resolve all threads first.`,
          'error'
        );
      }
      return; // Stop here, don't proceed with selection
    }

    if (isSelectedForValidation) {
      // Deselect if already selected (only for non-approved SEGs)
      setIsSelectedForValidation(false);

      // Clear global state
      if (window.selectedSegmentationForApproval) {
        delete window.selectedSegmentationForApproval;
      }

      console.log('🔹 Clinical validation cleared for:', description);

      // Show notification
      if (window.showToast) {
        window.showToast('Clinical validation cleared', 'success');
      }

      // Force re-render of all thumbnails to update their selection state
      window.dispatchEvent(
        new CustomEvent('segmentationSelectionChanged', {
          detail: { newSelection: null },
        })
      );
    } else {
      // Check if another SEG is already selected
      const currentlySelected = window.selectedSegmentationForApproval;

      if (currentlySelected && currentlySelected.seriesInstanceUID !== seriesInstanceUID) {
        // Another SEG is already selected, show professional modal
        const currentLabel = description || `SEG S${seriesNumber}`;
        setPendingSelection({
          currentSelection: currentlySelected.label,
          newSelection: currentLabel,
        });
        setShowSelectionModal(true);
      } else {
        // Clear any previous selection first to ensure only one SEG is selected
        if (window.selectedSegmentationForApproval) {
          console.log(
            '🔄 Clearing previous selection:',
            window.selectedSegmentationForApproval.label
          );
          delete window.selectedSegmentationForApproval;

          // Dispatch clear event first
          window.dispatchEvent(
            new CustomEvent('segmentationSelectionChanged', {
              detail: { newSelection: null },
            })
          );
        }

        // Small delay to ensure clear event is processed by all components
        setTimeout(() => {
          // No other SEG selected, proceed normally
          const timestamp = Date.now();
          setIsSelectedForValidation(true);

          // Set global state for the Approve Task button to use
          window.selectedSegmentationForApproval = {
            segmentationId: displaySetInstanceUID,
            seriesInstanceUID: seriesInstanceUID,
            label: description || `SEG S${seriesNumber}`,
            timestamp: timestamp,
          };

          console.log('✅ SEG selected for clinical validation:', {
            label: description,
            segmentationId: displaySetInstanceUID,
            seriesInstanceUID: seriesInstanceUID,
          });

          // Show notification
          if (window.showToast) {
            window.showToast(
              `Selected "${description || `SEG S${seriesNumber}`}" for final clinical validation. This segmentation will be used when approving the task.`,
              'success'
            );
          }

          // Force re-render of all thumbnails to update their selection state
          window.dispatchEvent(
            new CustomEvent('segmentationSelectionChanged', {
              detail: { newSelection: window.selectedSegmentationForApproval },
            })
          );
        }, 100); // Delay to ensure previous clear event is processed
      }
    }
  };

  // Handle modal confirmation with threads check
  const handleModalConfirm = async () => {
    if (!pendingSelection) return;

    // Check threads again before confirming
    await loadThreads();

    if (!areAllThreadsResolved()) {
      const unresolvedCount = getUnresolvedCount();

      // Show error notification and close modal
      if (window.showToast) {
        window.showToast(
          `Cannot select segmentation for validation. ${unresolvedCount} review thread${unresolvedCount === 1 ? '' : 's'} pending. Please resolve all threads first.`,
          'error'
        );
      }

      setShowSelectionModal(false);
      setPendingSelection(null);
      return;
    }

    // User confirmed, switch to new SEG

    // First clear previous selection
    if (window.selectedSegmentationForApproval) {
      delete window.selectedSegmentationForApproval;

      // Dispatch clear event first
      window.dispatchEvent(
        new CustomEvent('segmentationSelectionChanged', {
          detail: { newSelection: null },
        })
      );
    }

    // Small delay to ensure clear event is processed by all components
    setTimeout(() => {
      const timestamp = Date.now();
      setIsSelectedForValidation(true);

      // Update global state
      window.selectedSegmentationForApproval = {
        segmentationId: displaySetInstanceUID,
        seriesInstanceUID: seriesInstanceUID,
        label: description || `SEG S${seriesNumber}`,
        timestamp: timestamp,
      };

      console.log('🔄 SEG selection switched to:', {
        from: pendingSelection.currentSelection,
        to: pendingSelection.newSelection,
        newSeriesInstanceUID: seriesInstanceUID,
      });

      // Show notification
      if (window.showToast) {
        window.showToast(
          `Switched clinical validation selection to "${pendingSelection.newSelection}"`,
          'success'
        );
      }

      // Force re-render of all thumbnails to update their selection state
      window.dispatchEvent(
        new CustomEvent('segmentationSelectionChanged', {
          detail: { newSelection: window.selectedSegmentationForApproval },
        })
      );
    }, 100); // Delay to ensure previous clear event is processed

    // Close modal
    setShowSelectionModal(false);
    setPendingSelection(null);
  };

  // Handle modal close/cancel
  const handleModalClose = () => {
    // User cancelled, show info message
    if (window.showToast && pendingSelection) {
      window.showToast(
        `Clinical validation selection remains on "${pendingSelection.currentSelection}"`,
        'success'
      );
    }

    setShowSelectionModal(false);
    setPendingSelection(null);
  };

  const handleDownloadSeries = async () => {
    try {
      // Use production Orthanc URL - no process.env in browser
      const orthancUrl = 'https://mediflow-latn.duckdns.org/datasource';

      // Debug: Log all available information
      console.log('🔍 Debug Info:');
      console.log('- Display Set Instance UID:', displaySetInstanceUID);
      console.log('- Description:', description);
      console.log('- Modality:', modality);
      console.log('- Series Number:', seriesNumber);
      console.log('- Orthanc URL:', orthancUrl);

      // First, test basic connectivity to Orthanc
      console.log('🔗 Testing Orthanc connectivity...');
      const systemResponse = await fetch(`${orthancUrl}/system`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!systemResponse.ok) {
        throw new Error(`Cannot connect to Orthanc server: HTTP ${systemResponse.status}`);
      }

      const systemInfo = await systemResponse.json();
      console.log('✅ Orthanc system info:', systemInfo);

      // Get all series and find the matching one
      console.log('🔍 Finding matching series in Orthanc...');
      const seriesListResponse = await fetch(`${orthancUrl}/series`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!seriesListResponse.ok) {
        throw new Error('Cannot get series list from Orthanc');
      }

      const seriesList = await seriesListResponse.json();
      console.log('📊 Available series count:', seriesList.length);

      // Find matching series by modality and series number
      let matchingOrthancSeriesId = null;

      for (const orthancSeriesId of seriesList) {
        try {
          const seriesDetailResponse = await fetch(`${orthancUrl}/series/${orthancSeriesId}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });

          if (seriesDetailResponse.ok) {
            const seriesDetail = await seriesDetailResponse.json();
            const orthancModality = seriesDetail.MainDicomTags?.Modality;
            const orthancSeriesNumber = seriesDetail.MainDicomTags?.SeriesNumber;
            const orthancDescription = seriesDetail.MainDicomTags?.SeriesDescription;

            console.log(`📊 Checking series ${orthancSeriesId}:`, {
              modality: orthancModality,
              seriesNumber: orthancSeriesNumber,
              description: orthancDescription,
            });

            // Match by modality and series number
            if (orthancModality === modality && orthancSeriesNumber == seriesNumber) {
              console.log('🎯 Found matching series!');
              matchingOrthancSeriesId = orthancSeriesId;
              break;
            }

            // Alternative: Match by description if series number doesn't work
            if (
              orthancModality === modality &&
              description &&
              orthancDescription?.includes(description.toString())
            ) {
              console.log('🎯 Found matching series by description!');
              matchingOrthancSeriesId = orthancSeriesId;
              break;
            }
          }
        } catch (detailError) {
          // Skip if can't get series details
          continue;
        }
      }

      if (!matchingOrthancSeriesId) {
        throw new Error(
          `No matching ${modality} series found with series number ${seriesNumber}. Check if the series exists in Orthanc.`
        );
      }

      console.log('✅ Using Orthanc Series ID:', matchingOrthancSeriesId);

      // Now try to download using the correct Orthanc series ID
      let downloadUrl = `${orthancUrl}/series/${matchingOrthancSeriesId}/archive`;

      let response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/zip, application/octet-stream, */*',
        },
      });

      // If series archive fails, try study archive
      if (!response.ok && response.status === 404) {
        console.log('📊 Series archive failed, trying study archive...');

        // Get the study ID from series info
        const seriesInfoResponse = await fetch(`${orthancUrl}/series/${matchingOrthancSeriesId}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (seriesInfoResponse.ok) {
          const seriesInfo = await seriesInfoResponse.json();
          const studyId = seriesInfo.ParentStudy;

          if (studyId) {
            downloadUrl = `${orthancUrl}/studies/${studyId}/archive`;
            response = await fetch(downloadUrl, {
              method: 'GET',
              headers: {
                Accept: 'application/zip, application/octet-stream, */*',
              },
            });
          }
        }
      }

      // If still failing, try create-archive
      if (!response.ok && response.status === 404) {
        console.log('📊 Archive endpoints failed, trying create-archive...');

        response = await fetch(`${orthancUrl}/tools/create-archive`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/zip, application/octet-stream, */*',
          },
          body: JSON.stringify({
            Resources: [matchingOrthancSeriesId],
            Synchronous: true,
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Create download blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const cleanDescription = description?.toString().replace(/[^a-zA-Z0-9]/g, '_') || 'Series';
      const filename = `${cleanDescription}_${modality}_S${seriesNumber}_${timestamp}.zip`;

      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Success notification
      console.log(`✅ Downloaded: ${filename}`);

      // Show success toast
      toast.success('Download Complete', {
        description: `Successfully downloaded: ${filename}`,
        duration: 4000,
      });
    } catch (error) {
      console.error('❌ Download failed:', error);
      // Better error handling
      const errorMsg = error.message || 'Unknown error occurred';
      console.error(`Download failed: ${errorMsg}`);

      // Show error toast
      toast.error('Download Failed', {
        description: `${errorMsg}`,
        duration: 8000,
      });
    }
  };

  const handleThumbnailClick = () => {
    // Check if task is completed first
    if (window.taskCompletionStatus?.isCompleted) {
      // Show professional notification that task is locked
      if (window.showToast) {
        window.showToast(
          'This task has been approved and finalized. No further modifications are allowed.',
          'error'
        );
      }
      return; // Prevent any further action
    }

    // Call the original onClick handler if available
    if (onClick) {
      onClick(displaySetInstanceUID);
    }
  };

  const renderThumbnailPreset = () => {
    return (
      <div
        className={classnames(
          'flex h-full w-full flex-col items-center justify-center gap-[2px] p-[4px]',
          isActive && 'bg-popover rounded'
        )}
      >
        <div className="h-[114px] w-[128px]">
          <div className="relative">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={imageAltText}
                className="h-[114px] w-[128px] rounded"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="bg-background h-[114px] w-[128px] rounded"></div>
            )}

            {/* bottom left */}
            <div className="absolute bottom-0 left-0 flex h-[14px] items-center gap-[4px] rounded-tr pt-[10px] pb-[8px] pr-[6px] pl-[3px]">
              <div
                className={classnames(
                  'h-[10px] w-[10px] rounded-[2px]',
                  isActive || isHydratedForDerivedDisplaySet ? 'bg-highlight' : 'bg-primary/65',
                  loadingProgress && loadingProgress < 1 && 'bg-primary/25'
                )}
              ></div>
              <div className="text-[11px] font-semibold text-white">{modality}</div>
            </div>

            {/* top right */}
            <div className="absolute top-0 right-0 flex items-center gap-[4px]">
              <DisplaySetMessageListTooltip
                messages={messages}
                id={`display-set-tooltip-${displaySetInstanceUID}`}
              />
              {/* Clinical Validation Badge for SEG */}
              {modality === 'SEG' && isSelectedForValidation && (
                <Tooltip>
                  <TooltipTrigger>
                    <div
                      className={`rounded-full p-1 text-white shadow-lg ${
                        isApproved
                          ? 'bg-emerald-600 shadow-emerald-500/30'
                          : 'animate-pulse bg-green-600 shadow-green-500/20'
                      }`}
                    >
                      <svg
                        className="h-3 w-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        {isApproved ? (
                          // Approved icon (crown/badge)
                          <path
                            fillRule="evenodd"
                            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        ) : (
                          // Temporary selection icon (checkmark)
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        )}
                      </svg>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <div className="text-sm">
                      <div className="font-semibold text-green-300">
                        {isApproved
                          ? '🔒 Approved for Clinical Use'
                          : 'Selected for Clinical Validation'}
                      </div>
                      <div className="mt-1 text-xs text-gray-300">
                        {isApproved
                          ? `Approved by ${approvedBy}${approvedAt ? ` on ${new Date(approvedAt).toLocaleDateString()}` : ''} - Cannot be modified`
                          : 'This segmentation will be used for task approval'}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              {isTracked && (
                <Tooltip>
                  <TooltipTrigger>
                    <div className="group">
                      <Icons.StatusTracking className="text-primary-light h-[20px] w-[20px] group-hover:hidden" />
                      <Icons.Cancel
                        className="text-primary-light hidden h-[15px] w-[15px] group-hover:block"
                        onClick={onClickUntrack}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex flex-1 flex-row">
                      <div className="flex-2 flex items-center justify-center pr-4">
                        <Icons.InfoLink className="text-primary-active" />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <span>
                          <span className="text-white">
                            {isTracked ? 'Series is tracked' : 'Series is untracked'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {/* bottom right */}
            <div className="absolute bottom-0 right-0 flex items-center gap-[4px] p-[4px]">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden group-hover:inline-flex data-[state=open]:inline-flex"
                  >
                    <Icons.More />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  hideWhenDetached
                  align="start"
                  className="w-56"
                >
                  {/* Clinical Review Request - Only for non-admin users */}
                  {!isAdmin && (
                    <>
                      <DropdownMenuItem
                        onSelect={handleRequestRemove}
                        className="gap-[6px] text-blue-400 hover:text-blue-300"
                      >
                        <Icons.Trash className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Clinical Review Request</div>
                          <div className="text-xs text-gray-400">
                            Request admin approval for removal
                          </div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {/* Clinical Validation - Only for SEG modality */}
                  {modality === 'SEG' && (
                    <>
                      <DropdownMenuItem
                        onSelect={handleClinicalValidation}
                        className={`gap-[6px] ${
                          isSelectedForValidation
                            ? 'text-green-400 hover:text-green-300'
                            : 'text-amber-400 hover:text-amber-300'
                        }`}
                      >
                        {isSelectedForValidation ? (
                          <svg
                            className="h-4 w-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-4 w-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                        <div>
                          <div className="font-medium">
                            {isApproved
                              ? 'Approved for Clinical Use'
                              : isSelectedForValidation
                                ? 'Selected for Validation'
                                : 'Select for Clinical Validation'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {isApproved
                              ? `Approved by ${approvedBy} - Cannot be modified`
                              : isSelectedForValidation
                                ? 'This segmentation is ready for task approval'
                                : 'Choose this as the final clinical annotation'}
                          </div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {/* Download Series - Only for SEG modality */}
                  {modality === 'SEG' && (
                    <DropdownMenuItem
                      onSelect={handleDownloadSeries}
                      className="gap-[6px] text-green-400 hover:text-green-300"
                    >
                      <Icons.Download className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Download Series</div>
                        <div className="text-xs text-gray-400">Export segmentation data</div>
                      </div>
                    </DropdownMenuItem>
                  )}

                  {/* Delete SEG Series - Always show but behavior differs */}
                  {modality === 'SEG' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={handleDeleteClick}
                        className="gap-[6px] text-red-400 hover:text-red-300"
                      >
                        <Icons.Trash className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Delete</div>
                          <div className="text-xs text-gray-400">Permanently remove segmentation</div>
                        </div>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        <div className="mt-3 flex h-[52px] w-[128px] flex-col">
          <div className="min-h-[18px] w-[128px] overflow-hidden text-ellipsis pb-0.5 pl-1 text-[12px] font-normal leading-4 text-white">
            {description}
          </div>
          <div className="flex h-[12px] items-center gap-[7px] overflow-hidden">
            <div className="text-muted-foreground pl-1 text-[11px]"> S:{seriesNumber}</div>
            <div className="text-muted-foreground text-[11px]">
              <div className="flex items-center gap-[4px]">
                {countIcon ? (
                  React.createElement(Icons[countIcon] || Icons.MissingIcon, { className: 'w-3' })
                ) : (
                  <Icons.InfoSeries className="w-3" />
                )}
                <div>{numInstances}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderListPreset = () => {
    return (
      <div
        className={classnames(
          'flex h-full w-full items-center justify-between pr-[8px] pl-[8px] pt-[4px] pb-[4px]',
          isActive && 'bg-popover rounded'
        )}
      >
        <div className="relative flex h-[32px] items-center gap-[8px]">
          <div
            className={classnames(
              'h-[32px] w-[4px] rounded-[2px]',
              isActive || isHydratedForDerivedDisplaySet ? 'bg-highlight' : 'bg-primary/65',
              loadingProgress && loadingProgress < 1 && 'bg-primary/25'
            )}
          ></div>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-[7px]">
              <div className="text-[13px] font-semibold text-white">{modality}</div>

              <div className="max-w-[160px] overflow-hidden overflow-ellipsis whitespace-nowrap text-[13px] font-normal text-white">
                {description}
              </div>
            </div>

            <div className="flex h-[12px] items-center gap-[7px] overflow-hidden">
              <div className="text-muted-foreground text-[12px]"> S:{seriesNumber}</div>
              <div className="text-muted-foreground text-[12px]">
                <div className="flex items-center gap-[4px]">
                  {' '}
                  {countIcon ? (
                    React.createElement(Icons[countIcon] || Icons.MissingIcon, { className: 'w-3' })
                  ) : (
                    <Icons.InfoSeries className="w-3" />
                  )}
                  <div>{numInstances}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex h-full items-center gap-[4px]">
          <DisplaySetMessageListTooltip
            messages={messages}
            id={`display-set-tooltip-${displaySetInstanceUID}`}
          />

          {/* Clinical Validation Badge for SEG in List View */}
          {modality === 'SEG' && isSelectedForValidation && (
            <Tooltip>
              <TooltipTrigger>
                <div className="rounded-full bg-green-600 p-1 text-white shadow-lg shadow-green-500/30">
                  <svg
                    className="h-3 w-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    {isApproved ? (
                      // Approved icon (crown/badge)
                      <path
                        fillRule="evenodd"
                        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    ) : (
                      // Temporary selection icon (checkmark)
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    )}
                  </svg>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                <div className="text-sm">
                  <div className="font-semibold text-green-300">
                    {isApproved
                      ? '🔒 Approved for Clinical Use'
                      : 'Selected for Clinical Validation'}
                  </div>
                  <div className="mt-1 text-xs text-gray-300">
                    {isApproved
                      ? `Approved by ${approvedBy}${approvedAt ? ` on ${new Date(approvedAt).toLocaleDateString()}` : ''} - Cannot be modified`
                      : 'This segmentation will be used for task approval'}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {isTracked && (
            <Tooltip>
              <TooltipTrigger>
                <div className="group">
                  <Icons.StatusTracking className="text-primary-light h-[20px] w-[20px] group-hover:hidden" />
                  <Icons.Cancel
                    className="text-primary-light hidden h-[15px] w-[15px] group-hover:block"
                    onClick={onClickUntrack}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="flex flex-1 flex-row">
                  <div className="flex-2 flex items-center justify-center pr-4">
                    <Icons.InfoLink className="text-primary-active" />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span>
                      <span className="text-white">
                        {isTracked ? 'Series is tracked' : 'Series is untracked'}
                      </span>
                    </span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden group-hover:inline-flex data-[state=open]:inline-flex"
              >
                <Icons.More />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              hideWhenDetached
              className="w-56"
            >
              {/* Clinical Review Request - Only for non-admin users */}
              {!isAdmin && (
                <>
                  <DropdownMenuItem
                    onSelect={handleRequestRemove}
                    className="gap-[6px] text-blue-400 hover:text-blue-300"
                  >
                    <Icons.Trash className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Clinical Review Request</div>
                      <div className="text-xs text-gray-400">
                        Request admin approval for removal
                      </div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Clinical Validation - Only for SEG modality */}
              {modality === 'SEG' && (
                <>
                  <DropdownMenuItem
                    onSelect={handleClinicalValidation}
                    className={`gap-[6px] ${
                      isSelectedForValidation
                        ? 'text-green-400 hover:text-green-300'
                        : 'text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    {isSelectedForValidation ? (
                      <svg
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    <div>
                      <div className="font-medium">
                        {isApproved
                          ? 'Approved for Clinical Use'
                          : isSelectedForValidation
                            ? 'Selected for Validation'
                            : 'Select for Clinical Validation'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {isApproved
                          ? `Approved by ${approvedBy} - Cannot be modified`
                          : isSelectedForValidation
                            ? 'This segmentation is ready for task approval'
                            : 'Choose this as the final clinical annotation'}
                      </div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Download Series - Only for SEG modality */}
              {modality === 'SEG' && (
                <DropdownMenuItem
                  onSelect={handleDownloadSeries}
                  className="gap-[6px] text-green-400 hover:text-green-300"
                >
                  <Icons.Download className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Download Series</div>
                    <div className="text-xs text-gray-400">Export segmentation data</div>
                  </div>
                </DropdownMenuItem>
              )}

              {/* Delete SEG Series - Always show but behavior differs */}
              {modality === 'SEG' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={handleDeleteClick}
                    className="gap-[6px] text-red-400 hover:text-red-300"
                  >
                    <Icons.Trash className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Delete</div>
                      <div className="text-xs text-gray-400">
                        {isAdmin ? 'Permanently remove segmentation' : 'Requires admin permission'}
                      </div>
                    </div>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div
      className={classnames(
        className,
        'bg-muted hover:bg-primary/30 group flex cursor-pointer select-none flex-col rounded outline-none transition-all duration-300',
        viewPreset === 'thumbnails' && 'h-[170px] w-[135px]',
        viewPreset === 'list' && 'col-span-2 h-[40px] w-[275px]',
        // Highlight for clinical validation selection - use same green color for both approved and temporary
        modality === 'SEG' &&
          isSelectedForValidation &&
          'border border-green-500/50 bg-green-500/20 shadow-lg shadow-green-500/30 ring-2 ring-green-500 ring-opacity-50'
      )}
      id={`thumbnail-${displaySetInstanceUID}`}
      data-cy={
        thumbnailType === 'thumbnailNoImage'
          ? 'study-browser-thumbnail-no-image'
          : 'study-browser-thumbnail'
      }
      data-series={seriesNumber}
      onClick={handleThumbnailClick}
      onDoubleClick={onDoubleClick}
      onTouchEnd={handleTouchEnd}
      role="button"
    >
      <div
        ref={drag}
        className="h-full w-full"
      >
        {viewPreset === 'thumbnails' && renderThumbnailPreset()}
        {viewPreset === 'list' && renderListPreset()}
      </div>

      {/* Professional Modal for Segmentation Selection */}
      {pendingSelection && (
        <SegmentationSelectionModal
          isOpen={showSelectionModal}
          onClose={handleModalClose}
          onConfirm={handleModalConfirm}
          currentSelection={pendingSelection.currentSelection}
          newSelection={pendingSelection.newSelection}
        />
      )}
    </div>
  );
};

Thumbnail.propTypes = {
  seriesInstanceUID: PropTypes.string.isRequired,
  displaySetInstanceUID: PropTypes.string.isRequired,
  className: PropTypes.string,
  imageSrc: PropTypes.string,
  /**
   * Data the thumbnail should expose to a receiving drop target. Use a matching
   * `dragData.type` to identify which targets can receive this draggable item.
   * If this is not set, drag-n-drop will be disabled for this thumbnail.
   *
   * Ref: https://react-dnd.github.io/react-dnd/docs/api/use-drag#specification-object-members
   */
  dragData: PropTypes.shape({
    /** Must match the "type" a dropTarget expects */
    type: PropTypes.string.isRequired,
  }),
  imageAltText: PropTypes.string,
  description: PropTypes.string.isRequired,
  seriesNumber: PropTypes.any,
  numInstances: PropTypes.number.isRequired,
  loadingProgress: PropTypes.number,
  messages: PropTypes.object,
  isActive: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  onDoubleClick: PropTypes.func.isRequired,
  viewPreset: PropTypes.string,
  modality: PropTypes.string,
  isHydratedForDerivedDisplaySet: PropTypes.bool,
  canReject: PropTypes.bool,
  onReject: PropTypes.func,
  isTracked: PropTypes.bool,
  onClickUntrack: PropTypes.func,
  countIcon: PropTypes.string,
  thumbnailType: PropTypes.oneOf(['thumbnail', 'thumbnailTracked', 'thumbnailNoImage']),
};

export { Thumbnail };
