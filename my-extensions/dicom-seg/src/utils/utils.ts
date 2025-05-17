import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneDicomImageLoader from '@cornerstonejs/dicom-image-loader';
import * as cornerstoneTools from '@cornerstonejs/tools';
import * as cornerstoneAdapters from '@cornerstonejs/adapters';
import { cache } from '@cornerstonejs/core';

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

  console.log('newSegmentationId', newSegmentationId);
  const derivedImages = await _addSegmentationsToState(newSegmentationId, imageIds, viewportId);

  //
  const generateToolState =
    await cornerstoneAdapters.adaptersSEG.Cornerstone3D.Segmentation.generateToolState(
      imageIds,
      arrayBuffer,
      metaData
    );

  //
  derivedImages.forEach(image => {
    const cachedImage = cache.getImage(image.imageId);

    if (cachedImage) {
      const pixelData = cachedImage.getPixelData();
      pixelData.set(new Uint8Array(generateToolState.labelmapBufferArray[0]));
    }
  });
  setTimeout(function () {
    csToolsSegmentation.triggerSegmentationEvents.triggerSegmentationDataModified(
      newSegmentationId
    );
  }, 200);
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
  await csToolsSegmentation.addSegmentationRepresentations(viewportId, [
    {
      segmentationId,
      type: cornerstoneTools.Enums.SegmentationRepresentations.Labelmap,
    },
  ]);

  //
  return derivedImages;
}
