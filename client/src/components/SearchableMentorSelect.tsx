import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, User, Users, AlertCircle } from 'lucide-react';

export interface MentorOption {
  id: string;
  name: string;
  email?: string;
  department?: string;
  studentCount?: number;
}

interface SearchableMentorSelectProps {
  mentors: MentorOption[];
  value: string;
  onChange: (mentorId: string) => void;
  placeholder?: string;
  includeUnassigned?: boolean;
  unassignedCount?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
  label?: string;
  id?: string;
}

export const SearchableMentorSelect: React.FC<SearchableMentorSelectProps> = ({
  mentors,
  value,
  onChange,
  placeholder = 'All Mentors / Staff',
  includeUnassigned = true,
  unassignedCount,
  disabled = false,
  style,
  label = 'Mentor (Staff)',
  id = 'filter-mentor-select',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Find currently selected mentor
  const selectedMentor = useMemo(() => {
    if (!value || value === '') return null;
    if (value === 'UNASSIGNED' || value === 'NONE') {
      const labelStr = unassignedCount !== undefined
        ? `Unassigned / Unpaired (${unassignedCount} students)`
        : 'Unassigned (No Mentor Assigned)';
      return { id: 'UNASSIGNED', name: labelStr, email: '', studentCount: unassignedCount };
    }
    const found = mentors.find((m) => m.id === value);
    if (found && found.studentCount !== undefined) {
      return { ...found, name: `${found.name} (${found.studentCount})` };
    }
    return found || null;
  }, [value, mentors, unassignedCount]);

  // High-performance fuzzy filtering that never lags even with 100+ mentors
  const filteredMentors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return mentors;
    return mentors.filter((m) => {
      const nameMatch = (m.name || '').toLowerCase().includes(q);
      const emailMatch = (m.email || '').toLowerCase().includes(q);
      const deptMatch = (m.department || '').toLowerCase().includes(q);
      return nameMatch || emailMatch || deptMatch;
    });
  }, [mentors, searchTerm]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: '0.5rem',
            letterSpacing: '0.025em',
          }}
        >
          {label}
        </label>
      )}

      {/* Main Trigger Button */}
      <div
        id={id}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        style={{
          width: '100%',
          backgroundColor: 'var(--bg-input, #0f172a)',
          border: isOpen ? '1px solid #3b82f6' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          color: selectedMentor ? 'var(--text-main, #f8fafc)' : 'var(--text-muted, #94a3b8)',
          padding: '0.55rem 0.75rem',
          borderRadius: 'var(--radius-sm, 6px)',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxShadow: isOpen ? '0 0 0 2px rgba(59, 130, 246, 0.25)' : 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedMentor ? (
            selectedMentor.id === 'UNASSIGNED' ? (
              <AlertCircle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
            ) : (
              <User size={15} style={{ color: '#38bdf8', flexShrink: 0 }} />
            )
          ) : (
            <Users size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          )}

          <span style={{ fontWeight: selectedMentor ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedMentor ? selectedMentor.name : placeholder}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          {selectedMentor && !disabled && (
            <span
              onClick={handleClear}
              title="Clear filter (Show All Mentors)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={16}
            style={{
              color: 'var(--text-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      </div>

      {/* Floating Searchable Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#0f172a',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '8px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55), 0 0 15px rgba(59, 130, 246, 0.15)',
            padding: '0.5rem',
            minWidth: '260px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Live Search Input with Instant Typing */}
          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.65rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#60a5fa',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search ${mentors.length} mentors by name or email...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.825rem',
                padding: '0.45rem 1.8rem 0.45rem 2rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick Header / Counter */}
          <div
            style={{
              padding: '0.2rem 0.4rem 0.4rem',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '0.35rem',
            }}
          >
            <span>
              {searchTerm ? `Found ${filteredMentors.length} of ${mentors.length}` : `All Faculty Mentors (${mentors.length})`}
            </span>
            <span style={{ fontSize: '0.68rem', color: '#60a5fa' }}>Select to filter</span>
          </div>

          {/* Scrollable Mentors List (High-Performance Max-Height Container) */}
          <div
            style={{
              maxHeight: '230px',
              overflowY: 'auto',
              scrollbarWidth: 'thin',
            }}
          >
            {/* Option: All Mentors (Default) */}
            {!searchTerm && (
              <div
                onClick={() => handleSelect('')}
                style={{
                  padding: '0.5rem 0.65rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: !value ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: !value ? '#60a5fa' : 'var(--text-main, #f8fafc)',
                  fontSize: '0.84rem',
                  fontWeight: !value ? 700 : 500,
                  transition: 'background 0.15s ease',
                  marginBottom: '2px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = !value ? 'rgba(59, 130, 246, 0.15)' : 'transparent')
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={14} style={{ color: '#60a5fa' }} />
                  <span>All Mentors / Staff (Show All)</span>
                </div>
                {!value && <Check size={14} style={{ color: '#60a5fa' }} />}
              </div>
            )}

            {/* Option: Unassigned */}
            {includeUnassigned && !searchTerm && (
              <div
                onClick={() => handleSelect('UNASSIGNED')}
                style={{
                  padding: '0.5rem 0.65rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: value === 'UNASSIGNED' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                  color: value === 'UNASSIGNED' ? '#fbbf24' : 'var(--text-main, #f8fafc)',
                  fontSize: '0.84rem',
                  fontWeight: value === 'UNASSIGNED' ? 700 : 500,
                  transition: 'background 0.15s ease',
                  marginBottom: '4px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.1)')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = value === 'UNASSIGNED' ? 'rgba(245, 158, 11, 0.15)' : 'transparent')
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={14} style={{ color: '#f59e0b' }} />
                  <span>
                    Unassigned / Unpaired{' '}
                    {unassignedCount !== undefined ? (
                      <span style={{ fontSize: '0.74rem', color: '#fbbf24', fontWeight: 700, marginLeft: '0.35rem' }}>
                        ({unassignedCount} {unassignedCount === 1 ? 'student' : 'students'})
                      </span>
                    ) : (
                      '(No Mentor Assigned)'
                    )}
                  </span>
                </div>
                {value === 'UNASSIGNED' && <Check size={14} style={{ color: '#fbbf24' }} />}
              </div>
            )}

            {/* Matching Mentors */}
            {filteredMentors.length > 0 ? (
              filteredMentors.map((m) => {
                const isSelected = value === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelect(m.id)}
                    style={{
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                      color: isSelected ? '#93c5fd' : '#f8fafc',
                      fontSize: '0.84rem',
                      fontWeight: isSelected ? 700 : 500,
                      transition: 'background 0.15s ease',
                      marginBottom: '2px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = isSelected ? 'rgba(59, 130, 246, 0.18)' : 'transparent')
                    }
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <User size={13} style={{ color: isSelected ? '#60a5fa' : 'var(--text-muted)' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.name}
                        </span>
                        {m.studentCount !== undefined && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.1rem 0.45rem',
                            borderRadius: '10px',
                            backgroundColor: isSelected ? 'rgba(96, 165, 250, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                            color: isSelected ? '#93c5fd' : '#94a3b8',
                          }}>
                            ({m.studentCount} {m.studentCount === 1 ? 'student' : 'students'})
                          </span>
                        )}
                      </div>
                      {m.email && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingLeft: '1.25rem' }}>
                          {m.email}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />}
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                }}
              >
                No mentors found matching "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
