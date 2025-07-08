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

// Global type declarations
declare global {
  interface Window {
    selectedSegmentationForApproval?: {
      segmentationId: string;
      seriesInstanceUID: string;
      label: string;
      timestamp: number;
    };
    showToast?: (message: string, type: 'success' | 'error') => void;
  }
}

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

  // Check initial state on mount
  React.useEffect(() => {
    const currentlySelected = window.selectedSegmentationForApproval;
    const isCurrentlySelected = currentlySelected?.segmentationId === segmentation.segmentationId;
    
    if (isCurrentlySelected) {
      setSelectedForValidation(segmentation.segmentationId);
      setValidationTimestamp(currentlySelected.timestamp);
    }
  }, [segmentation.segmentationId]);

  // Listen for global segmentation selection changes
  React.useEffect(() => {
    const handleSelectionChange = (event: any) => {
      const { newSelection } = event.detail;
      
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
  }, [segmentation.segmentationId]);

  if (!segmentation) {
    return null;
  }

  const isCurrentlySelected = selectedForValidation === segmentation.segmentationId;

  const handleClinicalValidation = () => {
    const seriesInstanceUID = segmentation.SeriesInstanceUID || segmentation.segmentationId;
    
    if (isCurrentlySelected) {
      // Deselect if already selected
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
      }
    }
  };

  // Handle modal confirmation
  const handleModalConfirm = () => {
    if (!pendingSelection) return;
    
    // User confirmed, switch to new SEG
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
        <div className={`pl-1.5 font-medium ${isCurrentlySelected ? 'text-green-300' : ''}`}>
          {segmentation.label}
          {isCurrentlySelected && (
            <span className="ml-2 text-xs bg-green-500/30 px-2 py-0.5 rounded-full text-green-200">
              Selected for Validation
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
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-md border-green-500' 
                  : 'hover:bg-green-600/20 hover:text-green-300 border border-green-600/30'
              }`}
            >
              {isCurrentlySelected ? (
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              )}
              <span className="text-xs font-medium">
                {isCurrentlySelected ? 'Selected' : 'Select for Validation'}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            <div className="text-sm">
              <div className="font-semibold mb-1">Clinical Validation Selection</div>
              <p className="text-xs text-gray-300">
                {isCurrentlySelected 
                  ? 'This segmentation is selected as the final clinical annotation. Click to deselect.'
                  : 'Select this segmentation as the final clinical annotation before task approval.'
                }
              </p>
              {isCurrentlySelected && validationTimestamp && (
                <div className="text-xs text-green-300 mt-1 pt-1 border-t border-gray-600">
                  Selected at: {new Date(validationTimestamp).toLocaleTimeString()}
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
