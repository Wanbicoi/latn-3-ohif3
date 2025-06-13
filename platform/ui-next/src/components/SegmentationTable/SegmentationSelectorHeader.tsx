import React from 'react';
import { Icons, Button } from '../../components';
import { useSegmentationTableContext } from './SegmentationTableContext';

export const SegmentationSelectorHeader = () => {
  const { data, activeSegmentationId, mode, storeSegmentation } = useSegmentationTableContext(
    'SegmentationTable.HeaderCollapsed'
  );

  if (mode !== 'collapsed' || !data?.length) {
    return null;
  }

  const activeSegmentationObj = data.find(
    seg => seg.segmentation.segmentationId === activeSegmentationId
  );

  const activeSegmentation = {
    id: activeSegmentationObj?.segmentation.segmentationId,
    label: activeSegmentationObj?.segmentation.label,
    info: activeSegmentationObj?.segmentation.cachedStats?.info,
  };

  const handleSaveClick = () => {
    // Simply call storeSegmentation - it will show the Create Report dialog
    storeSegmentation(activeSegmentation.id);
  };

  return (
    <div className="bg-primary-dark flex h-12 w-full items-center justify-between rounded-t px-4 py-2 border-b border-gray-600">
      {/* Left side - Title with icon */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0 animate-pulse"></div>
          <h3 className="text-foreground text-sm font-semibold">
            Segmentations
          </h3>
        </div>
      </div>

      {/* Right side - Save button */}
      <Button
        onClick={handleSaveClick}
        variant="default"
        size="sm"
        className="bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all duration-200 hover:shadow-lg"
      >
        <Icons.Download className="w-3 h-3" />
        <span className="pl-2 text-xs font-medium">Save</span>
      </Button>
    </div>
  );
};
