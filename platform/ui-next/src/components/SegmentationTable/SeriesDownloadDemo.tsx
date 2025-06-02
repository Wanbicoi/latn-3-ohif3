import React from 'react';
import { SeriesDownloadButton } from './SeriesDownloadButton';

/**
 * Demo component showing how to integrate download functionality
 * into Series list - this shows the elegant UX flow for doctors
 */
export const SeriesDownloadDemo: React.FC = () => {
  const mockSeries = [
    {
      seriesInstanceUID: '2.25.380483783084782314816573291145647510571',
      studyInstanceUID: '2.25.528479951115887404741940001078032992966',
      seriesDescription: 'SEG Vertebra Detection',
      modality: 'SEG',
      seriesNumber: '99',
      numInstances: 1
    },
    {
      seriesInstanceUID: '2.25.775315434347589857489417830860651831383',
      studyInstanceUID: '2.25.528479951115887404741940001078032992966',
      seriesDescription: 'SEG Liver Segmentation',
      modality: 'SEG',
      seriesNumber: '88',
      numInstances: 1
    },
    {
      seriesInstanceUID: '2.25.603413444025735403597336082303522613526',
      studyInstanceUID: '2.25.528479951115887404741940001078032992966',
      seriesDescription: 'SEG Heart Analysis',
      modality: 'SEG',
      seriesNumber: '77',
      numInstances: 1
    }
  ];

  const handleDownloadComplete = (filename: string) => {
    console.log(`🎉 Successfully downloaded: ${filename}`);
    // Could show a toast notification here
  };

  return (
    <div className="p-6 bg-gray-900 text-white max-w-md">
      <h2 className="text-xl font-bold mb-4 text-blue-400">📥 Medical Series Download</h2>
      <p className="text-sm text-gray-400 mb-6">
        Hover over any series to reveal download options
      </p>
      
      <div className="space-y-3">
        {mockSeries.map((series) => (
          <div
            key={series.seriesInstanceUID}
            className="group flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all duration-200"
          >
            {/* Series Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-300 font-semibold">{series.modality}</span>
                <span className="text-xs bg-gray-600 px-2 py-1 rounded">
                  S:{series.seriesNumber}
                </span>
              </div>
              <div className="text-sm text-gray-300 truncate max-w-[200px]">
                {series.seriesDescription}
              </div>
              <div className="text-xs text-gray-500">
                {series.numInstances} instance{series.numInstances !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Download Button - Only shows on hover */}
            <SeriesDownloadButton
              seriesInstanceUID={series.seriesInstanceUID}
              studyInstanceUID={series.studyInstanceUID}
              seriesDescription={series.seriesDescription}
              modality={series.modality}
              onDownloadComplete={handleDownloadComplete}
              className="flex-shrink-0"
            />
          </div>
        ))}
      </div>

      <div className="mt-6 p-3 bg-blue-900/30 rounded-lg border border-blue-700">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-blue-400">💡</span>
          <span className="text-sm font-semibold text-blue-300">UX Features:</span>
        </div>
        <ul className="text-xs text-gray-300 space-y-1">
          <li>• Hover to reveal download button</li>
          <li>• Multiple format options (DICOM, NIfTI, ZIP)</li>
          <li>• Progress indication during download</li>
          <li>• Automatic filename generation</li>
          <li>• Series information tooltip</li>
        </ul>
      </div>
    </div>
  );
}; 