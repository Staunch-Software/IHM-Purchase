import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./Select.module.css";

/**
 * A custom premium select dropdown to replace the native OS <select>.
 * 
 * @param {string} value The currently selected value
 * @param {function} onChange Callback when an option is selected: (value) => void
 * @param {Array<{value: string, label: string}>} options Array of option objects
 * @param {React.ReactNode} [icon] Optional icon to display on the left
 * @param {string} [className] Additional class names for the trigger button
 * @param {boolean} [isActive] Whether the select should be styled as "active" (e.g. filter applied)
 */
export function Select({ value, onChange, options, icon, className = "", isActive = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
  };

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isActive ? styles.active : ""} ${isOpen ? styles.open : ""} ${className}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.label}>{selectedOption?.label}</span>
        <ChevronDown size={14} strokeWidth={2} className={styles.chevron} />
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.option} ${option.value === value ? styles.selected : ""}`}
              onClick={() => handleSelect(option.value)}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
