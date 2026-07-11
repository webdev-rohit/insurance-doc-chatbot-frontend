import { useState } from 'react';

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
}

export function PasswordInput({ id, value, onChange, placeholder, autoComplete, invalid }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-group">
      <input
        className={`input${invalid ? ' input--invalid' : ''}`}
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="input-group__action"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
