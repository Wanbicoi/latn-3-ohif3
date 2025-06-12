import React, { useState } from 'react';
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
} from '../DropdownMenu';
import { SeriesDownloadButton } from '../SegmentationTable/SeriesDownloadButton';
import { toast } from '../Sonner';

/**
 * Display a thumbnail for a display set.
 */
const Thumbnail = ({
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
}: withAppTypes): React.ReactNode => {
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

  // Download handler for SEG series
  const handleDownloadSeries = async () => {
    try {
      // Use production Orthanc URL - no process.env in browser
      const orthancUrl = 'https://latn-3.eastasia.cloudapp.azure.com/datasource';
      
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
        headers: { 'Accept': 'application/json' },
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
        headers: { 'Accept': 'application/json' },
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
            headers: { 'Accept': 'application/json' },
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
            if (orthancModality === modality && description && orthancDescription?.includes(description.toString())) {
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
        throw new Error(`No matching ${modality} series found with series number ${seriesNumber}. Check if the series exists in Orthanc.`);
      }
      
      console.log('✅ Using Orthanc Series ID:', matchingOrthancSeriesId);
      
      // Now try to download using the correct Orthanc series ID
      let downloadUrl = `${orthancUrl}/series/${matchingOrthancSeriesId}/archive`;
      
      let response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/zip, application/octet-stream, */*',
        },
      });

      // If series archive fails, try study archive
      if (!response.ok && response.status === 404) {
        console.log('📊 Series archive failed, trying study archive...');
        
        // Get the study ID from series info
        const seriesInfoResponse = await fetch(`${orthancUrl}/series/${matchingOrthancSeriesId}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        if (seriesInfoResponse.ok) {
          const seriesInfo = await seriesInfoResponse.json();
          const studyId = seriesInfo.ParentStudy;
          
          if (studyId) {
            downloadUrl = `${orthancUrl}/studies/${studyId}/archive`;
            response = await fetch(downloadUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/zip, application/octet-stream, */*',
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
            'Accept': 'application/zip, application/octet-stream, */*',
          },
          body: JSON.stringify({
            Resources: [matchingOrthancSeriesId],
            Synchronous: true
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
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      onThumbnailContextMenu('openDICOMTagViewer', {
                        displaySetInstanceUID,
                      });
                    }}
                    className="gap-[6px]"
                  >
                    <Icons.DicomTagBrowser />
                    Tag Browser
                  </DropdownMenuItem>
                  
                                {/* Download Series - Only for SEG modality */}
              {modality === 'SEG' && (
                    <DropdownMenuItem
                      onSelect={handleDownloadSeries}
                      className="gap-[6px]"
                    >
                      <Icons.Download className="h-4 w-4" />
                      Download Series
                    </DropdownMenuItem>
                  )}
                  
                  {/* Delete SEG Series */}
                  {modality === 'SEG' && (
                    <DropdownMenuItem
                      onSelect={() => {
                        if (window.confirm(`Are you sure you want to delete this SEG series: ${description}?`)) {
                          onReject();
                        }
                      }}
                      className="gap-[6px] text-red-500 hover:text-red-600"
                    >
                      <Icons.Trash className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
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
            <DropdownMenuContent hideWhenDetached>
              <DropdownMenuItem
                onSelect={() => {
                  onThumbnailContextMenu('openDICOMTagViewer', {
                    displaySetInstanceUID,
                  });
                }}
                className="gap-[6px]"
              >
                <Icons.DicomTagBrowser />
                Tag Browser
              </DropdownMenuItem>
              
              {/* Download Series - Only for SEG modality */}
              {modality === 'SEG' && (
                <DropdownMenuItem
                  onSelect={handleDownloadSeries}
                  className="gap-[6px]"
                >
                  <Icons.Download className="h-4 w-4" />
                  Download Series
                </DropdownMenuItem>
              )}
              
              {/* Delete SEG Series */}
              {modality === 'SEG' && (
                <DropdownMenuItem
                  onSelect={() => {
                    if (window.confirm(`Are you sure you want to delete this SEG series: ${description}?`)) {
                      onReject();
                    }
                  }}
                  className="gap-[6px] text-red-500 hover:text-red-600"
                >
                  <Icons.Trash className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
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
        'bg-muted hover:bg-primary/30 group flex cursor-pointer select-none flex-col rounded outline-none',
        viewPreset === 'thumbnails' && 'h-[170px] w-[135px]',
        viewPreset === 'list' && 'col-span-2 h-[40px] w-[275px]'
      )}
      id={`thumbnail-${displaySetInstanceUID}`}
      data-cy={
        thumbnailType === 'thumbnailNoImage'
          ? 'study-browser-thumbnail-no-image'
          : 'study-browser-thumbnail'
      }
      data-series={seriesNumber}
      onClick={onClick}
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
    </div>
  );
};

Thumbnail.propTypes = {
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
