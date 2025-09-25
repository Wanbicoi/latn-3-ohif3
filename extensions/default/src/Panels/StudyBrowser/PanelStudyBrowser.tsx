import React, { useState, useEffect } from 'react';
import { useImageViewer, useViewportGrid } from '@ohif/ui';
import { StudyBrowser } from '@ohif/ui-next';
import { utils } from '@ohif/core';
import { useNavigate } from 'react-router-dom';
import { Separator } from '@ohif/ui-next';
import { PanelStudyBrowserHeader } from './PanelStudyBrowserHeader';
import { defaultActionIcons, defaultViewPresets } from './constants';

const { sortStudyInstances, formatDate, createStudyBrowserTabs } = utils;

/**
 *
 * @param {*} param0
 */
function PanelStudyBrowser({
  servicesManager,
  getImageSrc,
  getStudiesForPatientByMRN,
  requestDisplaySetCreationForStudy,
  dataSource,
  commandsManager,
}: withAppTypes) {
  const { hangingProtocolService, displaySetService, uiNotificationService, customizationService } =
    servicesManager.services;
  const navigate = useNavigate();

  // Normally you nest the components so the tree isn't so deep, and the data
  // doesn't have to have such an intense shape. This works well enough for now.
  // Tabs --> Studies --> DisplaySets --> Thumbnails
  const { StudyInstanceUIDs } = useImageViewer();
  const [{ activeViewportId, viewports, isHangingProtocolLayout }, viewportGridService] =
    useViewportGrid();
  const [activeTabName, setActiveTabName] = useState('all');
  const [expandedStudyInstanceUIDs, setExpandedStudyInstanceUIDs] = useState([
    ...StudyInstanceUIDs,
  ]);
  const [hasLoadedViewports, setHasLoadedViewports] = useState(false);
  const [studyDisplayList, setStudyDisplayList] = useState([]);
  const [displaySets, setDisplaySets] = useState([]);
  const [thumbnailImageSrcMap, setThumbnailImageSrcMap] = useState({});

  const [viewPresets, setViewPresets] = useState(
    customizationService.getCustomization('studyBrowser.viewPresets')?.value || defaultViewPresets
  );

  const [actionIcons, setActionIcons] = useState(defaultActionIcons);

  // multiple can be true or false
  const updateActionIconValue = actionIcon => {
    actionIcon.value = !actionIcon.value;
    const newActionIcons = [...actionIcons];
    setActionIcons(newActionIcons);

    // Handle downloadFullStudy action
    if (actionIcon.id === 'downloadFullStudy') {
      handleDownloadFullStudy();
    }
  };

  // Download full study from Orthanc
  const handleDownloadFullStudy = async () => {
    try {
      // Get current study instance UID
      const displaySets = displaySetService.getActiveDisplaySets();
      if (!displaySets || displaySets.length === 0) {
        uiNotificationService.show({
          title: 'No Study',
          message: 'No study is currently loaded',
          type: 'error',
        });
        return;
      }

      const studyInstanceUID = displaySets[0].StudyInstanceUID;

      // Get Orthanc configuration
      const dataSourceConfig = (dataSource as any).getConfig?.();
      const orthancUrl = dataSourceConfig?.wadoRoot || dataSourceConfig?.qidoRoot || '';

      if (!orthancUrl) {
        console.error('Orthanc URL not found');
        uiNotificationService.show({
          title: 'Configuration Error',
          message: 'Orthanc server URL not found',
          type: 'error',
        });
        return;
      }

      // Find Orthanc study ID using the /tools/find endpoint
      const findUrl = `${orthancUrl.replace('/dicom-web', '')}/tools/find`;
      const findResponse = await fetch(findUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Level: 'Study',
          Query: {
            StudyInstanceUID: studyInstanceUID,
          },
        }),
      });

      if (!findResponse.ok) {
        throw new Error('Failed to find study in Orthanc');
      }

      const orthancStudyIds = await findResponse.json();

      if (!orthancStudyIds || orthancStudyIds.length === 0) {
        throw new Error('Study not found in Orthanc');
      }

      const orthancStudyId = orthancStudyIds[0];

      // Create download URL for the study archive
      const downloadUrl = `${orthancUrl.replace('/dicom-web', '')}/studies/${orthancStudyId}/archive`;

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `study_${studyInstanceUID}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      uiNotificationService.show({
        title: 'Download Started',
        message: 'Full study download has started',
        type: 'success',
      });
    } catch (error) {
      console.error('Error downloading full study:', error);
      uiNotificationService.show({
        title: 'Download Error',
        message: error.message || 'Failed to download full study',
        type: 'error',
      });
    }
  };

  // only one is true at a time
  const updateViewPresetValue = viewPreset => {
    if (!viewPreset) {
      return;
    }
    const newViewPresets = viewPresets.map(preset => {
      preset.selected = preset.id === viewPreset.id;
      return preset;
    });
    setViewPresets(newViewPresets);
  };

  const onDoubleClickThumbnailHandler = displaySetInstanceUID => {
    let updatedViewports = [];
    const viewportId = activeViewportId;
    try {
      updatedViewports = hangingProtocolService.getViewportsRequireUpdate(
        viewportId,
        displaySetInstanceUID,
        isHangingProtocolLayout
      );
    } catch (error) {
      console.warn(error);
      uiNotificationService.show({
        title: 'Thumbnail Double Click',
        message: 'The selected display sets could not be added to the viewport.',
        type: 'error',
        duration: 3000,
      });
    }

    viewportGridService.setDisplaySetsForViewports(updatedViewports);
  };

  // ~~ studyDisplayList
  useEffect(() => {
    // Fetch all studies for the patient in each primary study
    async function fetchStudiesForPatient(StudyInstanceUID) {
      // current study qido
      const qidoForStudyUID = await dataSource.query.studies.search({
        studyInstanceUid: StudyInstanceUID,
      });

      if (!qidoForStudyUID?.length) {
        navigate('/notfoundstudy', '_self');
        throw new Error('Invalid study URL');
      }

      let qidoStudiesForPatient = qidoForStudyUID;

      // try to fetch the prior studies based on the patientID if the
      // server can respond.
      try {
        qidoStudiesForPatient = await getStudiesForPatientByMRN(qidoForStudyUID);
      } catch (error) {
        console.warn(error);
      }

      const mappedStudies = _mapDataSourceStudies(qidoStudiesForPatient);
      const actuallyMappedStudies = mappedStudies.map(qidoStudy => {
        return {
          studyInstanceUid: qidoStudy.StudyInstanceUID,
          date: formatDate(qidoStudy.StudyDate),
          description: qidoStudy.StudyDescription,
          modalities: qidoStudy.ModalitiesInStudy,
          numInstances: qidoStudy.NumInstances,
        };
      });

      setStudyDisplayList(prevArray => {
        const ret = [...prevArray];
        for (const study of actuallyMappedStudies) {
          if (!prevArray.find(it => it.studyInstanceUid === study.studyInstanceUid)) {
            ret.push(study);
          }
        }
        return ret;
      });
    }

    StudyInstanceUIDs.forEach(sid => fetchStudiesForPatient(sid));
  }, [StudyInstanceUIDs, dataSource, getStudiesForPatientByMRN, navigate]);

  // // ~~ Initial Thumbnails
  useEffect(() => {
    if (!hasLoadedViewports) {
      if (activeViewportId) {
        // Once there is an active viewport id, it means the layout is ready
        // so wait a bit of time to allow the viewports preferential loading
        // which improves user experience of responsiveness significantly on slower
        // systems.
        window.setTimeout(() => setHasLoadedViewports(true), 250);
      }

      return;
    }

    const currentDisplaySets = displaySetService.activeDisplaySets;
    currentDisplaySets.forEach(async dSet => {
      const newImageSrcEntry = {};
      const displaySet = displaySetService.getDisplaySetByUID(dSet.displaySetInstanceUID);
      const imageIds = dataSource.getImageIdsForDisplaySet(displaySet);
      const imageId = imageIds[Math.floor(imageIds.length / 2)];

      // TODO: Is it okay that imageIds are not returned here for SR displaySets?
      if (!imageId || displaySet?.unsupported) {
        return;
      }
      // When the image arrives, render it and store the result in the thumbnailImgSrcMap
      newImageSrcEntry[dSet.displaySetInstanceUID] = await getImageSrc(imageId);

      setThumbnailImageSrcMap(prevState => {
        return { ...prevState, ...newImageSrcEntry };
      });
    });
  }, [
    StudyInstanceUIDs,
    dataSource,
    displaySetService,
    getImageSrc,
    hasLoadedViewports,
    activeViewportId,
  ]);

  // ~~ displaySets
  useEffect(() => {
    // TODO: Are we sure `activeDisplaySets` will always be accurate?
    const currentDisplaySets = displaySetService.activeDisplaySets;
    const mappedDisplaySets = _mapDisplaySets(
      currentDisplaySets,
      thumbnailImageSrcMap,
      displaySetService,
      uiNotificationService
    );
    sortStudyInstances(mappedDisplaySets);

    setDisplaySets(mappedDisplaySets);
  }, [StudyInstanceUIDs, thumbnailImageSrcMap, displaySetService, uiNotificationService]);

  // ~~ subscriptions --> displaySets
  useEffect(() => {
    // DISPLAY_SETS_ADDED returns an array of DisplaySets that were added
    const SubscriptionDisplaySetsAdded = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_ADDED,
      data => {
        // for some reason this breaks thumbnail loading
        // if (!hasLoadedViewports) {
        //   return;
        // }
        const { displaySetsAdded } = data;
        displaySetsAdded.forEach(async dSet => {
          const newImageSrcEntry = {};
          const displaySet = displaySetService.getDisplaySetByUID(dSet.displaySetInstanceUID);
          if (displaySet?.unsupported) {
            return;
          }

          const imageIds = dataSource.getImageIdsForDisplaySet(displaySet);
          const imageId = imageIds[Math.floor(imageIds.length / 2)];

          // TODO: Is it okay that imageIds are not returned here for SR displaysets?
          if (!imageId) {
            return;
          }
          // When the image arrives, render it and store the result in the thumbnailImgSrcMap
          newImageSrcEntry[dSet.displaySetInstanceUID] = await getImageSrc(
            imageId,
            dSet.initialViewport
          );

          setThumbnailImageSrcMap(prevState => {
            return { ...prevState, ...newImageSrcEntry };
          });
        });
      }
    );

    return () => {
      SubscriptionDisplaySetsAdded.unsubscribe();
    };
  }, [getImageSrc, dataSource, displaySetService]);

  useEffect(() => {
    // TODO: Will this always hold _all_ the displaySets we care about?
    // DISPLAY_SETS_CHANGED returns `DisplaySerService.activeDisplaySets`
    const SubscriptionDisplaySetsChanged = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_CHANGED,
      changedDisplaySets => {
        const mappedDisplaySets = _mapDisplaySets(
          changedDisplaySets,
          thumbnailImageSrcMap,
          displaySetService,
          uiNotificationService
        );
        setDisplaySets(mappedDisplaySets);
      }
    );

    const SubscriptionDisplaySetMetaDataInvalidated = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SET_SERIES_METADATA_INVALIDATED,
      () => {
        const mappedDisplaySets = _mapDisplaySets(
          displaySetService.getActiveDisplaySets(),
          thumbnailImageSrcMap,
          displaySetService,
          uiNotificationService
        );

        setDisplaySets(mappedDisplaySets);
      }
    );

    return () => {
      SubscriptionDisplaySetsChanged.unsubscribe();
      SubscriptionDisplaySetMetaDataInvalidated.unsubscribe();
    };
  }, [StudyInstanceUIDs, thumbnailImageSrcMap, displaySetService, uiNotificationService]);

  const tabs = createStudyBrowserTabs(StudyInstanceUIDs, studyDisplayList, displaySets);

  // TODO: Should not fire this on "close"
  function _handleStudyClick(StudyInstanceUID) {
    const shouldCollapseStudy = expandedStudyInstanceUIDs.includes(StudyInstanceUID);
    const updatedExpandedStudyInstanceUIDs = shouldCollapseStudy
      ? // eslint-disable-next-line prettier/prettier
        [...expandedStudyInstanceUIDs.filter(stdyUid => stdyUid !== StudyInstanceUID)]
      : [...expandedStudyInstanceUIDs, StudyInstanceUID];

    setExpandedStudyInstanceUIDs(updatedExpandedStudyInstanceUIDs);

    if (!shouldCollapseStudy) {
      const madeInClient = true;
      requestDisplaySetCreationForStudy(displaySetService, StudyInstanceUID, madeInClient);
    }
  }

  const activeDisplaySetInstanceUIDs = viewports.get(activeViewportId)?.displaySetInstanceUIDs;

  const onThumbnailContextMenu = (commandName, options) => {
    commandsManager.runCommand(commandName, options);
  };

  return (
    <>
      <>
        <PanelStudyBrowserHeader
          viewPresets={viewPresets}
          updateViewPresetValue={updateViewPresetValue}
          actionIcons={actionIcons}
          updateActionIconValue={updateActionIconValue}
        />
        <Separator
          orientation="horizontal"
          className="bg-black"
          thickness="2px"
        />
      </>

      <StudyBrowser
        tabs={tabs}
        servicesManager={servicesManager}
        activeTabName={activeTabName}
        onDoubleClickThumbnail={onDoubleClickThumbnailHandler}
        activeDisplaySetInstanceUIDs={activeDisplaySetInstanceUIDs}
        expandedStudyInstanceUIDs={expandedStudyInstanceUIDs}
        onClickStudy={_handleStudyClick}
        onClickTab={clickedTabName => {
          setActiveTabName(clickedTabName);
        }}
        showSettings={actionIcons.find(icon => icon.id === 'settings').value}
        viewPresets={viewPresets}
        onThumbnailContextMenu={onThumbnailContextMenu}
      />
    </>
  );
}

export default PanelStudyBrowser;

/**
 * Maps from the DataSource's format to a naturalized object
 *
 * @param {*} studies
 */
function _mapDataSourceStudies(studies) {
  return studies.map(study => {
    // TODO: Why does the data source return in this format?
    return {
      AccessionNumber: study.accession,
      StudyDate: study.date,
      StudyDescription: study.description,
      NumInstances: study.instances,
      ModalitiesInStudy: study.modalities,
      PatientID: study.mrn,
      PatientName: study.patientName,
      StudyInstanceUID: study.studyInstanceUid,
      StudyTime: study.time,
    };
  });
}

function _mapDisplaySets(
  displaySets,
  thumbnailImageSrcMap,
  displaySetService,
  uiNotificationService
) {
  const thumbnailDisplaySets = [];
  const thumbnailNoImageDisplaySets = [];

  // Ensure displaySets is an array
  const safeDisplaySets = Array.isArray(displaySets) ? displaySets : [];

  console.log('🔍 _mapDisplaySets called with:', {
    displaySetsType: typeof displaySets,
    isArray: Array.isArray(displaySets),
    length: safeDisplaySets.length,
    displaySets: safeDisplaySets,
  });

  safeDisplaySets
    .filter(ds => !ds.excludeFromThumbnailBrowser)
    .forEach(ds => {
      const imageSrc = thumbnailImageSrcMap[ds.displaySetInstanceUID];
      const componentType = _getComponentType(ds);

      const array =
        componentType === 'thumbnail' ? thumbnailDisplaySets : thumbnailNoImageDisplaySets;

      const displaySetData = {
        displaySetInstanceUID: ds.displaySetInstanceUID,
        description: ds.SeriesDescription || '',
        seriesNumber: ds.SeriesNumber,
        modality: ds.Modality,
        seriesDate: ds.SeriesDate,
        seriesTime: ds.SeriesTime,
        numInstances: ds.numImageFrames,
        countIcon: ds.countIcon,
        StudyInstanceUID: ds.StudyInstanceUID,
        messages: ds.messages,
        componentType,
        imageSrc,
        dragData: {
          type: 'displayset',
          displaySetInstanceUID: ds.displaySetInstanceUID,
          // .. Any other data to pass
        },
        isHydratedForDerivedDisplaySet: ds.isHydrated,
      };

      // Add delete functionality for SEG series
      if (ds.Modality === 'SEG') {
        displaySetData.canReject = true;
        displaySetData.onReject = async () => {
          try {
            // Use production Orthanc URL
            const orthancUrl = 'https://latn3.selab.edu.vn/datasource';

            console.log('🗑️ Deleting SEG series:', {
              displaySetInstanceUID: ds.displaySetInstanceUID,
              seriesInstanceUID: ds.SeriesInstanceUID,
              description: ds.SeriesDescription,
              modality: ds.Modality,
              seriesNumber: ds.SeriesNumber,
            });

            // First, find the Orthanc series ID
            const seriesListResponse = await fetch(`${orthancUrl}/series`, {
              method: 'GET',
              headers: { Accept: 'application/json' },
            });

            if (!seriesListResponse.ok) {
              throw new Error('Cannot get series list from Orthanc');
            }

            const seriesList = await seriesListResponse.json();
            let matchingOrthancSeriesId = null;

            // Find matching series by modality and series number
            for (const orthancSeriesId of seriesList) {
              try {
                const seriesDetailResponse = await fetch(
                  `${orthancUrl}/series/${orthancSeriesId}`,
                  {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                  }
                );

                if (seriesDetailResponse.ok) {
                  const seriesDetail = await seriesDetailResponse.json();
                  const orthancModality = seriesDetail.MainDicomTags?.Modality;
                  const orthancSeriesNumber = seriesDetail.MainDicomTags?.SeriesNumber;
                  const orthancDescription = seriesDetail.MainDicomTags?.SeriesDescription;

                  // Match by modality and series number
                  if (orthancModality === ds.Modality && orthancSeriesNumber == ds.SeriesNumber) {
                    console.log('🎯 Found matching series for deletion:', orthancSeriesId);
                    matchingOrthancSeriesId = orthancSeriesId;
                    break;
                  }

                  // Alternative: Match by description if series number doesn't work
                  if (
                    orthancModality === ds.Modality &&
                    ds.SeriesDescription &&
                    orthancDescription?.includes(ds.SeriesDescription)
                  ) {
                    console.log(
                      '🎯 Found matching series by description for deletion:',
                      orthancSeriesId
                    );
                    matchingOrthancSeriesId = orthancSeriesId;
                    break;
                  }
                }
              } catch (detailError) {
                continue;
              }
            }

            if (!matchingOrthancSeriesId) {
              throw new Error(`No matching ${ds.Modality} series found for deletion`);
            }

            // Delete the series from Orthanc
            console.log('🗑️ Deleting from Orthanc:', matchingOrthancSeriesId);
            const deleteResponse = await fetch(`${orthancUrl}/series/${matchingOrthancSeriesId}`, {
              method: 'DELETE',
              headers: { Accept: 'application/json' },
            });

            if (!deleteResponse.ok) {
              throw new Error(`Failed to delete from Orthanc: HTTP ${deleteResponse.status}`);
            }

            console.log('✅ Successfully deleted from Orthanc');

            // Remove the displaySet from the UI service
            displaySetService.deleteDisplaySet(ds.displaySetInstanceUID);

            // Show success notification
            uiNotificationService.show({
              title: 'SEG Series Deleted',
              message: `Successfully deleted SEG series: ${ds.SeriesDescription || 'Unnamed'} from both UI and server`,
              type: 'success',
              duration: 4000,
            });
          } catch (error) {
            console.error('❌ Delete failed:', error);

            // Show error notification
            uiNotificationService.show({
              title: 'Delete Failed',
              message: `Failed to delete SEG series: ${error.message}`,
              type: 'error',
              duration: 6000,
            });
          }
        };
      }

      array.push(displaySetData);
    });

  return [...thumbnailDisplaySets, ...thumbnailNoImageDisplaySets];
}

const thumbnailNoImageModalities = ['SR', 'SEG', 'SM', 'RTSTRUCT', 'RTPLAN', 'RTDOSE'];

function _getComponentType(ds) {
  if (thumbnailNoImageModalities.includes(ds.Modality) || ds?.unsupported) {
    // TODO probably others.
    return 'thumbnailNoImage';
  }

  return 'thumbnail';
}
