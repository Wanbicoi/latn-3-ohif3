import React, { useEffect, useState, useMemo } from 'react';
import Icon from '../Icon';

export default function StudyBrowserSort({ servicesManager }: any) {
  const { customizationService, displaySetService } = servicesManager.services;
  const sortFunctionsData = customizationService.get('studyBrowser.sortFunctions');
  const sortFunctions = Array.isArray(sortFunctionsData?.values) ? sortFunctionsData.values : [];

  const [selectedSort, setSelectedSort] = useState(sortFunctions[0] || { label: 'Default', sortFunction: () => 0 });
  const [sortDirection, setSortDirection] = useState('ascending');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get all available segmentation names for suggestions
  const segmentationNames = useMemo(() => {
    const displaySets = displaySetService.getActiveDisplaySets();
    const segNames = displaySets
      .filter((ds: any) => ds.Modality === 'SEG')
      .map((ds: any) => ds.SeriesDescription || ds.description || '')
      .filter((name: string) => name.length > 0)
      .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index) // Remove duplicates
      .sort();
    
    console.log('🔍 Available segmentation names:', segNames);
    return segNames;
  }, [displaySetService]);

  // Filter suggestions based on search term
  const filteredSuggestions = useMemo(() => {
    if (!searchTerm) return [];
    return segmentationNames.filter((name: string) => 
      name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [segmentationNames, searchTerm]);

  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSortFunction = sortFunctions.find((sort: any) => sort.label === event.target.value);
    if (selectedSortFunction) {
      setSelectedSort(selectedSortFunction);
    }
  };

  const toggleSortDirection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSortDirection(prevDirection => (prevDirection === 'ascending' ? 'descending' : 'ascending'));
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    setShowSuggestions(value.length > 0);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    
    // Filter display sets to show only matching segmentations
    const displaySets = displaySetService.getActiveDisplaySets();
    const filteredDisplaySets = displaySets.filter((ds: any) => {
      if (ds.Modality !== 'SEG') return true; // Keep non-SEG items
      const name = (ds.SeriesDescription || ds.description || '').toLowerCase();
      return name.includes(suggestion.toLowerCase());
    });
    
    console.log('🔍 Filtered to:', filteredDisplaySets.length, 'items for search:', suggestion);
    // Note: This would need displaySetService method to filter, for now just log
  };

  const clearSearch = () => {
    setSearchTerm('');
    setShowSuggestions(false);
    // Reset to show all display sets
    console.log('🔍 Cleared search filter');
  };

  useEffect(() => {
    if (selectedSort?.sortFunction) {
      displaySetService.sortDisplaySets(selectedSort.sortFunction, sortDirection);
    }
  }, [displaySetService, selectedSort, sortDirection]);

  useEffect(() => {
    const SubscriptionDisplaySetsChanged = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_CHANGED,
      () => {
        if (selectedSort?.sortFunction) {
          displaySetService.sortDisplaySets(selectedSort.sortFunction, sortDirection, true);
        }
      }
    );
    const SubscriptionDisplaySetMetaDataInvalidated = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SET_SERIES_METADATA_INVALIDATED,
      () => {
        if (selectedSort?.sortFunction) {
          displaySetService.sortDisplaySets(selectedSort.sortFunction, sortDirection, true);
        }
      }
    );

    return () => {
      SubscriptionDisplaySetsChanged.unsubscribe();
      SubscriptionDisplaySetMetaDataInvalidated.unsubscribe();
    };
  }, [displaySetService, selectedSort, sortDirection]);

  if (sortFunctions.length === 0) {
    return <div>No sort functions available</div>;
  }

  return (
    <div className="flex flex-col gap-2" style={{ backgroundColor: 'red', padding: '10px' }}>
      {/* Debug info */}
      <div style={{ color: 'white', fontSize: '12px' }}>
        Search Component Loaded - SEG count: {segmentationNames.length}
      </div>
      
      {/* Search Filter */}
      <div className="relative">
        <div className="flex gap-1">
          <input
            type="text"
            placeholder="🔍 Search segmentations..."
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={() => setShowSuggestions(searchTerm.length > 0)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #666',
              borderRadius: '4px',
              backgroundColor: '#000',
              color: '#fff',
              fontSize: '14px'
            }}
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              style={{
                padding: '8px',
                border: '1px solid #666',
                borderRadius: '4px',
                backgroundColor: '#000',
                color: '#fff'
              }}
            >
              ✕
            </button>
          )}
        </div>
        
        {/* Suggestions Dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 9999,
            marginTop: '4px',
            maxHeight: '160px',
            overflowY: 'auto',
            border: '1px solid #666',
            borderRadius: '4px',
            backgroundColor: '#000',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }}>
            {filteredSuggestions.map((suggestion: string, index: number) => (
              <div
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  color: '#fff',
                  cursor: 'pointer',
                  borderBottom: index < filteredSuggestions.length - 1 ? '1px solid #333' : 'none'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#333';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sort Controls */}
      <div className="flex gap-2">
        <select
          onChange={handleSortChange}
          value={selectedSort.label}
          onClick={e => e.stopPropagation()}
          className="border-inputfield-main focus:border-inputfield-main w-full appearance-none rounded border bg-black py-2 px-3 text-sm leading-tight text-white shadow transition duration-300 focus:outline-none"
        >
          {sortFunctions.map((sort: any) => (
            <option
              value={sort.label}
              key={sort.label}
            >
              {sort.label}
            </option>
          ))}
        </select>
        <button
          onClick={toggleSortDirection}
          className="border-inputfield-main flex items-center justify-center rounded border bg-black"
        >
          <Icon
            name={sortDirection === 'ascending' ? 'sorting-active-up' : 'sorting-active-down'}
            className="text-primary-main mx-2 w-2"
          />
        </button>
      </div>
    </div>
  );
}
