'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';

function getMenuPosition(input: HTMLInputElement) {
  const bounds = input.getBoundingClientRect();
  const spaceBelow = window.innerHeight - bounds.bottom - 8;
  const spaceAbove = bounds.top - 8;
  const openAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(80, Math.min(220, openAbove ? spaceAbove : spaceBelow));
  return {
    top: openAbove ? Math.max(8, bounds.top - maxHeight - 4) : bounds.bottom + 4,
    left: bounds.left,
    width: bounds.width,
    maxHeight,
  };
}

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  options: readonly SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  style?: CSSProperties;
  disabled?: boolean;
  allowCustom?: boolean;
}

export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  ariaLabel,
  style,
  disabled = false,
  allowCustom = false,
}: SearchableSelectProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<ReturnType<typeof getMenuPosition> | null>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  const filteredOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const trimmedQuery = query.trim();
  const exactOptionExists = options.some((option) =>
    option.label.toLocaleLowerCase() === trimmedQuery.toLocaleLowerCase(),
  );
  const menuOptions = [
    ...filteredOptions.map((option) => ({ option, isCustom: false })),
    ...(allowCustom && trimmedQuery && !exactOptionExists
      ? [{ option: { value: trimmedQuery, label: `Add "${trimmedQuery}"` }, isCustom: true }]
      : []),
  ];

  useEffect(() => {
    if (!open) return;

    const updateMenuPosition = () => {
      if (inputRef.current) setMenuPosition(getMenuPosition(inputRef.current));
    };
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setMenuPosition(null);
    setQuery('');
  };

  const selectOption = (option: SearchableSelectOption) => {
    onChange(option.value);
    closeMenu();
    setActiveIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setMenuPosition(getMenuPosition(event.currentTarget));
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, menuOptions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setMenuPosition(getMenuPosition(event.currentTarget));
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && menuOptions.length > 0) {
      event.preventDefault();
      const selected = menuOptions[Math.min(activeIndex, menuOptions.length - 1)];
      if (selected.isCustom) {
        onChange(selected.option.value);
        closeMenu();
      } else {
        selectOption(selected.option);
      }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeMenu();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Search
        aria-hidden="true"
        size={15}
        style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
      />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && menuOptions.length ? `${listId}-${activeIndex}` : undefined}
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onFocus={(event) => {
          setQuery('');
          setActiveIndex(0);
          setMenuPosition(getMenuPosition(event.currentTarget));
          setOpen(true);
        }}
        onBlur={() => {
          if (allowCustom && trimmedQuery) {
            const exactOption = options.find((option) =>
              option.label.toLocaleLowerCase() === trimmedQuery.toLocaleLowerCase(),
            );
            onChange(exactOption?.value ?? trimmedQuery);
          }
          closeMenu();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setMenuPosition(getMenuPosition(event.currentTarget));
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        style={{ ...style, paddingLeft: 34, paddingRight: value ? 34 : 12 }}
      />
      {value && !disabled && (
        <button
          type="button"
          aria-label="Clear selection"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange('');
            setQuery('');
            if (inputRef.current) setMenuPosition(getMenuPosition(inputRef.current));
            setOpen(true);
          }}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={15} />
        </button>
      )}
      {open && menuPosition && typeof document !== 'undefined' && createPortal(
        <div
          id={listId}
          role="listbox"
          style={{ position: 'fixed', zIndex: 2147483647, top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, maxHeight: menuPosition.maxHeight, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', boxShadow: '0 8px 20px rgba(0,0,0,0.16)' }}
        >
          {menuOptions.length ? menuOptions.map(({ option, isCustom }, index) => (
            <div
              key={`${isCustom ? 'custom' : 'option'}-${option.value}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={!isCustom && option.value === value}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (isCustom) {
                  onChange(option.value);
                  closeMenu();
                } else {
                  selectOption(option);
                }
              }}
              style={{ padding: '0.55rem 0.7rem', cursor: 'pointer', color: 'var(--text-primary)', background: index === activeIndex ? 'var(--bg-secondary)' : 'transparent', fontSize: 'var(--font-size-body-compact)' }}
            >
              {option.label}
            </div>
          )) : (
            <div role="status" style={{ padding: '0.6rem 0.7rem', color: 'var(--text-muted)', fontSize: 'var(--font-size-body-compact)' }}>
              No matching options
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
