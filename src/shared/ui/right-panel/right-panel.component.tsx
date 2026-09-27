import { Container, Typography } from '@maxhub/max-ui';
import { type ReactNode } from 'react';

import './right-panel.style.css';

interface RightPanelProps {
  id: string;
  title: string;
  titleId: string;
  children: ReactNode;
  header?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function RightPanel({ id, title, titleId, children, header, className, contentClassName }: RightPanelProps) {
  return (
    <Container asChild fullWidth className={['right-panel', className].filter(Boolean).join(' ')}>
      <section id={id} aria-labelledby={titleId}>
        <Container asChild fullWidth className="right-panel__header">
          <header>
            {header ?? <Typography.Action id={titleId}>{title}</Typography.Action>}
          </header>
        </Container>
        <div className="right-panel__divider" />

        <div className={['right-panel__content', contentClassName].filter(Boolean).join(' ')}>{children}</div>
      </section>
    </Container>
  );
}
