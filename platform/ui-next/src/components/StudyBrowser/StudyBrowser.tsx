import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import { StudyItem } from '../StudyItem';
import { StudyBrowserSort } from '../StudyBrowserSort';
import { StudyBrowserViewOptions } from '../StudyBrowserViewOptions';

const getTrackedSeries = displaySets => {
  let trackedSeries = 0;
  displaySets.forEach(displaySet => {
    if (displaySet.isTracked) {
      trackedSeries++;
    }
  });

  return trackedSeries;
};

const noop = () => {};

const StudyBrowser = ({
  tabs,
  activeTabName,
  expandedStudyInstanceUIDs,
  onClickTab = noop,
  onClickStudy = noop,
  onClickThumbnail = noop,
  onDoubleClickThumbnail = noop,
  onClickUntrack = noop,
  activeDisplaySetInstanceUIDs,
  servicesManager,
  showSettings,
  viewPresets,
  onThumbnailContextMenu,
}: withAppTypes) => {
  const [searchFilter, setSearchFilter] = useState('');

  // Listen for search filter changes from StudyBrowserSort
  useEffect(() => {
    const handleSearchFilter = (event: any) => {
      if (event.detail && event.detail.searchTerm !== undefined) {
        setSearchFilter(event.detail.searchTerm);
      }
    };

    window.addEventListener('ohif-search-filter-changed', handleSearchFilter);
    return () => {
      window.removeEventListener('ohif-search-filter-changed', handleSearchFilter);
    };
  }, []);

  const getTabContent = () => {
    const tabData = tabs.find(tab => tab.name === activeTabName);
    const viewPreset = viewPresets
      ? viewPresets.filter(preset => preset.selected)[0]?.id
      : 'thumbnails';
    return tabData.studies.map(
      ({ studyInstanceUid, date, description, numInstances, modalities, displaySets }) => {
        const isExpanded = expandedStudyInstanceUIDs.includes(studyInstanceUid);
        
        // Filter displaySets based on search term
        const filteredDisplaySets = displaySets.filter((ds: any) => {
          // Check multiple possible field names for modality
          const modality = ds.Modality || ds.modality || ds.modalityDisplayName || '';
          
          // Always show non-SEG items (CT, MR, etc.)
          if (modality !== 'SEG' && !ds.description?.includes('draft') && !ds.description?.includes('te')) {
            return true;
          }
          
          // If no search term, show all items
          if (!searchFilter.trim()) return true;
          
          // For SEG-like items, filter by search term using multiple possible description fields
          const description = ds.SeriesDescription || ds.description || ds.displaySetDescription || ds.seriesDescription || '';
          return description.toLowerCase().includes(searchFilter.toLowerCase());
        });
        
        // Find SEG-like items using description patterns
        const segLikeItems = displaySets.filter((ds: any) => {
          const desc = (ds.description || ds.SeriesDescription || '').toLowerCase();
          return desc.includes('draft') || desc.includes('te') || desc.includes('seg');
        });
        
        const segItems = displaySets.filter((ds: any) => ds.Modality === 'SEG');
        
        return (
          <React.Fragment key={studyInstanceUid}>
            <StudyItem
              date={date}
              description={description}
              numInstances={numInstances}
              isExpanded={isExpanded}
              displaySets={filteredDisplaySets} // Use filtered displaySets
              modalities={modalities}
              trackedSeries={getTrackedSeries(filteredDisplaySets)} // Update tracked series count
              isActive={isExpanded}
              onClick={() => {
                onClickStudy(studyInstanceUid);
              }}
              onClickThumbnail={onClickThumbnail}
              onDoubleClickThumbnail={onDoubleClickThumbnail}
              onClickUntrack={onClickUntrack}
              activeDisplaySetInstanceUIDs={activeDisplaySetInstanceUIDs}
              data-cy="thumbnail-list"
              viewPreset={viewPreset}
              onThumbnailContextMenu={onThumbnailContextMenu}
              servicesManager={servicesManager}
            />
          </React.Fragment>
        );
      }
    );
  };

  return (
    <div
      className="ohif-scrollbar invisible-scrollbar bg-bkg-low flex flex-1 flex-col gap-[4px] overflow-auto pt-px"
      data-cy={'studyBrowser-panel'}
    >
      {showSettings && (
        <div className="w-full bg-bkg-low flex flex-col gap-2 px-3 py-3">
          <StudyBrowserSort servicesManager={servicesManager} />
        </div>
      )}
      {getTabContent()}
    </div>
  );
};

StudyBrowser.propTypes = {
  onClickTab: PropTypes.func.isRequired,
  onClickStudy: PropTypes.func,
  onClickThumbnail: PropTypes.func,
  onDoubleClickThumbnail: PropTypes.func,
  onClickUntrack: PropTypes.func,
  activeTabName: PropTypes.string.isRequired,
  expandedStudyInstanceUIDs: PropTypes.arrayOf(PropTypes.string).isRequired,
  activeDisplaySetInstanceUIDs: PropTypes.arrayOf(PropTypes.string),
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      studies: PropTypes.arrayOf(
        PropTypes.shape({
          studyInstanceUid: PropTypes.string.isRequired,
          date: PropTypes.string,
          numInstances: PropTypes.number,
          modalities: PropTypes.string,
          description: PropTypes.string,
          displaySets: PropTypes.arrayOf(
            PropTypes.shape({
              displaySetInstanceUID: PropTypes.string.isRequired,
              imageSrc: PropTypes.string,
              imageAltText: PropTypes.string,
              seriesDate: PropTypes.string,
              seriesNumber: PropTypes.any,
              numInstances: PropTypes.number,
              description: PropTypes.string,
              componentType: PropTypes.oneOf(['thumbnail', 'thumbnailTracked', 'thumbnailNoImage'])
                .isRequired,
              isTracked: PropTypes.bool,
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
            })
          ),
        })
      ).isRequired,
    })
  ),
};

export { StudyBrowser };

