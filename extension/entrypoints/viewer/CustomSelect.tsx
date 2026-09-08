import { useState, useRef, useEffect } from 'preact/hooks';

export interface CustomSelectOption<T> {
  value: T;
  label: string;
  desc?: string;
  badge?: string;
  fontFamily?: string;
}

export interface CustomSelectProps<T> {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  style?: Record<string, any>;
  menuAlign?: 'left' | 'right';
}

export function CustomSelect<T extends string | number>({
  value,
  options,
  onChange,
  placeholder,
  className = '',
  style,
  menuAlign = 'left',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Nếu phía dưới còn ít hơn 210px và phía trên đủ chỗ, mở ngược lên trên
      setOpenUpward(spaceBelow < 210 && rect.top > 200);
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div
      ref={containerRef}
      class={`lt-custom-select-container ${className} ${isOpen ? 'is-open' : ''} ${openUpward ? 'open-upward' : ''}`}
      style={style}
    >
      <button
        type="button"
        class="lt-custom-select-btn"
        onClick={toggleDropdown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          class="lt-custom-select-label"
          style={selectedOption?.fontFamily ? { fontFamily: selectedOption.fontFamily } : undefined}
        >
          {selectedOption ? selectedOption.label : placeholder || 'Chọn...'}
        </span>
        <svg
          class={`lt-custom-select-chevron ${isOpen ? 'rotated' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          class={`lt-custom-select-menu lt-menu-align-${menuAlign} ${openUpward ? 'menu-upward' : ''}`}
          role="listbox"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={String(opt.value)}
                class={`lt-custom-select-item ${isSelected ? 'selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <div class="lt-custom-select-item-content">
                  <div
                    class="lt-custom-select-item-label"
                    style={opt.fontFamily ? { fontFamily: opt.fontFamily } : undefined}
                  >
                    {opt.badge && (
                      <span class={`lt-key-badge lt-key-badge-${opt.badge}`}>
                        {opt.badge}
                      </span>
                    )}
                    <span>{opt.label}</span>
                  </div>
                  {opt.desc && (
                    <div
                      class="lt-custom-select-item-desc"
                      style={opt.fontFamily ? { fontFamily: opt.fontFamily } : undefined}
                    >
                      {opt.desc}
                    </div>
                  )}
                </div>
                {isSelected && (
                  <svg
                    class="lt-custom-select-check"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#38bdf8"
                    stroke-width="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
