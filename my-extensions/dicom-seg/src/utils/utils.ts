import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneDicomImageLoader from '@cornerstonejs/dicom-image-loader';
import * as cornerstoneTools from '@cornerstonejs/tools';

const { imageLoader, metaData } = cornerstone;
const { segmentation: csToolsSegmentation } = cornerstoneTools;
const { wadouri } = cornerstoneDicomImageLoader;

export async function readSegmentation(viewportId: string, blob: Blob) {
  const imageId = wadouri.fileManager.add(blob);
  const image = await imageLoader.loadAndCacheImage(imageId);

  if (!image) {
    console.log('readSegmentation: No image');
    return;
  }

  const instance = metaData.get('instance', imageId);

  if (instance.Modality !== 'SEG') {
    console.error('This is not segmentation: ', blob.size);
    return;
  }

  const arrayBuffer = image.data.byteArray.buffer;

  await _loadSegmentation(viewportId, [imageId], arrayBuffer);
}

async function _loadSegmentation(viewportId: string, imageIds: string[], arrayBuffer: ArrayBuffer) {
  const newSegmentationId = 'LOAD_SEG_ID:' + cornerstone.utilities.uuidv4();

  console.log(newSegmentationId);
  await _addSegmentationsToState(newSegmentationId, imageIds, viewportId);

  // Update the dropdown
  // updateSegmentationDropdown(newSegmentationId);
}

async function _addSegmentationsToState(segmentationId: string, imageIds: string[], viewportId) {
  //
  const derivedImages = imageLoader.createAndCacheDerivedLabelmapImages(imageIds);

  // Add the segmentations to state
  csToolsSegmentation.addSegmentations([
    {
      segmentationId,
      representation: {
        type: cornerstoneTools.Enums.SegmentationRepresentations.Labelmap,
        data: {
          imageIds: derivedImages.map(x => x.imageId),
        },
      },
    },
  ]);

  // Add the segmentation representation to the toolgroup
  csToolsSegmentation.addSegmentationRepresentations(viewportId, [
    {
      segmentationId,
      type: cornerstoneTools.Enums.SegmentationRepresentations.Labelmap,
    },
  ]);

  //
  return derivedImages;
}
