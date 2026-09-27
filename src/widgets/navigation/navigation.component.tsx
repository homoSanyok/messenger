import { Container } from '@maxhub/max-ui';

import { useNavigationStore } from '../../app/services/navigation.service';
import { ToolButton } from '../../shared/ui/tool-button/tool-button.component';
import './navigation.style.css';

export function Navigation() {
  const selected = useNavigationStore((state) => state.selected);
  const select = useNavigationStore((state) => state.select);

  return (
    <Container asChild fullWidth className="navigation">
      <nav aria-label="Основная навигация">
        <ToolButton
          icon="assets/icons/bubble-message-text.svg"
          selected={selected === 'chat'}
          onClick={() => select('chat')}
        >
          Все
        </ToolButton>
        <ToolButton
          icon="assets/icons/gear-8-edge.svg"
          selected={selected === 'settings'}
          onClick={() => select('settings')}
        >
          Настройки
        </ToolButton>
      </nav>
    </Container>
  );
}
