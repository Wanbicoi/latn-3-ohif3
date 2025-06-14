/*
Copyright (c) MONAI Consortium
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

function currentSegmentsInfo(segmentationService) {
  const info = {};
  const indices = new Set();

  if (!segmentationService || !segmentationService.getSegmentations) {
    return { info, indices };
  }

  const segmentations = segmentationService.getSegmentations();

  if (!segmentations || segmentations.length === 0) {
    return { info, indices };
  }

  // Assume first segmentation represents the current one; adjust as needed
  const segmentation = Array.isArray(segmentations) ? segmentations[0] : segmentations['0'];

  if (!segmentation || !segmentation.config || !segmentation.config.segments) {
    return { info, indices };
  }

  const { segments } = segmentation.config;

  Object.keys(segments || {}).forEach(segmentIndex => {
    const segment = segments[segmentIndex];
    if (!segment) {
      return;
    }

    // Ensure color is always an array with at least 3 elements
    const color = segment.color && Array.isArray(segment.color) && segment.color.length >= 3 
      ? segment.color 
      : [0, 0, 0];

    info[segment.label] = {
      segmentIndex: segment.segmentIndex,
      color: color,
    };
    indices.add(segment.segmentIndex);
  });

  return { info, indices };
}

export { currentSegmentsInfo };
