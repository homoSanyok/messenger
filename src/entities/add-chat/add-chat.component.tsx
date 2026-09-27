import { Button, Container, IconButton, Input, Typography } from '@maxhub/max-ui';
import { useId, useRef, useState, type SubmitEvent } from 'react';

import { useChatStore } from '../../app/services/chat.service';
import './add-chat.style.css';

export function AddChat() {
  const createChat = useChatStore((state) => state.createChat);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const phoneId = useId();
  const hintId = useId();
  const errorId = useId();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');

  const resetForm = () => {
    setPhoneNumber('');
    setError('');
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    createChat({ phoneNumber });
    dialogRef.current?.close();
  };

  return (
    <>
      <IconButton
        type="button"
        size="small"
        variant="primary"
        aria-label="Создать чат"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        <img src="assets/icons/plus.svg" width={16} height={16} alt="" />
      </IconButton>

      <Container asChild className="add-chat__dialog">
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          onClose={resetForm}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            ) {
              event.currentTarget.close();
            }
          }}
        >
          <Container asChild fullWidth className="add-chat__form">
            <form onSubmit={handleSubmit} noValidate>
              <Typography.Headline id={titleId}>Найти по номеру</Typography.Headline>

              <Container fullWidth className="add-chat__field">
                <Input
                  id={phoneId}
                  name="phoneNumber"
                  type="tel"
                  inputMode="tel"
                  placeholder="79998886655"
                  autoComplete="tel"
                  autoFocus
                  required
                  value={phoneNumber}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                  onChange={(event) => {
                    setPhoneNumber(event.target.value);
                    setError('');
                  }}
                />
                {error && (
                  <Typography.Label id={errorId} role="alert" className="add-chat__error">
                    {error}
                  </Typography.Label>
                )}
              </Container>

              <Container fullWidth className="add-chat__actions">
                <Button type="submit" disabled={!phoneNumber.trim()}>
                  <Typography.Action>Найти в MAX</Typography.Action>
                </Button>
              </Container>
            </form>
          </Container>
        </dialog>
      </Container>
    </>
  );
}
