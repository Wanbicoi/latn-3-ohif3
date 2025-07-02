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
        const { data: { user } } = await supabaseClient.auth.getUser();
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
    if (isAdmin) {
      // Admin can delete directly - show beautiful confirmation dialog
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
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                    <Icons.Trash className="w-6 h-6 text-red-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-white mb-3">
                    Are you sure you want to delete this segmentation?
                  </p>
                  <div className="bg-secondary-dark p-4 rounded-lg mb-4">
                    <div className="text-sm text-gray-300 mb-2">
                      <span className="font-medium text-blue-400">Series:</span> {description}
                    </div>
                    <div className="text-sm text-gray-300 mb-2">
                      <span className="font-medium text-blue-400">Modality:</span> {modality}
                    </div>
                    <div className="text-sm text-gray-300">
                      <span className="font-medium text-blue-400">Series Number:</span> {seriesNumber}
                    </div>
                  </div>
                  <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3">
                    <p className="text-sm text-red-200">
                      ⚠️ <strong>Warning:</strong> This action cannot be undone. All segmentation data will be permanently removed from the system.
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
    } else {
      // Non-admin users get guidance message
      const fullName = userProfile 
        ? `${userProfile.first_name} ${userProfile.last_name}`.trim()
        : 'Doctor';
        
      servicesManager.services.uiNotificationService.show({
        title: 'Administrative Permission Required',
        message: `${fullName}, to delete this segmentation, please use "Clinical Review Request" above to submit a removal request to the administrator.`,
        type: 'info',
        duration: 6000,
      });
    }
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
                          <div className="text-xs text-gray-400">Request admin approval for removal</div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {/* Comment - Only for SEG modality */}
                  {modality === 'SEG' && (
                    <DropdownMenuItem
                      onSelect={() => {
                        const urlParams = new URLSearchParams(window.location.search);
                        const taskId = urlParams.get('taskId');
                        const studyInstanceUIDs = urlParams.get('StudyInstanceUIDs');
                        const commentUrl = `/ohif3/comments?segmentationId=${displaySetInstanceUID}&segmentIndex=1&taskId=${taskId}&studyInstanceUIDs=${studyInstanceUIDs}`;
                        window.location.href = commentUrl;
                      }}
                      className="gap-[6px] text-purple-400 hover:text-purple-300"
                    >
                      <Icons.Info className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Comment</div>
                        <div className="text-xs text-gray-400">Medical review discussion</div>
                      </div>
                    </DropdownMenuItem>
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
                      <div className="text-xs text-gray-400">Request admin approval for removal</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Comment - Only for SEG modality */}
              {modality === 'SEG' && (
                <DropdownMenuItem
                  onSelect={() => {
                    const urlParams = new URLSearchParams(window.location.search);
                    const taskId = urlParams.get('taskId');
                    const studyInstanceUIDs = urlParams.get('StudyInstanceUIDs');
                    const commentUrl = `/ohif3/comments?segmentationId=${displaySetInstanceUID}&segmentIndex=1&taskId=${taskId}&studyInstanceUIDs=${studyInstanceUIDs}`;
                    window.location.href = commentUrl;
                  }}
                  className="gap-[6px] text-purple-400 hover:text-purple-300"
                >
                  <Icons.Info className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Comment</div>
                    <div className="text-xs text-gray-400">Medical review discussion</div>
                  </div>
                </DropdownMenuItem>
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
