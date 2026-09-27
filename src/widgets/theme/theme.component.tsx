import { CellList, CellSimple, Radio, Typography } from '@maxhub/max-ui';
import { useId } from 'react';

import { type Theme as ThemeValue, useThemeStore } from '../../app/services/theme.service';
import { RightPanel } from '../../shared/ui/right-panel/right-panel.component';
import './theme.style.css';

const themeOptions: { value: ThemeValue; label: string }[] = [
  { value: undefined, label: 'Системная' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'light', label: 'Светлая' },
];

export function Theme() {
  const titleId = useId();
  const groupName = useId();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <RightPanel id="settings-theme-panel" title="Оформление" titleId={titleId}>
      <CellList
        className="right-panel__card"
        mode="full-width"
        role="radiogroup"
        aria-labelledby={titleId}
      >
        {themeOptions.map((option) => {
          const value = option.value ?? 'system';
          const labelId = `${groupName}-${value}`;

          return (
            <CellSimple
              key={value}
              as="label"
              className="theme__option"
              title={<Typography.Body id={labelId}>{option.label}</Typography.Body>}
              before={
                <Radio
                  name={groupName}
                  value={value}
                  checked={theme === option.value}
                  aria-labelledby={labelId}
                  onChange={() => setTheme(option.value)}
                />
              }
            />
          );
        })}
      </CellList>
    </RightPanel>
  );
}
