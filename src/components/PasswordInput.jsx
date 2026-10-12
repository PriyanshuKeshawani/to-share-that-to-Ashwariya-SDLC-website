import { useState, useRef, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Accessible, Production-Ready Password Input with Show/Hide Toggle
 * SISTEC Central Library Portal
 */
const PasswordInput = forwardRef(({
  id,
  name = 'password',
  value = '',
  onChange,
  onBlur,
  onFocus,
  placeholder = '••••••••••••',
  disabled = false,
  autoComplete = 'current-password',
  required = false,
  ariaLabel,
  ariaDescribedBy,
  className = 'glass-input',
  style = {},
  containerStyle = {},
  error = false,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef(null);

  // Combine forwarded ref and internal ref
  const setRefs = (element) => {
    inputRef.current = element;
    if (typeof ref === 'function') {
      ref(element);
    } else if (ref) {
      ref.current = element;
    }
  };

  const toggleVisibility = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPassword((prev) => !prev);
    // Maintain input focus seamlessly without altering caret position
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        ...containerStyle
      }}
    >
      <input
        ref={setRefs}
        id={id}
        name={name}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        required={required}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={error ? 'true' : 'false'}
        className={className}
        style={{
          width: '100%',
          paddingRight: '46px', // Room for the eye toggle
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          borderColor: error ? 'var(--danger, #ef4444)' : undefined,
          ...style
        }}
        {...props}
      />
      <button
        type="button"
        onClick={toggleVisibility}
        onMouseDown={(e) => {
          // Prevent blur on input when clicking toggle button
          e.preventDefault();
        }}
        disabled={disabled}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        title={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={0}
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: showPassword ? 'var(--primary, #3b82f6)' : 'var(--text-muted, #94a3b8)',
          borderRadius: '8px',
          opacity: disabled ? 0.4 : 0.85,
          transition: 'color 0.2s ease, opacity 0.2s ease',
          outline: 'none'
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          if (!disabled) e.currentTarget.style.opacity = '0.85';
        }}
      >
        {showPassword ? (
          <EyeOff size={18} strokeWidth={2} />
        ) : (
          <Eye size={18} strokeWidth={2} />
        )}
      </button>
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
