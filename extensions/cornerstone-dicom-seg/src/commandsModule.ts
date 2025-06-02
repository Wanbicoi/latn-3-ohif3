// @ts-nocheck
import dcmjs from 'dcmjs';
import { createReportDialogPrompt } from '@ohif/extension-default';
import { Types } from '@ohif/core';
import { cache, metaData } from '@cornerstonejs/core';
import {
  segmentation as cornerstoneToolsSegmentation,
  Enums as cornerstoneToolsEnums,
  utilities,
} from '@cornerstonejs/tools';
import { adaptersRT, helpers, adaptersSEG } from '@cornerstonejs/adapters';
import { classes, DicomMetadataStore } from '@ohif/core';

import vtkImageMarchingSquares from '@kitware/vtk.js/Filters/General/ImageMarchingSquares';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';

const { segmentation: segmentationUtils } = utilities;

const { datasetToBlob } = dcmjs.data;

const getTargetViewport = ({ viewportId, viewportGridService }) => {
  const { viewports, activeViewportId } = viewportGridService.getState();
  const targetViewportId = viewportId || activeViewportId;

  const viewport = viewports.get(targetViewportId);

  return viewport;
};

const {
  Cornerstone3D: {
    Segmentation: { generateSegmentation },
  },
} = adaptersSEG;

const {
  Cornerstone3D: {
    RTSS: { generateRTSSFromSegmentations },
  },
} = adaptersRT;

const { downloadDICOMData } = helpers;

