import { Typography } from '@maxhub/max-ui';

import './message.style.css';

interface MessageProps {
  text: string;
  outgoing: boolean;
}

export function Message({ text, outgoing }: MessageProps) {
  return (
    <div className={outgoing ? 'message message--outgoing' : 'message'}>
      <Typography.Body className="message__text">{text}</Typography.Body>
    </div>
  );
}
