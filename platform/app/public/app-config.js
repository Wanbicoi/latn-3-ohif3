/** @type {AppTypes.Config} */
window.config = {
  routerBasename: '/ohif3',
  extensions: [],
  modes: [],
  showStudyList: false,
  maxNumberOfWebWorkers: 3,
  showWarningMessageForCrossOrigin: true,
  showCPUFallbackMessage: true,
  strictZSpacingForVolumeViewport: true,

  // Customization for overlay positioning - Fix duplicate và di chuyển thông tin xuống bottom
  customizationService: [
    {
      id: '@ohif/cornerstoneOverlay',
      // Replace để xóa hết config cũ và tránh duplicate
      merge: 'Replace',
      
      // Xóa hết thông tin ở topLeft để tránh trùng lặp
      topLeftItems: {
        id: 'cornerstoneOverlayTopLeft',
        items: [],
      },

      topRightItems: {
        id: 'cornerstoneOverlayTopRight',
        items: [],
      },

      // Di chuyển tất cả thông tin xuống bottomLeft (góc trái dưới như user yêu cầu)
      bottomLeftItems: {
        id: 'cornerstoneOverlayBottomLeft',
        items: [
          {
            id: 'StudyDate',
            customizationType: 'ohif.overlayItem',
            label: '',
            title: 'Study date',
            condition: ({ referenceInstance }) => referenceInstance?.StudyDate,
            contentF: ({ referenceInstance, formatters: { formatDate } }) =>
              formatDate(referenceInstance.StudyDate),
          },
          {
            id: 'SeriesDescription', 
            customizationType: 'ohif.overlayItem',
            label: '',
            title: 'Series description',
            condition: ({ referenceInstance }) => {
              return referenceInstance && referenceInstance.SeriesDescription;
            },
            contentF: ({ referenceInstance }) => referenceInstance.SeriesDescription,
          },
          {
            id: 'WindowLevel',
            customizationType: 'ohif.overlayItem.windowLevel',
          },
          {
            id: 'InstanceNumber',
            customizationType: 'ohif.overlayItem.instanceNumber',
          },
        ],
      },

      // Xóa InstanceNumber khỏi bottomRight để tránh duplicate
      bottomRightItems: {
        id: 'cornerstoneOverlayBottomRight',
        items: [],
      },
    },
  ],

  defaultDataSourceName: 'dicomweb',
  investigationalUseDialog: {
    option: 'never',
  },
  
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'AWS S3 Static wado server',
        name: 'aws',
        wadoUriRoot: 'https://latn-3.eastasia.cloudapp.azure.com/datasource/dicom-web',
        qidoRoot: 'https://latn-3.eastasia.cloudapp.azure.com/datasource/dicom-web',
        wadoRoot: 'https://latn-3.eastasia.cloudapp.azure.com/datasource/dicom-web',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
          transform: url => url.replace('/pixeldata.mp4', '/rendered'),
        },
        omitQuotationForMultipartRequest: true,
      },
    },
  ],
  
  httpErrorHandler: error => {
    console.warn(error.status);
  },
  
  hotkeys: [],
}; 