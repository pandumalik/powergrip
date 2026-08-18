import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Plus, Search, X } from 'lucide-react';

interface SearchableCreatableSelectProps {
  value: string;
  onChange: (value: string) => void;
  onCreate?: (newOption: string) => void;
  options: string[];
  placeholder?: string;
  createLabel?: string;
  className?: string;
}

export const SearchableCreatableSelect: React.FC<SearchableCreatableSelectProps> = ({
  value,
  onChange,
  onCreate,
  options,
  placeholder = 'Select or search...',
  createLabel = 'Create new category',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Merge options with value if value is a custom newly typed string
  const allOptions = value && !options.includes(value) ? [value, ...options] : options;

  const filtered = allOptions.filter((opt) =>
    opt.toLowerCase().includes(query.toLowerCase().trim()),
  );

  const exactMatch = allOptions.some(
    (opt) => opt.toLowerCase() === query.toLowerCase().trim(),
  );

  const showCreateOption = query.trim().length > 0 && !exactMatch;

  const handleSelect = (item: string) => {
    onChange(item);
    setIsOpen(false);
    setQuery('');
  };

  const handleCreate = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (onCreate) {
      onCreate(trimmed);
    }
    onChange(trimmed);
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    const totalItems = filtered.length + (showCreateOption ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalItems) % Math.max(1, totalItems));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showCreateOption && highlightedIndex === filtered.length) {
        handleCreate();
      } else if (filtered[highlightedIndex]) {
        handleSelect(filtered[highlightedIndex]);
      } else if (showCreateOption) {
        handleCreate();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Control Box */}
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={`w-full bg-slate-900 border ${
          isOpen ? 'border-brand-500 ring-1 ring-brand-500/30' : 'border-slate-700 hover:border-slate-600'
        } rounded-xl px-3 py-2 text-xs text-white cursor-pointer flex items-center justify-between gap-2 transition-all select-none`}
      >
        <span className={value ? 'text-slate-100 font-medium' : 'text-slate-500'}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-brand-400' : ''
          }`}
        />
      </div>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-950/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-800 flex items-center gap-2 bg-slate-900/60">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search or type new industry..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto py-1 divide-y divide-slate-800/40">
            {filtered.map((item, index) => {
              const isSelected = item === value;
              const isHighlighted = index === highlightedIndex;
              return (
                <div
                  key={item}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    isHighlighted ? 'bg-brand-600/20 text-white' : 'text-slate-300 hover:bg-slate-900/80'
                  }`}
                >
                  <span className="truncate">{item}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-brand-400 shrink-0" />}
                </div>
              );
            })}

            {/* Create New Item Option */}
            {showCreateOption && (
              <div
                onClick={handleCreate}
                onMouseEnter={() => setHighlightedIndex(filtered.length)}
                className={`px-3 py-2.5 text-xs flex items-center gap-2 cursor-pointer bg-purple-950/40 text-purple-300 hover:bg-purple-900/60 border-t border-purple-500/20 font-semibold transition-colors ${
                  highlightedIndex === filtered.length ? 'bg-purple-900/80 text-white' : ''
                }`}
              >
                <Plus className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="truncate">
                  {createLabel}: <span className="text-white underline">"{query.trim()}"</span>
                </span>
              </div>
            )}

            {filtered.length === 0 && !showCreateOption && (
              <div className="px-3 py-4 text-xs text-center text-slate-500">
                No matching categories found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
