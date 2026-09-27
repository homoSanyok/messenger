import { Container, IconButton, Typography, type IconButtonProps } from '@maxhub/max-ui';
import { useId } from 'react';

import '@maxhub/max-ui/styles.css';
import './tool-button.style.css';

export interface ToolButtonProps extends Omit<IconButtonProps, 'children' | 'variant' | 'asChild'> {
  icon: string;
  children: string;
  selected?: boolean;
}

function ToolButtonIcon({ src }: { src: string }) {
  const maskImage = `url("${src}")`;

  return <span className="tool-button__icon" aria-hidden="true" style={{ WebkitMaskImage: maskImage, maskImage }} />;
}

export function ToolButton({ icon, children, selected = false, className, ...props }: ToolButtonProps) {
  const labelId = useId();

  return (
    <Container fullWidth className={selected ? 'tool-button tool-button--selected' : 'tool-button'}>
      <IconButton
        type="button"
        size="small"
        aria-labelledby={labelId}
        {...props}
        aria-pressed={selected}
        variant="ghost"
        className={['tool-button__button', className].join(' ')}
      >
        <ToolButtonIcon src={icon} />
      </IconButton>
      <Typography.Text id={labelId} variant="label" color="inherit" className="tool-button__label">
        {children}
      </Typography.Text>
    </Container>
  );
}
