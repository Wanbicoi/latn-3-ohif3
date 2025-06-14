import React, { useEffect, useState, useMemo } from 'react';
import { Icons } from '@ohif/ui-next';

export function StudyBrowserSort({ servicesManager }: any) {
  const { customizationService, displaySetService } = servicesManager.services;
  const sortFunctionsData = customizationService.get('studyBrowser.sortFunctions');
  const sortFunctions = Array.isArray(sortFunctionsData?.values) ? sortFunctionsData.values : [];

  const [selectedSort, setSelectedSort] = useState(sortFunctions[0] || { label: 'Default', sortFunction: () => 0 });
  const [sortDirection, setSortDirection] = useState('ascending');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filterUpdateKey, setFilterUpdateKey] = useState(0); // Force re-render key

  // Get all available segmentation names for suggestions
  const segmentationNames = useMemo(() => {
    const displaySets = displaySetService.getActiveDisplaySets();
    const segNames = displaySets
      .filter((ds: any) => ds.Modality === 'SEG')
      .map((ds: any) => ds.SeriesDescription || ds.description || '')
      .filter((name: string) => name.length > 0)
      .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index) // Remove duplicates
      .sort();
    
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
    
    // Apply real-time filtering
    applySearchFilter(value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    applySearchFilter(suggestion);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setShowSuggestions(false);
    applySearchFilter(''); // Show all SEGs
  };

  // Apply search filter by dispatching event to StudyBrowser
  const applySearchFilter = (searchValue: string) => {
    // Dispatch custom event for StudyBrowser to listen
    const event = new CustomEvent('ohif-search-filter-changed', {
      detail: { searchTerm: searchValue }
    });
    window.dispatchEvent(event);
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
    return null;
  }

  return (
    <div className="flex flex-col gap-2 w-full" key={`search-filter-${filterUpdateKey}`}>
      {/* Search Box - Compact */}
      <div className="relative">
        <input
          type="text"
          placeholder="🔍 Search segmentations..."
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={() => setShowSuggestions(searchTerm.length > 0)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="h-[32px] w-full rounded border border-gray-600 bg-gray-900 px-3 pr-8 text-sm text-white placeholder-gray-400 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
        />
        
        {/* Clear button - Smaller */}
        {searchTerm && (
          <button
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:text-white text-xs"
            title="Clear search"
          >
            ✕
          </button>
        )}
        
        {/* Suggestions Dropdown - Compact */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-32 overflow-y-auto rounded border border-gray-600 bg-gray-900 shadow-lg">
            {filteredSuggestions.map((suggestion: string, index: number) => (
              <div
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="cursor-pointer px-3 py-2 text-sm text-white transition-colors hover:bg-blue-600/20 flex items-center gap-2"
              >
                <span className="text-blue-400 text-xs">🔍</span>
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sort Controls - Inline and compact */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 whitespace-nowrap">Sort:</span>
        <select
          onChange={handleSortChange}
          value={selectedSort.label}
          onClick={e => e.stopPropagation()}
          className="h-[28px] flex-1 rounded border border-gray-600 bg-gray-900 px-2 text-xs text-white transition-all duration-200 focus:border-blue-500 focus:outline-none"
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
          className="flex h-[28px] w-[28px] items-center justify-center rounded border border-gray-600 bg-gray-900 transition-all duration-200 hover:bg-gray-800 hover:border-blue-500"
          title={`Sort ${sortDirection === 'ascending' ? 'Descending' : 'Ascending'}`}
        >
          <span className="text-blue-400 text-xs font-bold">
            {sortDirection === 'ascending' ? '↑' : '↓'}
          </span>
        </button>
      </div>

      {/* Search feedback - Compact */}
      {searchTerm && (
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800/30 rounded px-2 py-1">
          <span className="text-blue-400">🔍</span>
          <span className="truncate">
            "{searchTerm}" 
            {filteredSuggestions.length > 0 ? 
              <span className="text-green-400 ml-1">({filteredSuggestions.length} found)</span> : 
              <span className="text-orange-400 ml-1">(no matches)</span>
            }
          </span>
        </div>
      )}
    </div>
  );
}
