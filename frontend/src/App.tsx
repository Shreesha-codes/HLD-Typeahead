import React, { useState, useEffect, useRef } from 'react';

interface Suggestion {
  query: string;
  count: number;
}

const BACKEND_URL = 'http://localhost:3000';

export default function App() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [trending, setTrending] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Keyboard navigation state
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);

  // Search API Response state
  const [searchResponse, setSearchResponse] = useState<any | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Debounce hook implementation
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250); // 250ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  // 2. Fetch suggestions when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${BACKEND_URL}/suggest?q=${encodeURIComponent(debouncedQuery)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch suggestions');
        }
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setHighlightedIndex(-1);
        setShowDropdown(true);
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery]);

  // 3. Fetch Trending Searches (overall top searches from root) on mount
  useEffect(() => {
    const fetchTrending = async () => {
      setIsTrendingLoading(true);
      try {
        const response = await fetch(`${BACKEND_URL}/suggest?q=`);
        if (!response.ok) {
          throw new Error('Failed to fetch trending searches');
        }
        const data = await response.json();
        setTrending(data.suggestions || []);
      } catch (err: any) {
        console.error(err);
      } finally {
        setIsTrendingLoading(false);
      }
    };

    fetchTrending();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 4. Handle search action (POST /search)
  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: searchQuery }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit search');
      }

      const data = await response.json();
      setSearchResponse(data);
      
      // Clear input and suggestions, reset states, and blur input
      setQuery('');
      setDebouncedQuery('');
      setSuggestions([]);
      setShowDropdown(false);
      setHighlightedIndex(-1);
      if (inputRef.current) {
        inputRef.current.blur();
      }
    } catch (err: any) {
      setError(err.message || 'Search execution failed');
    }
  };

  // 5. Keyboard Navigation (ArrowUp, ArrowDown, Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSearch(query);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < suggestions.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        const selected = suggestions[highlightedIndex].query;
        setQuery(selected);
        handleSearch(selected);
      } else {
        handleSearch(query);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Typeahead Search Engine</h1>
        <p>Premium In-Memory Trie Suggestion API & Real-time Auto-complete</p>
      </header>

      <main className="main-content">
        <section className="search-section">
          <div className="search-box-wrapper">
            <div className="search-input-container">
              <span className="search-icon">🔍</span>
              <input
                ref={inputRef}
                type="text"
                className="search-input"
                placeholder="Search laptops, recipes, books, hotels..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
              />

              {/* Suggestions Dropdown panel */}
              {showDropdown && (suggestions.length > 0 || isLoading) && (
                <div className="dropdown-panel" ref={dropdownRef}>
                  {isLoading && (
                    <div className="status-indicator">
                      <div className="spinner"></div>
                      <span>Loading suggestions...</span>
                    </div>
                  )}
                  {!isLoading &&
                    suggestions.map((item, index) => (
                      <div
                        key={item.query}
                        className={`dropdown-item ${index === highlightedIndex ? 'active' : ''}`}
                        onClick={() => {
                          setQuery(item.query);
                          handleSearch(item.query);
                        }}
                      >
                        <span className="dropdown-item-text">{item.query}</span>
                        <span className="dropdown-item-count">{item.count.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <button className="search-button" onClick={() => handleSearch(query)}>
              Search
            </button>
          </div>

          {error && <div className="error-message">Error: {error}</div>}
        </section>

        {/* Display Search Results on Screen */}
        <section className="results-card">
          <h3>Search Results</h3>
          {searchResponse ? (
            <pre className="response-json">
              {JSON.stringify(searchResponse, null, 2)}
            </pre>
          ) : (
            <div className="empty-results">No queries executed yet. Type a query and press Enter.</div>
          )}
        </section>
      </main>

      {/* Sidebar for Trending Searches */}
      <aside className="sidebar">
        <h2>Trending Searches</h2>
        {isTrendingLoading ? (
          <div className="status-indicator">
            <div className="spinner"></div>
            <span>Loading trends...</span>
          </div>
        ) : (
          <div className="trending-list">
            {trending.map((item, index) => (
              <div
                key={item.query}
                className="trending-item"
                onClick={() => {
                  setQuery(item.query);
                  handleSearch(item.query);
                }}
              >
                <span className="trending-rank">#{index + 1}</span>
                <span className="trending-query" title={item.query}>{item.query}</span>
                <span className="trending-count">{item.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
