import { IconButton, Typography } from '@maxhub/max-ui';
import { useId, useRef, useState, type FormEvent } from 'react';

import './send-message.style.css';

interface SendMessageProps {
  disabled: boolean;
  sending: boolean;
  onSend: (text: string) => Promise<void>;
}

export function SendMessage({ disabled, sending, onSend }: SendMessageProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const errorId = useId();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || sending || submitting.current || !text.trim()) return;

    submitting.current = true;
    setError('');
    try {
      await onSend(text);
      setText('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось отправить сообщение. Попробуйте снова.');
    } finally {
      submitting.current = false;
    }
  };

  return (
    <div className="send-message">
      <form className="send-message__island" onSubmit={handleSubmit} aria-busy={sending}>
        <input
          className="send-message__input"
          name="message"
          aria-label="Сообщение"
          aria-describedby={error ? errorId : undefined}
          placeholder="Сообщение"
          autoComplete="off"
          maxLength={4000}
          value={text}
          disabled={disabled}
          readOnly={sending}
          onChange={(event) => {
            setText(event.target.value);
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault();
          }}
        />
        <IconButton
          type="submit"
          size="small"
          variant="primary"
          aria-label="Отправить сообщение"
          disabled={disabled || sending || !text.trim()}
        >
          <img src="assets/icons/arrow-up.svg" width={16} height={16} alt="" />
        </IconButton>
      </form>
      {error && (
        <Typography.Label id={errorId} role="alert" className="send-message__error">
          {error}
        </Typography.Label>
      )}
    </div>
  );
}
