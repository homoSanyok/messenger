import { CellAction, CellList, Container, Typography, useColorScheme } from '@maxhub/max-ui';
import { useId, useState } from 'react';

import { type SettingsPage, useNavigationStore } from '../../app/services/navigation.service';
import './settings.style.css';

const settingsItems: { id: SettingsPage; label: string }[] = [
  { id: 'theme', label: 'Оформление' },
  { id: 'account', label: 'Аккаунт' },
];

export function Settings() {
  const titleId = useId();
  const colorScheme = useColorScheme();
  const [pressedItem, setPressedItem] = useState<SettingsPage | null>(null);
  const settingsPage = useNavigationStore((state) => state.settingsPage);
  const selectSettingsPage = useNavigationStore((state) => state.selectSettingsPage);
  const clearPressedItem = (id: SettingsPage) => {
    setPressedItem((current) => (current === id ? null : current));
  };

  return (
    <Container asChild fullWidth className="settings">
      <section aria-labelledby={titleId} data-color-scheme={colorScheme}>
        <Container asChild fullWidth className="settings__header">
          <header>
            <Typography.Display id={titleId}>Настройки</Typography.Display>
          </header>
        </Container>

        <Container className="settings__divider" aria-hidden="true" />

        <CellList className="settings__items" mode="full-width" role="list">
          {settingsItems.map((item) => (
            <Container key={item.id} fullWidth role="listitem">
              <CellAction
                type="button"
                mode="primary"
                showChevron
                className={[
                  'settings__item',
                  settingsPage === item.id && 'settings__item--selected',
                  pressedItem === item.id && 'settings__item--pressed',
                ].filter(Boolean).join(' ')}
                aria-pressed={settingsPage === item.id}
                aria-expanded={settingsPage === item.id}
                aria-controls={settingsPage === item.id ? `settings-${item.id}-panel` : undefined}
                onClick={() => selectSettingsPage(item.id)}
                onPointerDown={(event) => {
                  if (event.button === 0) setPressedItem(item.id);
                }}
                onPointerUp={() => clearPressedItem(item.id)}
                onPointerLeave={() => clearPressedItem(item.id)}
                onPointerCancel={() => clearPressedItem(item.id)}
                onLostPointerCapture={() => clearPressedItem(item.id)}
                onKeyDown={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') setPressedItem(item.id);
                }}
                onKeyUp={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') clearPressedItem(item.id);
                }}
                onBlur={() => clearPressedItem(item.id)}
              >
                <Typography.Action className="settings__action">{item.label}</Typography.Action>
              </CellAction>
            </Container>
          ))}
        </CellList>
      </section>
    </Container>
  );
}
