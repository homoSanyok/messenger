import { IconButton } from '@maxhub/max-ui';
import { useEffect, useRef, useState } from 'react';

import './copy-button.style.css';

interface CopyButtonProps {
  value: string;
  label?: string;
}

export function CopyButton({ value, label = 'Скопировать' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setError('');
      setCopied(true);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setError('Не удалось скопировать. Попробуйте снова.');
    }
  }

  return (
    <span className="copy-button">
      <IconButton
        type="button"
        size="small"
        variant="ghost"
        aria-label={copied ? 'Скопировано' : label}
        title={error || (copied ? 'Скопировано' : label)}
        disabled={!value}
        onClick={handleCopy}
      >
        <span
          aria-hidden="true"
          className={`copy-button__icon${copied ? ' copy-button__icon--copied' : ''}`}
        />
      </IconButton>
      <span className="copy-button__status" role="status">
        {error || (copied ? 'Скопировано' : '')}
      </span>
    </span>
  );
}
