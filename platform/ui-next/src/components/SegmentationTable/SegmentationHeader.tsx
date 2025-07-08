import React from 'react';
import { Button } from '../Button';
import { Icons } from '../Icons/Icons';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '../DropdownMenu';
import { Tooltip, TooltipTrigger, TooltipContent } from '../Tooltip/Tooltip';
import { useSegmentationTableContext } from './SegmentationTableContext';
import { useTranslation } from 'react-i18next';
import { SegmentationSelectionModal } from '../SegmentationSelectionModal';
import { createClient } from '@supabase/supabase-js';

// Global type declarations already defined in Thumbnail.tsx

export const SegmentationHeader: React.FC<{
  segmentation?: any;
}> = ({ segmentation }) => {
  const { t } = useTranslation('SegmentationTable');
  const {
    onSegmentAdd,
    onSegmentationRemoveFromViewport,
    onSegmentationEdit,
    onSegmentationDelete,
    onSegmentationDownload,
    onSegmentationDownloadRTSS,
    storeSegmentation,
  } = useSegmentationTableContext('SegmentationHeader');

  // State for selected segmentation for clinical validation
  const [selectedForValidation, setSelectedForValidation] = React.useState<string | null>(null);
  const [validationTimestamp, setValidationTimestamp] = React.useState<number | null>(null);
  // State for selection modal
  const [showSelectionModal, setShowSelectionModal] = React.useState(false);
  const [pendingSelection, setPendingSelection] = React.useState<{
    currentSelection: string;
    newSelection: string;
  } | null>(null);

  // Add state for threads checking
  const [threads, setThreads] = React.useState([]);
  const [isLoadingThreads, setIsLoadingThreads] = React.useState(false);

  // Add state for approved segmentation tracking
  const [isApproved, setIsApproved] = React.useState(false);
  const [approvedBy, setApprovedBy] = React.useState<string | null>(null);
  const [approvedAt, setApprovedAt] = React.useState<string | null>(null);

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

  // Function to check if all threads are resolved
  const areAllThreadsResolved = (): boolean => {
    if (threads.length === 0) return true; // No threads = OK to proceed
    return threads.every((thread: any) => thread.data?.status === 'resolved');
  };

  // Function to get unresolved thread count
  const getUnresolvedCount = (): number => {
    return threads.filter((thread: any) => thread.data?.status !== 'resolved').length;
  };

  // Load threads and approved segmentation on component mount
  React.useEffect(() => {
    loadThreads();
    // Add delay to avoid race condition with multiple components loading simultaneously
    const timer = setTimeout(() => {
      loadApprovedSegmentation();
    }, Math.random() * 200); // Random delay 0-200ms to stagger loads
    
    return () => clearTimeout(timer);
  }, [segmentation?.segmentationId]);

  // Function to load approved segmentation from database
  const loadApprovedSegmentation = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const taskId = urlParams.get('taskId');
      
      if (!taskId || !segmentation) {
        return;
      }

      const supabaseUrl = 'https://bmeemseeqpnsqgwdpcoj.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZWVtc2VlcXBuc3Fnd2RwY29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MjM0OTcsImV4cCI6MjA1OTM5OTQ5N30.qGfF6_6sw5K-9QzDOcwjE-XOpMb-q2D5HgxFRB8LcYA';
      const client = createClient(supabaseUrl, supabaseKey, {
        db: { schema: 'public_v2' }
      });

      const seriesInstanceUID = segmentation.SeriesInstanceUID || segmentation.segmentationId;

      // Get task segmentation info using the view
      const { data: segmentationData } = await client
        .from('task_assignment_segmentations')
        .select('*')
        .eq('task_assignment_id', taskId)
        .eq('segmentation_id', seriesInstanceUID)
        .eq('is_approved', true)
        .single();

      if (segmentationData) {
        // This SEG is already approved
        setIsApproved(true);
        setApprovedBy(segmentationData.user_full_name);
        setApprovedAt(segmentationData.created_at);
        
        // Set as selected for validation since it's approved
        setSelectedForValidation(segmentation.segmentationId);
        setValidationTimestamp(new Date(segmentationData.created_at).getTime());
        
        // Check if global state is already set correctly to avoid race condition
        const currentGlobalSelection = window.selectedSegmentationForApproval;
        const shouldUpdateGlobal = !currentGlobalSelection || 
          currentGlobalSelection.segmentationId !== segmentation.segmentationId ||
          !currentGlobalSelection.isApproved;
        
        if (shouldUpdateGlobal) {
          // Update global state to reflect approved status
          window.selectedSegmentationForApproval = {
            segmentationId: segmentation.segmentationId,
            seriesInstanceUID: seriesInstanceUID,
            label: segmentation.label,
            timestamp: Date.now(),
            isApproved: true,
            approvedBy: segmentationData.user_full_name
          };
          
          // Dispatch event to update all other components
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('segmentationSelectionChanged', {
              detail: { newSelection: window.selectedSegmentationForApproval }
            }));
          }, 100); // Small delay to ensure all components are mounted
        }
        
        console.log('✅ Found approved segmentation in header:', {
          segmentationId: seriesInstanceUID,
          approvedBy: segmentationData.user_full_name,
          approvedAt: segmentationData.created_at
        });
      }
    } catch (error) {
      console.error('Error loading approved segmentation in header:', error);
    }
  };

  // Check initial state on mount
  React.useEffect(() => {
    if (isApproved) {
      // If approved, always show as selected
      setSelectedForValidation(segmentation.segmentationId);
      return;
    }
    
    const currentlySelected = window.selectedSegmentationForApproval;
    const isCurrentlySelected = currentlySelected?.segmentationId === segmentation.segmentationId;
    
    if (isCurrentlySelected) {
      setSelectedForValidation(segmentation.segmentationId);
      setValidationTimestamp(currentlySelected.timestamp);
    }
  }, [segmentation.segmentationId, isApproved]);

  // Listen for global segmentation selection changes
  React.useEffect(() => {
    const handleSelectionChange = (event: any) => {
      const { newSelection } = event.detail;
      
      if (isApproved) {
        // If this SEG is approved, don't change its selection state
        return;
      }
      
      if (newSelection === null) {
        // Clear all selections
        setSelectedForValidation(null);
        setValidationTimestamp(null);
      } else {
        const isCurrentlySelected = newSelection?.segmentationId === segmentation.segmentationId;
        
        if (isCurrentlySelected) {
          setSelectedForValidation(segmentation.segmentationId);
          setValidationTimestamp(newSelection.timestamp);
        } else {
          setSelectedForValidation(null);
          setValidationTimestamp(null);
        }
      }
    };

    window.addEventListener('segmentationSelectionChanged', handleSelectionChange);
    
    return () => {
      window.removeEventListener('segmentationSelectionChanged', handleSelectionChange);
    };
  }, [segmentation.segmentationId, isApproved]);

  if (!segmentation) {
    return null;
  }

  const isCurrentlySelected = selectedForValidation === segmentation.segmentationId;

  const handleClinicalValidation = async () => {
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

    const seriesInstanceUID = segmentation.SeriesInstanceUID || segmentation.segmentationId;
    
    if (isCurrentlySelected) {
      // Deselect if already selected (only for non-approved SEGs)
      setSelectedForValidation(null);
      setValidationTimestamp(null);
      
      // Clear global state
      if (window.selectedSegmentationForApproval) {
        delete window.selectedSegmentationForApproval;
      }
      
      console.log('🔹 Clinical validation cleared for:', segmentation.label);
      
      // Show notification
      if (window.showToast) {
        window.showToast('Clinical validation cleared', 'success');
      }
      
      // Force re-render of all components to update their selection state
      window.dispatchEvent(new CustomEvent('segmentationSelectionChanged', {
        detail: { newSelection: null }
      }));
    } else {
      // Check if another SEG is already selected
      const currentlySelected = window.selectedSegmentationForApproval;
      
      if (currentlySelected && currentlySelected.segmentationId !== segmentation.segmentationId) {
        // Another SEG is already selected, show professional modal
        setPendingSelection({
          currentSelection: currentlySelected.label,
          newSelection: segmentation.label
        });
        setShowSelectionModal(true);
      } else {
        // Clear any previous selection first to ensure only one SEG is selected
        if (window.selectedSegmentationForApproval) {
          console.log('🔄 Clearing previous selection in header:', window.selectedSegmentationForApproval.label);
          delete window.selectedSegmentationForApproval;
          
          // Dispatch clear event first
          window.dispatchEvent(new CustomEvent('segmentationSelectionChanged', {
            detail: { newSelection: null }
          }));
        }
        
        // Small delay to ensure clear event is processed by all components
        setTimeout(() => {
          // No other SEG selected, proceed normally
          const timestamp = Date.now();
          setSelectedForValidation(segmentation.segmentationId);
          setValidationTimestamp(timestamp);
          
          // Set global state for the Approve Task button to use
          window.selectedSegmentationForApproval = {
            segmentationId: segmentation.segmentationId,
            seriesInstanceUID: seriesInstanceUID,
            label: segmentation.label,
            timestamp: timestamp
          };
          
          console.log('✅ SEG selected for clinical validation:', {
            label: segmentation.label,
            segmentationId: segmentation.segmentationId,
            seriesInstanceUID: seriesInstanceUID
          });
          
          // Show notification
          if (window.showToast) {
            window.showToast(
              `Selected "${segmentation.label}" for final validation. This segmentation will be used when approving the task.`,
              'success'
            );
          }
          
          // Force re-render of all components to update their selection state
          window.dispatchEvent(new CustomEvent('segmentationSelectionChanged', {
            detail: { newSelection: window.selectedSegmentationForApproval }
          }));
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
      window.dispatchEvent(new CustomEvent('segmentationSelectionChanged', {
        detail: { newSelection: null }
      }));
    }
    
    // Small delay to ensure clear event is processed by all components
    setTimeout(() => {
      const timestamp = Date.now();
      setSelectedForValidation(segmentation.segmentationId);
      setValidationTimestamp(timestamp);
      
      // Update global state
      const seriesInstanceUID = segmentation.SeriesInstanceUID || segmentation.segmentationId;
      window.selectedSegmentationForApproval = {
        segmentationId: segmentation.segmentationId,
        seriesInstanceUID: seriesInstanceUID,
        label: segmentation.label,
        timestamp: timestamp
      };
      
      console.log('🔄 SEG selection switched to:', {
        from: pendingSelection.currentSelection,
        to: pendingSelection.newSelection,
        newSegmentationId: segmentation.segmentationId
      });
      
      // Show notification
      if (window.showToast) {
        window.showToast(
          `Switched clinical validation selection to "${pendingSelection.newSelection}"`,
          'success'
        );
      }
      
      // Force re-render of all components to update their selection state
      window.dispatchEvent(new CustomEvent('segmentationSelectionChanged', {
        detail: { newSelection: window.selectedSegmentationForApproval }
      }));
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

  return (
    <div className={`text-foreground flex h-8 w-full items-center justify-between transition-all duration-300 ${
      isCurrentlySelected 
        ? 'bg-green-500/20 border border-green-500/50 rounded-md px-2 shadow-lg shadow-green-500/20' 
        : ''
    }`}>
      <div className="flex items-center space-x-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-1"
              onClick={e => e.stopPropagation()}
            >
              <Icons.More />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={e => {
                e.stopPropagation();
                onSegmentAdd(segmentation.segmentationId);
              }}
            >
              <Icons.Add className="text-foreground" />
              <span className="pl-2">{t('Add Segment')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={e => {
                e.stopPropagation();
                onSegmentationRemoveFromViewport(segmentation.segmentationId);
              }}
            >
              <Icons.Series className="text-foreground" />
              <span className="pl-2">{t('Remove from Viewport')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={e => {
                e.stopPropagation();
                onSegmentationEdit(segmentation.segmentationId);
              }}
            >
              <Icons.Rename className="text-foreground" />
              <span className="pl-2">{t('Rename')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={e => e.stopPropagation()}>
              <Icons.Hide className="text-foreground" />
              <span className="pl-2">{t('Hide or Show all Segments')}</span>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger onClick={e => e.stopPropagation()}>
                <Icons.Export className="text-foreground" />
                <span className="pl-2">{t('Export & Download')}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={e => {
                      e.stopPropagation();
                      storeSegmentation(segmentation.segmentationId);
                    }}
                  >
                    {t('Export DICOM SEG')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={e => {
                      e.stopPropagation();
                      onSegmentationDownload(segmentation.segmentationId);
                    }}
                  >
                    {t('Download DICOM SEG')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={e => {
                      e.stopPropagation();
                      onSegmentationDownloadRTSS(segmentation.segmentationId);
                    }}
                  >
                    {t('Download DICOM RTSTRUCT')}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSegmentationDelete(segmentation.segmentationId)}>
              <Icons.Delete className="text-red-600" />
              <span className="pl-2 text-red-600">{t('Delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className={`pl-1.5 font-medium ${
          isCurrentlySelected 
            ? isApproved ? 'text-emerald-300' : 'text-green-300' 
            : ''
        }`}>
          {segmentation.label}
          {isCurrentlySelected && (
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
              isApproved 
                ? 'bg-emerald-500/40 text-emerald-200' 
                : 'bg-green-500/30 text-green-200'
            }`}>
              {isApproved ? `Approved by ${approvedBy}` : 'Selected for Validation'}
            </span>
          )}
        </div>
      </div>
      <div className="mr-1 flex items-center space-x-1">
        {/* Clinical Validation Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isCurrentlySelected ? "default" : "ghost"}
              size="sm"
              onClick={handleClinicalValidation}
              className={`transition-all duration-300 ${
                isCurrentlySelected 
                  ? isApproved
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md border-emerald-500' 
                    : 'bg-green-600 hover:bg-green-700 text-white shadow-md border-green-500'
                  : 'hover:bg-green-600/20 hover:text-green-300 border border-green-600/30'
              }`}
            >
              {isCurrentlySelected ? (
                isApproved ? (
                  // Approved icon (crown/badge)
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                ) : (
                  // Temporary selection icon (checkmark)
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                )
              ) : (
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              )}
              <span className="text-xs font-medium">
                {isApproved 
                  ? 'Approved' 
                  : isCurrentlySelected 
                    ? 'Selected' 
                    : 'Select for Validation'
                }
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            <div className="text-sm">
              <div className={`font-semibold mb-1 ${isApproved ? 'text-emerald-300' : ''}`}>
                {isApproved ? 'Approved for Clinical Use' : 'Clinical Validation Selection'}
              </div>
              <p className="text-xs text-gray-300">
                {isApproved
                  ? `This segmentation was approved by ${approvedBy}. Cannot be modified.`
                  : isCurrentlySelected 
                    ? 'This segmentation is selected as the final clinical annotation. Click to deselect.'
                    : 'Select this segmentation as the final clinical annotation before task approval.'
                }
              </p>
              {isCurrentlySelected && validationTimestamp && !isApproved && (
                <div className="text-xs text-green-300 mt-1 pt-1 border-t border-gray-600">
                  Selected at: {new Date(validationTimestamp).toLocaleTimeString()}
                </div>
              )}
              {isApproved && approvedAt && (
                <div className="text-xs text-emerald-300 mt-1 pt-1 border-t border-gray-600">
                  Approved on: {new Date(approvedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Info Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
            >
              <Icons.Info className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{segmentation.cachedStats.info}</p>
          </TooltipContent>
        </Tooltip>
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
