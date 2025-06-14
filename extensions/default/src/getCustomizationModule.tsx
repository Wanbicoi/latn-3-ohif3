import { CustomizationService } from '@ohif/core';
import React from 'react';
import DataSourceSelector from './Panels/DataSourceSelector';
import { ProgressDropdownWithService } from './Components/ProgressDropdownWithService';
import DataSourceConfigurationComponent from './Components/DataSourceConfigurationComponent';
import { GoogleCloudDataSourceConfigurationAPI } from './DataSourceConfigurationAPI/GoogleCloudDataSourceConfigurationAPI';
import { utils } from '@ohif/core';

const formatDate = utils.formatDate;

/**
 *
 * Note: this is an example of how the customization module can be used
 * using the customization module. Below, we are adding a new custom route
 * to the application at the path /custom and rendering a custom component
 * Real world use cases of the having a custom route would be to add a
 * custom page for the user to view their profile, or to add a custom
 * page for login etc.
 */
export default function getCustomizationModule({ servicesManager, extensionManager }) {
  return [
    {
      name: 'helloPage',
      merge: 'Append',
      value: {
        id: 'customRoutes',
        routes: [
          {
            path: '/custom',
            children: () => <h1 style={{ color: 'white' }}>Hello Custom Route</h1>,
          },
        ],
      },
    },

    // Example customization to list a set of datasources
    {
      name: 'datasources',
      merge: 'Append',
      value: {
        id: 'customRoutes',
        routes: [
          {
            path: '/datasources',
            children: DataSourceSelector,
          },
        ],
      },
    },

    {
      name: 'default',
      value: [
        /**
         * Customization Component Type definition for overlay items.
         * Overlay items are texts (or other components) that will be displayed
         * on a Viewport Overlay, which contains the information panels on the
         * four corners of a viewport.
         *
         * @definition of a overlay item using this type
         * The value to be displayed is defined by
         *  - setting DICOM image instance's property to this field,
         *  - or defining contentF()
         *
         * {
         *   id: string - unique id for the overlay item
         *   customizationType: string - indicates customization type definition to this
         *   label: string - Label, to be displayed for the item
         *   title: string - Tooltip, for the item
         *   color: string - Color of the text
         *   condition: ({ instance }) => boolean - decides whether to display the overlay item or not
         *   attribute: string - property name of the DICOM image instance
         *   contentF: ({ instance, formatters }) => string | component,
         * }
         *
         * @example
         *  {
         *    id: 'PatientNameOverlay',
         *    customizationType: 'ohif.overlayItem',
         *    label: 'PN:',
         *    title: 'Patient Name',
         *    color: 'yellow',
         *    condition: ({ instance }) => instance && instance.PatientName && instance.PatientName.Alphabetic,
         *    attribute: 'PatientName',
         *    contentF: ({ instance, formatters: { formatPN } }) => `${formatPN(instance.PatientName.Alphabetic)} ${(instance.PatientSex ? '(' + instance.PatientSex + ')' : '')}`,
         *  },
         *
         * @see CustomizableViewportOverlay
         */
        {
          id: 'ohif.overlayItem',
          content: function (props) {
            if (this.condition && !this.condition(props)) {
              return null;
            }

            const { instance } = props;
            const value =
              instance && this.attribute
                ? instance[this.attribute]
                : this.contentF && typeof this.contentF === 'function'
                  ? this.contentF(props)
                  : null;
            if (!value) {
              return null;
            }

            return (
              <span
                className="overlay-item flex flex-row"
                style={{ color: this.color || undefined }}
                title={this.title || ''}
              >
                {this.label && <span className="mr-1 shrink-0">{this.label}</span>}
                <span className="font-light">{value}</span>
              </span>
            );
          },
        },

        {
          id: 'ohif.contextMenu',

          /** Applies the customizationType to all the menu items.
           * This function clones the object and child objects to prevent
           * changes to the original customization object.
           */
          transform: function (customizationService: CustomizationService) {
            // Don't modify the children, as those are copied by reference
            const clonedObject = { ...this };
            clonedObject.menus = this.menus.map(menu => ({ ...menu }));

            for (const menu of clonedObject.menus) {
              const { items: originalItems } = menu;
              menu.items = [];
              for (const item of originalItems) {
                menu.items.push(customizationService.transform(item));
              }
            }
            return clonedObject;
          },
        },

        {
          // the generic GUI component to configure a data source using an instance of a BaseDataSourceConfigurationAPI
          id: 'ohif.dataSourceConfigurationComponent',
          component: DataSourceConfigurationComponent.bind(null, {
            servicesManager,
            extensionManager,
          }),
        },

        {
          // The factory for creating an instance of a BaseDataSourceConfigurationAPI for Google Cloud Healthcare
          id: 'ohif.dataSourceConfigurationAPI.google',
          factory: (dataSourceName: string) =>
            new GoogleCloudDataSourceConfigurationAPI(
              dataSourceName,
              servicesManager,
              extensionManager
            ),
        },

        {
          id: 'progressDropdownWithServiceComponent',
          component: ProgressDropdownWithService,
        },
        {
          id: 'studyBrowser.sortFunctions',
          values: [
            {
              label: 'Alphabetical',
              sortFunction: (a, b) => {
                // Sort by description/name alphabetically
                const nameA = (a?.SeriesDescription || a?.description || '').toLowerCase();
                const nameB = (b?.SeriesDescription || b?.description || '').toLowerCase();
                
                console.log('🔤 Alphabetical sort:', {
                  a: { uid: a?.displaySetInstanceUID?.slice(-8), name: nameA },
                  b: { uid: b?.displaySetInstanceUID?.slice(-8), name: nameB }
                });
                
                // Primary sort: alphabetical by name
                if (nameA !== nameB) {
                  return nameA.localeCompare(nameB);
                }
                
                // Secondary sort: by modality (SEG first, then others)
                const modalityA = a?.Modality || a?.modality || '';
                const modalityB = b?.Modality || b?.modality || '';
                
                if (modalityA === 'SEG' && modalityB !== 'SEG') return -1;
                if (modalityB === 'SEG' && modalityA !== 'SEG') return 1;
                
                // Tertiary sort: by series number for same names
                const seriesA = parseInt(a?.SeriesNumber || a?.seriesNumber || 0);
                const seriesB = parseInt(b?.SeriesNumber || b?.seriesNumber || 0);
                
                return seriesA - seriesB;
              },
            },
            {
              label: 'Last Updated',
              sortFunction: (a, b) => {
                // Get various timestamp fields for comparison
                const getTimestamp = (item) => {
                  // Try multiple timestamp fields in order of preference
                  const timestamps = [
                    item?.SeriesTime,
                    item?.seriesTime,
                    item?.StudyTime,
                    item?.studyTime,
                    item?.InstanceCreationTime,
                    item?.instanceCreationTime,
                    item?.ContentTime,
                    item?.contentTime,
                    item?.AcquisitionTime,
                    item?.acquisitionTime
                  ].filter(Boolean);
                  
                  // If we have SeriesDate + SeriesTime, combine them
                  const seriesDate = item?.SeriesDate || item?.seriesDate;
                  const seriesTime = item?.SeriesTime || item?.seriesTime;
                  
                  if (seriesDate && seriesTime) {
                    // Convert DICOM date/time to comparable format
                    const dateStr = seriesDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
                    const timeStr = seriesTime.replace(/(\d{2})(\d{2})(\d{2}).*/, '$1:$2:$3');
                    const fullDateTime = `${dateStr}T${timeStr}`;
                    return new Date(fullDateTime).getTime();
                  }
                  
                  // Fallback to any available timestamp
                  if (timestamps.length > 0) {
                    const timeStr = timestamps[0].replace(/(\d{2})(\d{2})(\d{2}).*/, '$1:$2:$3');
                    const fallbackDateTime = `1970-01-01T${timeStr}`;
                    return new Date(fallbackDateTime).getTime();
                  }
                  
                  // If no timestamp, use series number as proxy for creation order
                  const seriesNumber = parseInt(item?.SeriesNumber || item?.seriesNumber || 0);
                  if (seriesNumber > 0) {
                    return seriesNumber; // Higher series number = more recent
                  }
                  
                  return Date.now();
                };
                
                const timestampA = getTimestamp(a);
                const timestampB = getTimestamp(b);
                
                // Sort by most recent first (descending order)
                return timestampB - timestampA;
              },
            },
          ],
        },
        {
          id: 'studyBrowser.viewPresets',
          // change your default selected preset here
          value: [
            {
              id: 'list',
              iconName: 'ListView',
              selected: false,
            },
            {
              id: 'thumbnails',
              iconName: 'ThumbnailView',
              selected: true,
            },
          ],
        },
      ],
    },
  ];
}
