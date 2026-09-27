import { Button, Container, Input, Typography } from '@maxhub/max-ui';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { useLoginStore } from '../../app/services/login.service';
import './login.style.css';

export function Login() {
  const login = useLoginStore((state) => state.login);
  const titleId = useId();
  const instanceId = useId();
  const tokenId = useId();
  const errorId = useId();
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      login({ idInstance, apiTokenInstance });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось войти. Попробуйте снова.');
    }
  };

  return (
    <Container asChild fullWidth className="login">
      <main aria-labelledby={titleId}>
        <Container asChild fullWidth className="login__card">
          <form onSubmit={handleSubmit} noValidate>
            <Typography.Headline id={titleId}>Вход в аккаунт</Typography.Headline>

            <Container fullWidth className="login__field">
              <label htmlFor={instanceId}><Typography.Label>idInstance</Typography.Label></label>
              <Input
                id={instanceId}
                name="idInstance"
                autoComplete="username"
                placeholder="idInstance"
                autoFocus
                required
                value={idInstance}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => {
                  setIdInstance(event.target.value);
                  setError('');
                }}
              />
            </Container>

            <Container fullWidth className="login__field">
              <label htmlFor={tokenId}><Typography.Label>apiTokenInstance</Typography.Label></label>
              <Input
                id={tokenId}
                name="apiTokenInstance"
                type="password"
                autoComplete="current-password"
                placeholder="apiTokenInstance"
                required
                value={apiTokenInstance}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => {
                  setApiTokenInstance(event.target.value);
                  setError('');
                }}
              />
            </Container>

            {error && <Typography.Label id={errorId} role="alert" className="login__error">{error}</Typography.Label>}

            <Container fullWidth className="login__actions">
              <Button type="submit" disabled={!idInstance.trim() || !apiTokenInstance.trim()}>
                <Typography.Action>Войти</Typography.Action>
              </Button>
            </Container>
          </form>
        </Container>
      </main>
    </Container>
  );
}