const commandsModule = ({
  servicesManager,
  extensionManager,
}: Types.Extensions.ExtensionParams): Types.Extensions.CommandsModule => {
  const {
    segmentationService,
    uiDialogService,
    uiNotificationService,
    displaySetService,
    viewportGridService,
    toolGroupService,
  } = servicesManager.services as AppTypes.Services;

  const actions = {
    /**
     * Loads segmentations for a specified viewport.
     * The function prepares the viewport for rendering, then loads the segmentation details.
     * Additionally, if the segmentation has scalar data, it is set for the corresponding label map volume.
     *
     * @param {Object} params - Parameters for the function.
     * @param params.segmentations - Array of segmentations to be loaded.
     * @param params.viewportId - the target viewport ID.
     *
     */
    loadSegmentationsForViewport: async ({ segmentations, viewportId }) => {
      // Todo: handle adding more than one segmentation
      const viewport = getTargetViewport({ viewportId, viewportGridService });
      const displaySetInstanceUID = viewport.displaySetInstanceUIDs[0];

      const segmentation = segmentations[0];
      const segmentationId = segmentation.segmentationId;
      const label = segmentation.config.label;
      const segments = segmentation.config.segments;

      const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);

      await segmentationService.createLabelmapForDisplaySet(displaySet, {
        segmentationId,
        segments,
        label,
      });

      segmentationService.addOrUpdateSegmentation(segmentation);

      await segmentationService.addSegmentationRepresentation(viewport.viewportId, {
        segmentationId,
      });

      return segmentationId;
    },
    /**
     * Generates a segmentation from a given segmentation ID.
     * This function retrieves the associated segmentation and
     * its referenced volume, extracts label maps from the
     * segmentation volume, and produces segmentation data
     * alongside associated metadata.
     *
     * @param {Object} params - Parameters for the function.
     * @param params.segmentationId - ID of the segmentation to be generated.
     * @param params.options - Optional configuration for the generation process.
     *
     * @returns Returns the generated segmentation data.
     */
    generateSegmentation: ({ segmentationId, options = {} }) => {
      const segmentation = cornerstoneToolsSegmentation.state.getSegmentation(segmentationId);

      // Access labelmap imageIds with a type cast to avoid TS complaints in the custom codebase
      const imageIds: string[] = (segmentation.representationData as any).Labelmap.imageIds;

      // Fetch the cached images; filter out any undefined (not yet in cache)
      const segImages = imageIds
        .map(imageId => cache.getImage(imageId))
        .filter(Boolean);

      if (!segImages.length) {
        throw new Error(
          'Segmentation image cache is empty – please wait for images to load or try reloading the study.'
        );
      }

      const referencedImages = segImages
        .map(img => (img ? cache.getImage((img as any).referencedImageId) : undefined))
        .filter(Boolean);

      if (!referencedImages.length) {
        throw new Error('Referenced source images are missing in the cache.');
      }

      const labelmaps2D = [];

      let z = 0;

      for (const segImage of segImages) {
        const segmentsOnLabelmap = new Set();
        const pixelData = segImage.getPixelData();
        const { rows, columns } = segImage;

        // Use a single pass through the pixel data
        for (let i = 0; i < pixelData.length; i++) {
          const segment = pixelData[i];
          if (segment !== 0) {
            segmentsOnLabelmap.add(segment);
          }
        }

        labelmaps2D[z++] = {
          segmentsOnLabelmap: Array.from(segmentsOnLabelmap),
          pixelData,
          rows,
          columns,
        };
      }

      const allSegmentsOnLabelmap = labelmaps2D.map(labelmap => labelmap.segmentsOnLabelmap);

      // Guard: ensure there is at least one labeled pixel before attempting
      // to generate a DICOM-SEG. When the labelmaps contain no non-zero
      // pixels, the downstream adapter will throw an unclear
      // "setNumberOfFrames()" error. Detecting it early allows us to return
      // a more meaningful message and avoid the crash.
      const hasLabeledPixels = labelmaps2D.some(lm =>
        Array.isArray(lm?.segmentsOnLabelmap) && lm.segmentsOnLabelmap.some(idx => idx !== 0)
      );

      if (!hasLabeledPixels) {
        throw new Error(
          'Segmentation has no labelled pixels – nothing to save. Please add a segmentation before saving.'
        );
      }

      const labelmap3D = {
        segmentsOnLabelmap: Array.from(new Set(allSegmentsOnLabelmap.flat())),
        metadata: [],
        labelmaps2D,
      };

      const segmentationInOHIF = segmentationService.getSegmentation(segmentationId);
      const representations = segmentationService.getRepresentationsForSegmentation(segmentationId);

      Object.entries(segmentationInOHIF.segments).forEach(([segmentIndex, segment]) => {
        // segmentation service already has a color for each segment
        if (!segment) {
          return;
        }

        const { label } = segment;

        const firstRepresentation = representations[0];
        const color = segmentationService.getSegmentColor(
          firstRepresentation.viewportId,
          segmentationId,
          segment.segmentIndex
        );

        const RecommendedDisplayCIELabValue = dcmjs.data.Colors.rgb2DICOMLAB(
          color.slice(0, 3).map(value => value / 255)
        ).map(value => Math.round(value));

        const segmentMetadata = {
          SegmentNumber: segmentIndex.toString(),
          SegmentLabel: label,
          SegmentAlgorithmType: (segment as any)?.algorithmType || 'MANUAL',
          SegmentAlgorithmName: (segment as any)?.algorithmName || 'OHIF Brush',
          RecommendedDisplayCIELabValue,
          SegmentedPropertyCategoryCodeSequence: {
            CodeValue: 'T-D0050',
            CodingSchemeDesignator: 'SRT',
            CodeMeaning: 'Tissue',
          },
          SegmentedPropertyTypeCodeSequence: {
            CodeValue: 'T-D0050',
            CodingSchemeDesignator: 'SRT',
            CodeMeaning: 'Tissue',
          },
        };
        labelmap3D.metadata[segmentIndex] = segmentMetadata;
      });

      const generatedSegmentation = generateSegmentation(
        referencedImages,
        labelmap3D,
        metaData,
        options
      );

      return generatedSegmentation;
    },
    /**
     * Downloads a segmentation based on the provided segmentation ID.
     * This function retrieves the associated segmentation and
     * uses it to generate the corresponding DICOM dataset, which
     * is then downloaded with an appropriate filename.
     *
     * @param {Object} params - Parameters for the function.
     * @param params.segmentationId - ID of the segmentation to be downloaded.
     *
     */
    downloadSegmentation: ({ segmentationId }) => {
      const segmentationInOHIF = segmentationService.getSegmentation(segmentationId);
      const generatedSegmentation = actions.generateSegmentation({
        segmentationId,
      });

      downloadDICOMData(generatedSegmentation.dataset, `${segmentationInOHIF.label}`);
    },
    /**
     * Stores a segmentation based on the provided segmentationId into a specified data source.
     * The SeriesDescription is derived from user input or defaults to the segmentation label,
     * and in its absence, defaults to 'Research Derived Series'.
     *
     * @param {Object} params - Parameters for the function.
     * @param params.segmentationId - ID of the segmentation to be stored.
     * @param params.dataSource - Data source where the generated segmentation will be stored.
     *
     * @returns {Object|void} Returns the naturalized report if successfully stored,
     * otherwise throws an error.
     */
    storeSegmentation: async ({ segmentationId, dataSource, SeriesDescription: SeriesDescriptionParam }) => {
      // Ask user for SeriesDescription (segmentation name)
      let SeriesDescription = SeriesDescriptionParam;
      if (!SeriesDescription) {
        // Use OHIF's built-in dialog prompt
        const promptResult = await createReportDialogPrompt(uiDialogService, {
          extensionManager,
          title: 'Save Segmentation',
          message: 'Enter a name for this segmentation series:',
          defaultValue: 'MySeg'
        });

        if (promptResult.action !== 1 || !promptResult.value) {
          uiNotificationService.show({
            title: 'Save Segmentation',
            message: 'Save cancelled – no name provided',
            type: 'info',
          });
          return;
        }
        
        SeriesDescription = promptResult.value;
      }

      const segmentation = segmentationService.getSegmentation(segmentationId);

      if (!segmentation) {
        throw new Error('No segmentation found');
      }

      let generatedData: any;
      try {
        generatedData = actions.generateSegmentation({
          segmentationId,
          options: {
            SeriesDescription,
          },
        });
      } catch (error) {
        // Present a user-friendly message and abort the store operation
        const message =
          error?.message || 'Failed to generate DICOM-SEG for the current segmentation.';

        uiNotificationService.show({
          title: 'Save Segmentation',
          message,
          type: 'error',
        });
        console.error('storeSegmentation:', error);
        return;
      }

      if (!generatedData || !generatedData.dataset) {
        throw new Error('Error during segmentation generation');
      }

      const { dataset: naturalizedReport } = generatedData;

      await dataSource.store.dicom(naturalizedReport);

      // Inform the user that the segmentation has been successfully stored
      uiNotificationService.show({
        title: 'Save Segmentation',
        message: `Segmentation "${SeriesDescription}" saved successfully`,
        type: 'success',
      });

      // The "Mode" route listens for DicomMetadataStore changes
      // When a new instance is added, it listens and
      // automatically calls makeDisplaySets

      // add the information for where we stored it to the instance as well
      naturalizedReport.wadoRoot = dataSource.getConfig().wadoRoot;

      DicomMetadataStore.addInstances([naturalizedReport], true);

      return naturalizedReport;
    },
    /**
     * Converts segmentations into RTSS for download.
     * This sample function retrieves all segentations and passes to
     * cornerstone tool adapter to convert to DICOM RTSS format. It then
     * converts dataset to downloadable blob.
     *
     */
    downloadRTSS: ({ segmentationId }) => {
      const segmentations = segmentationService.getSegmentation(segmentationId);
      const vtkUtils = {
        vtkImageMarchingSquares,
        vtkDataArray,
        vtkImageData,
      };

      const RTSS = generateRTSSFromSegmentations(
        segmentations,
        classes.MetadataProvider,
        DicomMetadataStore,
        cache,
        cornerstoneToolsEnums,
        vtkUtils
      );

      try {
        const reportBlob = datasetToBlob(RTSS);

        //Create a URL for the binary.
        const objectUrl = URL.createObjectURL(reportBlob);
        window.location.assign(objectUrl);
      } catch (e) {
        console.warn(e);
      }
    },
    setBrushSize: ({ value, toolNames }) => {
      const brushSize = Number(value);

      toolGroupService.getToolGroupIds()?.forEach(toolGroupId => {
        if (toolNames?.length === 0) {
          segmentationUtils.setBrushSizeForToolGroup(toolGroupId, brushSize);
        } else {
          toolNames?.forEach(toolName => {
            segmentationUtils.setBrushSizeForToolGroup(toolGroupId, brushSize, toolName);
          });
        }
      });
    },
    setThresholdRange: ({
      value,
      toolNames = ['ThresholdCircularBrush', 'ThresholdSphereBrush'],
    }) => {
      toolGroupService.getToolGroupIds()?.forEach(toolGroupId => {
        const toolGroup = toolGroupService.getToolGroup(toolGroupId) as any;
        toolNames?.forEach(toolName => {
          toolGroup.setToolConfiguration(toolName, {
            strategySpecificConfiguration: {
              THRESHOLD: {
                threshold: value,
              },
            },
          });
        });
      });
    },
    loadSegmentationDisplaySetsForViewport: async ({
      displaySetInstanceUID,
      viewportId,
    }: {
      displaySetInstanceUID: string | string[];
      viewportId?: string;
    }) => {
      const targetViewportId = viewportId || viewportGridService.getState().activeViewportId;
      const dsUIDs = Array.isArray(displaySetInstanceUID)
        ? displaySetInstanceUID
        : [displaySetInstanceUID];

      const segmentationIds: string[] = [];

      for (const dsUID of dsUIDs) {
        const segDisplaySet = displaySetService.getDisplaySetByUID(dsUID);
        if (!segDisplaySet) {
          console.warn(`SEG display set ${dsUID} not found`);
          continue;
        }

        // Ensure the SEG display set is parsed and populated
        try {
          if (typeof segDisplaySet.load === 'function' && !segDisplaySet.isLoaded) {
            await segDisplaySet.load({});
          }
        } catch (loadErr) {
          console.warn('Failed to load/parse SEG before creating segmentation', dsUID, loadErr);
          continue;
        }

        // Basic validation – only proceed if load produced voxel data
        if (!segDisplaySet.labelmapBufferArray || !segDisplaySet.centroids) {
          console.warn('SEG display set appears incomplete after load – skipping', dsUID);
          continue;
        }

        try {
          const segmentationId = await segmentationService.createSegmentationForSEGDisplaySet(
            segDisplaySet,
            {
              type: cornerstoneToolsEnums.SegmentationRepresentations.Labelmap,
            }
          );
          await segmentationService.addSegmentationRepresentation(targetViewportId, {
            segmentationId,
            type: cornerstoneToolsEnums.SegmentationRepresentations.Labelmap,
          });

          // ensure visibility
          segmentationService.setActiveSegmentation(targetViewportId, segmentationId);

          // Auto-center viewport on the first segment so user immediately sees label
          try {
            const seg = segmentationService.getSegmentation(segmentationId);
            const firstSegmentIndex = Object.keys(seg.segments)[0];
            if (firstSegmentIndex) {
              segmentationService.jumpToSegmentCenter(segmentationId, Number(firstSegmentIndex), targetViewportId);
            }
          } catch (centerErr) {
            console.warn('Could not jump to segment center', centerErr);
          }

          segmentationIds.push(segmentationId);
        } catch (err) {
          console.warn('Failed to load SEG display set', dsUID, err);
        }
      }

      return segmentationIds;
    },
  };

  const definitions = {
    /**
     * Obsolete?
     */
    loadSegmentationDisplaySetsForViewport: {
      commandFn: actions.loadSegmentationDisplaySetsForViewport,
    },
    /**
     * Obsolete?
     */
    loadSegmentationsForViewport: {
      commandFn: actions.loadSegmentationsForViewport,
    },

    generateSegmentation: {
      commandFn: actions.generateSegmentation,
    },
    downloadSegmentation: {
      commandFn: actions.downloadSegmentation,
    },
    storeSegmentation: {
      commandFn: actions.storeSegmentation,
    },
    downloadRTSS: {
      commandFn: actions.downloadRTSS,
    },
    setBrushSize: {
      commandFn: actions.setBrushSize,
    },
    setThresholdRange: {
      commandFn: actions.setThresholdRange,
    },
  };

  return {
    actions,
    definitions,
    defaultContext: 'SEGMENTATION',
  };
};

export default commandsModule;
