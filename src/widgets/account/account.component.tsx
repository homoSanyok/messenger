import { CellAction, CellList, Typography } from '@maxhub/max-ui';
import { useId, useState } from 'react';

import { useLoginStore } from '../../app/services/login.service';
import { useNavigationStore } from '../../app/services/navigation.service';
import { CopyButton } from '../../shared/ui/copy-button/copy-button.component';
import { RightPanel } from '../../shared/ui/right-panel/right-panel.component';
import './account.style.css';

export function Account() {
  const titleId = useId();
  const [error, setError] = useState('');
  const idInstance = useLoginStore((state) => state.idInstance);
  const apiTokenInstance = useLoginStore((state) => state.apiTokenInstance);
  const logout = useLoginStore((state) => state.logout);

  const info = [
    { label: 'idInstance', value: idInstance },
    { label: 'apiTokenInstance', value: apiTokenInstance },
  ];

  return (
    <RightPanel id="settings-account-panel" title="Аккаунт" titleId={titleId}>
      <div className="right-panel__card account__credentials">
        {info.map(({ label, value }) => (
          <div className="account__credential" key={label}>
            <div className="account__credential-text">
              <Typography.Title className="account__credential-label">{label}</Typography.Title>
              <Typography.Text className="account__credential-value">{value || '—'}</Typography.Text>
            </div>
            <CopyButton value={value ?? ''} label={`Скопировать ${label}`} />
          </div>
        ))}
      </div>
      <CellList className="right-panel__card" mode="full-width">
        <CellAction
          type="button"
          mode="destructive"
          className="account__logout"
          onClick={() => {
            try {
              logout();
              useNavigationStore.getState().select('chat');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Не удалось выйти. Попробуйте снова.');
            }
          }}
        >
          <Typography.Action>Выйти из аккаунта</Typography.Action>
        </CellAction>
        {error && (
          <Typography.Label role="alert" className="account__error">
            {error}
          </Typography.Label>
        )}
      </CellList>
    </RightPanel>
  );
}
