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
import { classes, DicomMetadataStore, utils } from '@ohif/core';

import vtkImageMarchingSquares from '@kitware/vtk.js/Filters/General/ImageMarchingSquares';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import supabaseClient from '../../../my-extensions/dicom-seg/src/utils/supabase';

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

      // Check and preserve orientation information from the first referenced image
      const firstReferencedImage = referencedImages[0];
      const referenceMetadata = firstReferencedImage?.data?.metadata;
      
      console.log('🔍 Reference Image Orientation Debug:', {
        hasMetadata: !!referenceMetadata,
        imageOrientationPatient: referenceMetadata?.ImageOrientationPatient,
        imagePositionPatient: referenceMetadata?.ImagePositionPatient,
        pixelSpacing: referenceMetadata?.PixelSpacing,
        sliceThickness: referenceMetadata?.SliceThickness,
        frameOfReferenceUID: referenceMetadata?.FrameOfReferenceUID,
        segmentationId,
        numSegImages: segImages.length,
        numReferencedImages: referencedImages.length
      });

      // -------------------------------------------------------------------
      // Build labelmaps2D theo order của referencedImages (đúng slice index)
      // -------------------------------------------------------------------
      const refIdToIdx: Record<string, number> = {};
      referencedImages.forEach((img, i) => {
        const id = (img as any).imageId || (img as any).SOPInstanceUID || `${i}`;
        refIdToIdx[id] = i;
      });

      const labelmapsWithOrder: { idx: number; lm: any }[] = [];

      for (const segImage of segImages) {
        const pixelData = segImage.getPixelData();
        const { rows, columns } = segImage;
        const segmentsOnLabelmap = new Set<number>();
        for (let i = 0; i < pixelData.length; i++) {
          const v = pixelData[i];
          if (v) segmentsOnLabelmap.add(v);
        }

        // Determine slice index from referenced image id
        const refId = (segImage as any).referencedImageId || (segImage as any).SOPInstanceUID;
        const sliceIdx = refIdToIdx[refId] ?? labelmapsWithOrder.length;

        labelmapsWithOrder.push({
          idx: sliceIdx,
          lm: {
            segmentsOnLabelmap: Array.from(segmentsOnLabelmap),
            pixelData,
            rows,
            columns,
          },
        });
      }

      // sort by original slice index
      labelmapsWithOrder.sort((a, b) => a.idx - b.idx);

      let labelmaps2D = labelmapsWithOrder.map(it => it.lm);

      // -------------------------------------------------------------------
      // COMPREHENSIVE SLICE ORDER CORRECTION FOR ALL ORIENTATIONS
      // -------------------------------------------------------------------
      
      console.log('🔍 Analyzing slice order for segmentation:', {
        segmentationId,
        totalSlices: labelmaps2D.length,
        hasSegments: Object.keys(segmentation.segments).length
      });

      // Apply slice order correction for all segmentations with sufficient slices
      if (labelmaps2D.length > 5) {
        // Get reference image metadata to determine orientation
        const firstRefImage = referencedImages[0];
        const refMetadata = metaData.get('instance', firstRefImage.imageId || firstRefImage);
        
        let shouldReverse = false;
        let correctionReason = '';
        
        if (refMetadata?.ImageOrientationPatient) {
          const orientation = refMetadata.ImageOrientationPatient;
          
          // Check if this is axial orientation (most common case with slice order issues)
          const isAxial = Math.abs(orientation[4]) > 0.9; // Y component of row direction
          const isCoronal = Math.abs(orientation[5]) > 0.9; // Z component of row direction  
          const isSagittal = Math.abs(orientation[2]) > 0.9; // Z component of column direction
          
          console.log('🧭 Detected orientation:', {
            orientation,
            isAxial,
            isCoronal, 
            isSagittal,
            imagePosition: refMetadata.ImagePositionPatient
          });
          
          // For axial images, check if slices are ordered incorrectly
          if (isAxial && refMetadata.ImagePositionPatient) {
            const firstSliceZ = refMetadata.ImagePositionPatient[2];
            const lastRefImage = referencedImages[referencedImages.length - 1];
            const lastMetadata = metaData.get('instance', lastRefImage.imageId || lastRefImage);
            
            if (lastMetadata?.ImagePositionPatient) {
              const lastSliceZ = lastMetadata.ImagePositionPatient[2];
              
              // If first slice has higher Z than last slice, slices are likely reversed
              if (firstSliceZ > lastSliceZ) {
                shouldReverse = true;
                correctionReason = 'Axial slices ordered from superior to inferior (should be inferior to superior)';
              }
            }
          }
          
          // Additional check: analyze label distribution regardless of orientation
          const totalSlices = labelmaps2D.length;
          const firstQuarter = labelmaps2D.slice(0, Math.floor(totalSlices / 4));
          const lastQuarter = labelmaps2D.slice(Math.floor(totalSlices * 3/4));
          
          // Count labeled pixels in first and last quarters
          const firstQuarterLabels = firstQuarter.reduce((sum, lm) => 
            sum + lm.segmentsOnLabelmap.filter(x => x > 0).length, 0);
          const lastQuarterLabels = lastQuarter.reduce((sum, lm) => 
            sum + lm.segmentsOnLabelmap.filter(x => x > 0).length, 0);
          
          const totalLabeledPixels = firstQuarterLabels + lastQuarterLabels;
          const imbalanceRatio = lastQuarterLabels > 0 ? firstQuarterLabels / lastQuarterLabels : 
                                firstQuarterLabels > 0 ? 999 : 1;
          
          console.log('📊 Label distribution analysis:', {
            totalSlices,
            firstQuarterLabels,
            lastQuarterLabels,
            totalLabeledPixels,
            imbalanceRatio
          });
          
          // If there's significant imbalance, likely the slices are reversed
          if (imbalanceRatio > 2.0 && totalLabeledPixels > 3) {
            shouldReverse = true;
            correctionReason = `Label distribution imbalance (ratio: ${imbalanceRatio.toFixed(2)})`;
          }
        }
        
        // Apply reversal if needed
        if (shouldReverse) {
          console.log('🔄 Reversing slice order:', correctionReason);
          labelmaps2D = labelmaps2D.reverse();
          
          console.log('✅ Applied slice order correction');
        } else {
          console.log('✅ Slice order appears correct (no correction needed)');
        }
      } else {
        console.log('ℹ️ Too few slices for slice order analysis');
      }

      // -------------------------------------------------------------------
      // END slice-order correction
      // -------------------------------------------------------------------

      // Guard ensure labeled pixels
      const allSegmentsOnLabelmap = labelmaps2D.map(lm => lm.segmentsOnLabelmap);
      const hasLabeledPixels = labelmaps2D.some(lm => lm.segmentsOnLabelmap.some(x => x));
      if (!hasLabeledPixels) {
        throw new Error('Segmentation has no labelled pixels – nothing to save.');
      }

      const labelmap3D = {
        segmentsOnLabelmap: Array.from(new Set(allSegmentsOnLabelmap.flat())),
        metadata: [],
        labelmaps2D,
      };

      const representations = segmentationService.getRepresentationsForSegmentation(segmentationId);

      Object.entries(segmentation.segments).forEach(([segmentIndexStr, segment]) => {
        const segmentIndex = Number(segmentIndexStr);
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

      // Enhanced options with orientation preservation
      const enhancedOptions = {
        ...options,
        // Keep original options structure for compatibility
        // preserveOrientation: true,
        // coordinateSystem: 'LPS', // DICOM standard
        
        // Add orientation validation and correction
        validateOrientation: true,
        preserveImageOrientation: true,
        
        // Ensure proper slice ordering
        maintainSliceOrder: true,
      };

      console.log('🔧 Generating segmentation with enhanced options:', enhancedOptions);

      const generatedSegmentation = generateSegmentation(
        referencedImages,
        labelmap3D,
        metaData,
        enhancedOptions
      );

      // Enhanced validation and correction of generated segmentation orientation
      if (generatedSegmentation?.dataset && referenceMetadata) {
        console.log('🔧 Applying comprehensive orientation preservation...');
        
        // Critical orientation fields - always copy from reference
        const orientationFields = [
          'ImageOrientationPatient',
          'ImagePositionPatient', 
          'PixelSpacing',
          'SliceThickness',
          'SpacingBetweenSlices',
          'FrameOfReferenceUID',
          'SliceLocation',
          'ImageType',
          'PatientPosition',
          'PatientOrientation'
        ];
        
        let appliedFields = [];
        
        orientationFields.forEach(field => {
          if (referenceMetadata[field] !== undefined) {
            // Always override with reference metadata for consistency
            generatedSegmentation.dataset[field] = referenceMetadata[field];
            appliedFields.push(field);
          }
        });
        
        // Ensure proper coordinate system consistency
        if (referenceMetadata.ImageOrientationPatient) {
          // Validate and normalize orientation vectors
          const orientation = referenceMetadata.ImageOrientationPatient;
          if (Array.isArray(orientation) && orientation.length === 6) {
            generatedSegmentation.dataset.ImageOrientationPatient = orientation.map(v => parseFloat(v));
          }
        }
        
        console.log('✅ Applied orientation preservation:', {
          appliedFields,
          totalFieldsApplied: appliedFields.length,
          hasImageOrientationPatient: !!generatedSegmentation.dataset.ImageOrientationPatient,
          hasImagePositionPatient: !!generatedSegmentation.dataset.ImagePositionPatient,
          hasFrameOfReferenceUID: !!generatedSegmentation.dataset.FrameOfReferenceUID
        });
      } else {
        console.warn('⚠️ Cannot apply orientation preservation - missing dataset or reference metadata');
      }
      
      console.log('✅ Final generated segmentation dataset summary:', {
        hasImageOrientationPatient: !!generatedSegmentation?.dataset?.ImageOrientationPatient,
        hasImagePositionPatient: !!generatedSegmentation?.dataset?.ImagePositionPatient,
        hasPixelSpacing: !!generatedSegmentation?.dataset?.PixelSpacing,
        hasSliceThickness: !!generatedSegmentation?.dataset?.SliceThickness,
        hasFrameOfReferenceUID: !!generatedSegmentation?.dataset?.FrameOfReferenceUID,
        seriesDescription: generatedSegmentation?.dataset?.SeriesDescription
      });

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
      let savingNotificationId = null;
      
      try {
        console.log('🔍 Starting segmentation store process:', { segmentationId, dataSource: !!dataSource });

        // ✅ CHECK ROLE PERMISSION FIRST - Only annotators can save
        console.log('🔐 Checking user role permission before saving...');
        
        // Get current user
        const { data: userData } = await supabaseClient.auth.getUser();
        const userId = userData?.user?.id;
        
        if (!userId) {
          console.error('❌ No authenticated user found');
          uiNotificationService.show({
            title: 'Authentication Required',
            message: 'Please log in to save segmentations',
            type: 'error',
            duration: 5000,
          });
          return;
        }

        try {
          // Get user profile from _users table
          const { data: userProfile } = await supabaseClient
            .from('_users')
            .select('full_name')
            .eq('id', userId)
            .single();

          const displayName = userProfile?.full_name || 'User';

          // Get user role using task assignment chain (like in ViewerHeader.tsx)
          const urlParams = new URLSearchParams(window.location.search);
          const taskId = urlParams.get('taskId');
          
          let userRole = 'Medical Professional'; // Default role
          
          if (taskId) {
            try {
              console.log(`🔍 Getting role for user ${userId} via task assignment ${taskId}`);
              
              // Step 1: Get task_id from _task_assignments
              const { data: taskAssignmentData } = await supabaseClient
                .from('_task_assignments')
                .select('task_id')
                .eq('id', taskId)
                .single();
              
              if (taskAssignmentData?.task_id) {
                // Step 2: Get project_id from _tasks
                const { data: taskData } = await supabaseClient
                  .from('_tasks')
                  .select('project_id')
                  .eq('id', taskAssignmentData.task_id)
                  .single();
                
                if (taskData?.project_id) {
                  // Step 3: Get role from _project_members and _roles
                  const { data: memberData } = await supabaseClient
                    .from('_project_members')
                    .select(`
                      role_id,
                      _roles!_project_members_role_id_fkey (
                        name,
                        description
                      )
                    `)
                    .eq('project_id', taskData.project_id)
                    .eq('user_id', userId)
                    .single();
                  
                  if (memberData?._roles) {
                    const roleData = Array.isArray(memberData._roles) ? memberData._roles[0] : memberData._roles;
                    userRole = roleData?.name || 'Medical Professional';
                    console.log(`✅ Found role for user ${userId}: ${userRole}`);
                  }
                }
              }
            } catch (roleError) {
              console.log('⚠️ Could not determine user role, using default');
            }
          }

          // Check if user has annotator role
          if (userRole.toLowerCase() !== 'annotator') {
            console.error('❌ Permission denied - user role:', userRole);
            
                                     // Show concise permission denied notification
            uiNotificationService.show({
              title: '🚫 Save Permission Denied',
              message: `Only "Annotator" role can save segmentations.
                        Current User: ${displayName}
                        Role: ${userRole}
                        Please contact admin to update your role permissions.`,
              type: 'error',
              duration: 6000,
            });
            
            // Return early - do not proceed with segmentation save
            return;
          }

          console.log('✅ Role permission check passed - annotator can save');
          
        } catch (roleCheckError) {
          console.error('❌ Role permission check error:', roleCheckError);
          
          uiNotificationService.show({
            title: 'Permission Verification Failed',
            message: `Cannot verify user role: ${roleCheckError.message}`,
            type: 'error',
            duration: 5000,
          });
          
          // Return early - do not proceed with segmentation save
          return;
        }

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

        // Show "Saving..." notification
        savingNotificationId = uiNotificationService.show({
          title: 'Save Segmentation',
          message: `Saving "${SeriesDescription}"...`,
          type: 'info',
          duration: 0, // Don't auto-dismiss
        });

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
              // Add metadata to ensure proper loading
              includeSliceSpacing: true,
              rleEncode: false, // Disable RLE encoding for better compatibility
            },
          });
        } catch (error) {
          // Present a user-friendly message and abort the store operation
          const message =
            error?.message || 'Failed to generate DICOM-SEG for the current segmentation.';

          console.error('❌ Error generating segmentation:', error);
          
          // Dismiss saving notification
          if (savingNotificationId) {
            uiNotificationService.hide(savingNotificationId);
          }
          
          uiNotificationService.show({
            title: 'Save Segmentation',
            message,
            type: 'error',
          });
          return;
        }

        if (!generatedData || !generatedData.dataset) {
          throw new Error('Error during segmentation generation - no dataset produced');
        }

        const { dataset: naturalizedReport } = generatedData;

        // Add additional metadata for better compatibility
        naturalizedReport.SeriesDescription = SeriesDescription;
        
        // Preserve orientation and position metadata from reference series
        let orientationMetadata = null;
        
        if (segmentation && segmentation.representationData && segmentation.representationData.LABELMAP) {
          const labelmapData = segmentation.representationData.LABELMAP;
          
          // Try multiple ways to get orientation metadata
          if (labelmapData.referencedImageIds && labelmapData.referencedImageIds.length > 0) {
            // Method 1: Get from first referenced image
            const firstImageId = labelmapData.referencedImageIds[0];
            const imageMetadata = metaData.get('instance', firstImageId);
            
            if (imageMetadata) {
              orientationMetadata = imageMetadata;
              console.log('📍 Got orientation from referenced image metadata');
            }
          }
          
          // Method 2: Get from referenced volume if available
          if (!orientationMetadata && labelmapData.referencedVolumeId) {
            const volume = cache.getVolume(labelmapData.referencedVolumeId);
            if (volume && volume.imageIds && volume.imageIds.length > 0) {
              const volumeImageMetadata = metaData.get('instance', volume.imageIds[0]);
              if (volumeImageMetadata) {
                orientationMetadata = volumeImageMetadata;
                console.log('📍 Got orientation from volume metadata');
              }
            }
          }
          
          // Method 3: Get from display set if available
          if (!orientationMetadata) {
            const { displaySetService } = servicesManager.services;
            const activeDisplaySets = displaySetService.getActiveDisplaySets();
            const ctDisplaySet = activeDisplaySets.find(ds => ds.Modality === 'CT' || ds.Modality === 'MR');
            
            if (ctDisplaySet && ctDisplaySet.instances && ctDisplaySet.instances.length > 0) {
              orientationMetadata = ctDisplaySet.instances[0];
              console.log('📍 Got orientation from CT/MR display set');
            }
          }
          
          // Apply orientation metadata if found
          if (orientationMetadata) {
            // Preserve critical orientation metadata
            if (orientationMetadata.ImageOrientationPatient) {
              naturalizedReport.ImageOrientationPatient = orientationMetadata.ImageOrientationPatient;
            }
            if (orientationMetadata.ImagePositionPatient) {
              naturalizedReport.ImagePositionPatient = orientationMetadata.ImagePositionPatient;
            }
            if (orientationMetadata.PixelSpacing) {
              naturalizedReport.PixelSpacing = orientationMetadata.PixelSpacing;
            }
            if (orientationMetadata.SliceThickness) {
              naturalizedReport.SliceThickness = orientationMetadata.SliceThickness;
            }
            if (orientationMetadata.SpacingBetweenSlices) {
              naturalizedReport.SpacingBetweenSlices = orientationMetadata.SpacingBetweenSlices;
            }
            if (orientationMetadata.FrameOfReferenceUID) {
              naturalizedReport.FrameOfReferenceUID = orientationMetadata.FrameOfReferenceUID;
            }
            
            // Additional DICOM metadata for proper orientation
            if (orientationMetadata.SliceLocation !== undefined) {
              naturalizedReport.SliceLocation = orientationMetadata.SliceLocation;
            }
            if (orientationMetadata.ImageType) {
              naturalizedReport.ImageType = orientationMetadata.ImageType;
            }
            if (orientationMetadata.PatientPosition) {
              naturalizedReport.PatientPosition = orientationMetadata.PatientPosition;
            }
            
            console.log('✅ Preserved orientation metadata from reference:', {
              ImageOrientationPatient: naturalizedReport.ImageOrientationPatient,
              ImagePositionPatient: naturalizedReport.ImagePositionPatient,
              FrameOfReferenceUID: naturalizedReport.FrameOfReferenceUID,
              SliceLocation: naturalizedReport.SliceLocation,
              PatientPosition: naturalizedReport.PatientPosition,
              source: 'enhanced_detection'
            });
          } else {
            console.warn('⚠️ Could not find orientation metadata from any source');
          }
        }
        
        // Auto-generate incremental series number for SEG
        // Get only valid SEG display sets that are actually loaded and not deleted
        let existingDisplaySets = displaySetService.getActiveDisplaySets();
        
        // Clean up any invalid display sets before calculating series numbers
        try {
          const invalidDisplaySets = [];
          
          existingDisplaySets.forEach(ds => {
            if (ds.Modality === 'SEG') {
              // Only remove if it's clearly broken
              const isDefinitelyInvalid = (
                (!ds.instances || ds.instances.length === 0) &&
                (!ds.sopClassUIDs || ds.sopClassUIDs.length === 0) &&
                !ds.SeriesInstanceUID
              );
              
              if (isDefinitelyInvalid) {
                invalidDisplaySets.push(ds.displaySetInstanceUID);
              }
            }
          });
          
          // Remove invalid display sets
          invalidDisplaySets.forEach(displaySetInstanceUID => {
            try {
              displaySetService.deleteDisplaySet(displaySetInstanceUID);
            } catch (deleteError) {
              // Silent cleanup
            }
          });
          
          // Refresh the list after cleanup
          if (invalidDisplaySets.length > 0) {
            existingDisplaySets = displaySetService.getActiveDisplaySets();
          }
          
        } catch (cleanupError) {
          // Silent cleanup error handling
        }
        
        const validSegDisplaySets = existingDisplaySets.filter(ds => {
          // Only include SEG modality
          if (ds.Modality !== 'SEG') return false;
          
          // Must have SeriesInstanceUID (basic requirement)
          if (!ds.SeriesInstanceUID) return false;
          
          // Check if it's from the same study (avoid counting SEGs from other studies)
          if (ds.StudyInstanceUID !== naturalizedReport.StudyInstanceUID) return false;
          
          // Must have a valid series number
          if (!ds.SeriesNumber || isNaN(parseInt(ds.SeriesNumber))) return false;
          
          // Be more lenient with other validations
          
          return true;
        });
        
        // Log only essential info
        console.log('📊 SEG series calculation:', {
          validSEGs: validSegDisplaySets.length,
          seriesNumbers: validSegDisplaySets.map(ds => ds.SeriesNumber)
        });
        
        // Get the highest series number from valid SEGs only
        const existingSeriesNumbers = validSegDisplaySets
          .map(ds => parseInt(ds.SeriesNumber) || 0)
          .filter(num => num >= 1000); // Only consider our auto-generated series numbers
        
        // Use display set data for series numbers
        let verifiedSeriesNumbers = existingSeriesNumbers;
          
        const maxSeriesNumber = verifiedSeriesNumbers.length > 0 
          ? Math.max(...verifiedSeriesNumbers)
          : 1000; // Start from 1000 if no valid SEG series found
          
        const newSeriesNumber = maxSeriesNumber + 1;
        
        console.log('📊 New SEG series number:', newSeriesNumber);
        
        naturalizedReport.SeriesNumber = newSeriesNumber.toString();
        
        // Ensure proper SOP Class UID for SEG
        naturalizedReport.SOPClassUID = '1.2.840.10008.5.1.4.1.1.66.4';
        
        // Add creation timestamp
        const now = new Date();
        naturalizedReport.SeriesDate = now.toISOString().slice(0, 10).replace(/-/g, '');
        naturalizedReport.SeriesTime = now.toTimeString().slice(0, 8).replace(/:/g, '');
        
        // Add high precision timestamp for better sorting
        const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
        naturalizedReport.SeriesTime = naturalizedReport.SeriesTime + '.' + milliseconds;
        
        await dataSource.store.dicom(naturalizedReport);

        // Dismiss saving notification
        if (savingNotificationId) {
          uiNotificationService.hide(savingNotificationId);
        }

        // Show success notification
        uiNotificationService.show({
          title: 'Save Segmentation',
          message: `Segmentation "${SeriesDescription}" saved successfully`,
          type: 'success',
        });

        // Call workflow_annotate_submit for label assignment
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const taskId = urlParams.get('taskId'); // This is task_assignment_id
          const seriesInstanceUID = naturalizedReport.SeriesInstanceUID;
          
          // Get current user
          const { data: userData } = await supabaseClient.auth.getUser();
          const authorId = userData?.user?.id;
          
          console.log('🔄 Calling workflow_annotate_submit for label assignment:', {
            taskId,
            seriesInstanceUID,
            authorId: !!authorId,
            seriesDescription: SeriesDescription
          });
          
          if (taskId && authorId && seriesInstanceUID) {
            // Call the workflow function from public_v2 schema
            const { data: workflowData, error: workflowError } = await supabaseClient
              .rpc('workflow_annotate_submit', {
                task_assignment_id: taskId,
                segmentation_id: seriesInstanceUID  // SeriesInstanceUID is the segmentation_id
              }, {
                schema: 'public_v2'
              });
            
            if (workflowError) {
              console.error('❌ Workflow function failed ohif:', workflowError);
              uiNotificationService.show({
                title: 'Label Assignment Failed',
                message: `Segmentation saved but workflow failed: ${workflowError.message}`,
                type: 'warning',
                duration: 4000,
              });
            } else {
              console.log('✅ Workflow function completed successfully:', workflowData);
              uiNotificationService.show({
                title: 'Label Saved Successfully',
                message: `Label "${SeriesDescription}" assigned and saved successfully! 🎉`,
                type: 'success',
                duration: 3000,
              });
            }
          } else {
            console.warn('⚠️ Missing required parameters for workflow save:', {
              taskId: !!taskId,
              authorId: !!authorId,
              seriesInstanceUID: !!seriesInstanceUID
            });
            
            uiNotificationService.show({
              title: 'Segmentation Saved',
              message: 'Segmentation saved to Orthanc (label assignment skipped)',
              type: 'info',
              duration: 2500,
            });
          }
        } catch (error) {
          console.error('❌ Label assignment process failed:', error);
          // Don't throw - DICOM save was successful
          uiNotificationService.show({
            title: 'Label Assignment Error',
            message: `Segmentation saved but label assignment failed: ${error.message || 'Unknown error'}`,
            type: 'error',
            duration: 4000,
          });
        }

        // The "Mode" route listens for DicomMetadataStore changes
        // When a new instance is added, it listens and
        // automatically calls makeDisplaySets

        // add the information for where we stored it to the instance as well
        naturalizedReport.wadoRoot = dataSource.getConfig().wadoRoot;

        DicomMetadataStore.addInstances([naturalizedReport], true);
        
        // Immediately trigger display sets update to show new SEG in series list
        try {
          // Create display set for the new SEG immediately
          const newDisplaySets = displaySetService.makeDisplaySets([naturalizedReport], {
            madeInClient: true,
            batch: false
          });
          
          if (newDisplaySets && newDisplaySets.length > 0) {
            console.log('✅ SEG added to series list');
          }
          
        } catch (immediateUpdateError) {
          // Silent error handling
        }
        
        // Background refresh to ensure UI stays updated
        setTimeout(async () => {
          try {
            const currentDisplaySets = displaySetService.getActiveDisplaySets();
            displaySetService._broadcastEvent('DISPLAY_SETS_CHANGED', currentDisplaySets);
          } catch (error) {
            // Silent background refresh
          }
        }, 1000);
        
        return naturalizedReport;
      } catch (error) {
        console.error('❌ Global error in storeSegmentation:', error);
        
        // Dismiss saving notification if it exists
        if (savingNotificationId) {
          uiNotificationService.hide(savingNotificationId);
        }
        
        uiNotificationService.show({
          title: 'Save Error',
          message: `Failed to save segmentation: ${error.message || 'Unknown error'}`,
          type: 'error',
        });
        
        throw error;
      }
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
        try {
          console.log('🔍 Starting to load SEG display set:', dsUID);
          
          const segDisplaySet = displaySetService.getDisplaySetByUID(dsUID);
          if (!segDisplaySet) {
            console.warn(`❌ SEG display set ${dsUID} not found`);
            
            // Show user-friendly error notification
            uiNotificationService.show({
              title: 'Load Segmentation Error',
              message: `Segmentation file not found. Please ensure the file is properly loaded.`,
              type: 'error',
            });
            continue;
          }

          console.log('🔍 Loading SEG display set:', {
            dsUID,
            targetViewportId,
            isLoaded: segDisplaySet.isLoaded,
            hasLabelmapBufferArray: !!segDisplaySet.labelmapBufferArray,
            hasCentroids: !!segDisplaySet.centroids,
            sopClassUID: segDisplaySet.sopClassUIDs?.[0],
            numInstances: segDisplaySet.numImageFrames
          });

          // Validate that this is actually a SEG display set
          if (!segDisplaySet.sopClassUIDs?.includes('1.2.840.10008.5.1.4.1.1.66.4')) {
            console.warn('❌ Display set is not a valid DICOM SEG');
            uiNotificationService.show({
              title: 'Invalid Segmentation',
              message: 'The selected file is not a valid DICOM Segmentation object.',
              type: 'error',
            });
            continue;
          }

          // Ensure the SEG display set is parsed and populated
          try {
            if (typeof segDisplaySet.load === 'function' && !segDisplaySet.isLoaded) {
              console.log('📥 Loading SEG display set...');
              
              // Add timeout and retry for loading
              const loadWithRetry = async (retries = 2) => {
                try {
                  const loadPromise = segDisplaySet.load({});
                  const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Load timeout after 30s')), 30000)
                  );
                  
                  await Promise.race([loadPromise, timeoutPromise]);
                  console.log('✅ SEG display set loaded successfully');
                  return true;
                } catch (error) {
                  if (retries > 0 && (error.message.includes('502') || error.message.includes('timeout'))) {
                    console.warn(`⚠️ Load failed, retrying... (${retries} attempts left)`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return loadWithRetry(retries - 1);
                  }
                  throw error;
                }
              };
              
              await loadWithRetry();
            }
          } catch (loadErr) {
            console.error('❌ Failed to load/parse SEG before creating segmentation', dsUID, loadErr);
            
            // More specific error messages
            let errorMessage = 'Failed to load segmentation data';
            if (loadErr.message.includes('502')) {
              errorMessage = 'Server temporarily unavailable. Please wait a moment and try again.';
            } else if (loadErr.message.includes('timeout')) {
              errorMessage = 'Loading timeout. The segmentation file may be large or server is busy.';
            } else if (loadErr.message.includes('404')) {
              errorMessage = 'Segmentation file not found. It may not be fully saved yet.';
            }
            
            uiNotificationService.show({
              title: 'Load Segmentation Error',
              message: errorMessage,
              type: 'error',
              duration: 5000,
            });
            continue;
          }

          // Enhanced validation – check for required data
          if (!segDisplaySet.labelmapBufferArray || !segDisplaySet.centroids) {
            console.warn('❌ SEG display set appears incomplete after load – missing required data');
            
            uiNotificationService.show({
              title: 'Incomplete Segmentation',
              message: 'The segmentation file appears to be incomplete or corrupted.',
              type: 'error',
            });
            continue;
          }

          // Check orientation information from the SEG display set
          const firstInstance = segDisplaySet.instances?.[0];
          if (firstInstance) {
            console.log('🧭 SEG Orientation Info:', {
              imageOrientationPatient: firstInstance.ImageOrientationPatient,
              imagePositionPatient: firstInstance.ImagePositionPatient,
              frameOfReferenceUID: firstInstance.FrameOfReferenceUID,
              referencedSeriesUID: segDisplaySet.referencedSeriesInstanceUID
            });

            // Validate frame of reference
            if (!firstInstance.FrameOfReferenceUID) {
              console.warn('⚠️ SEG missing Frame of Reference UID');
            }
          }

          // Check if referenced series is available
          const referencedSeriesUID = segDisplaySet.referencedSeriesInstanceUID;
          if (referencedSeriesUID) {
            const referencedDisplaySets = displaySetService.getDisplaySetsForSeries(referencedSeriesUID);
            if (!referencedDisplaySets || referencedDisplaySets.length === 0) {
              console.warn('⚠️ Referenced series not found:', referencedSeriesUID);
              
              uiNotificationService.show({
                title: 'Missing Reference Images',
                message: 'The original images referenced by this segmentation are not loaded. Please load the original study first.',
                type: 'warning',
              });
            }
          }

          try {
            console.log('🔧 Creating segmentation for SEG display set...');
            const segmentationId = await segmentationService.createSegmentationForSEGDisplaySet(
              segDisplaySet,
              {
                type: cornerstoneToolsEnums.SegmentationRepresentations.Labelmap,
                // Keep original structure for compatibility
                // options: {
                //   preserveOrientation: true,
                //   validateOrientation: true,
                // }
              }
            );
            
            console.log('🔍 SEG Display Set Orientation Debug:', {
              displaySetInstanceUID: segDisplaySet.displaySetInstanceUID,
              hasInstance: !!segDisplaySet.instance,
              instanceOrientation: segDisplaySet.instance?.ImageOrientationPatient,
              instancePosition: segDisplaySet.instance?.ImagePositionPatient,
              frameOfReference: segDisplaySet.instance?.FrameOfReferenceUID,
              referencedSeriesUID: segDisplaySet.referencedSeriesInstanceUID
            });
            
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

            // Show success notification
            uiNotificationService.show({
              title: 'Segmentation Loaded',
              message: 'Segmentation has been successfully loaded and displayed.',
              type: 'success',
            });

          } catch (err) {
            console.error('❌ Failed to create segmentation from SEG display set', dsUID, err);
            
            uiNotificationService.show({
              title: 'Segmentation Creation Error',
              message: `Failed to create segmentation: ${err.message || 'Unknown error'}`,
              type: 'error',
            });
          }
        } catch (globalErr) {
          console.error('❌ Global error loading SEG display set', dsUID, globalErr);
          
          uiNotificationService.show({
            title: 'Load Error',
            message: `Unexpected error loading segmentation: ${globalErr.message || 'Unknown error'}`,
            type: 'error',
          });
        }
      }

      console.log('🎉 Completed loading segmentations:', segmentationIds);
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
