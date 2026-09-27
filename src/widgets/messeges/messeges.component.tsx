import { Avatar, Button, IconButton, Spinner, Typography } from '@maxhub/max-ui';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { type Chat, useChatStore } from '../../app/services/chat.service';
import { useLoginStore } from '../../app/services/login.service';
import { useMessagesStore } from '../../app/services/messages.service';
import { SendMessage } from '../../entities/send-message/send-message.component';
import { Message } from '../../shared/ui/message/message.component';
import { RightPanel } from '../../shared/ui/right-panel/right-panel.component';
import './messeges.style.css';

export function Messages({ chat }: { chat: Chat }) {
  const titleId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [retry, setRetry] = useState(0);
  const idInstance = useLoginStore((state) => state.idInstance);
  const apiTokenInstance = useLoginStore((state) => state.apiTokenInstance);
  const selectChat = useChatStore((state) => state.selectChat);
  const history = useMessagesStore((state) => state.byChat[chat.id]);
  const loadHistory = useMessagesStore((state) => state.loadHistory);
  const sendMessage = useMessagesStore((state) => state.sendMessage);
  const syncing = !history || history.status === 'syncing';

  useLayoutEffect(
    () => loadHistory(chat.id),
    [chat.id, idInstance, apiTokenInstance, retry, loadHistory],
  );

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [history?.messages, history?.status]);

  return (
    <RightPanel
      id="chat-messages-panel"
      title={chat.title}
      titleId={titleId}
      className="messages"
      contentClassName="messages__content"
      header={
        <div className="messages__header">
          <IconButton
            type="button"
            size="small"
            variant="ghost"
            aria-label="Назад к чатам"
            onClick={() => selectChat(null)}
          >
            <img src="assets/icons/arrow-left.svg" width={16} height={16} alt="" />
          </IconButton>
          <Avatar.Container size={32}>
            <Avatar.Text>
              <Typography.Label>{chat.phoneNumber ? chat.phoneNumber.slice(-2) : chat.title.slice(0, 2)}</Typography.Label>
            </Avatar.Text>
          </Avatar.Container>
          <Typography.Action id={titleId} className="messages__title">
            {chat.title}
          </Typography.Action>
        </div>
      }
    >
      <div className="messages__history" ref={listRef} aria-busy={syncing}>
        {syncing ? (
          <div className="messages__status" role="status" aria-label="Синхронизация сообщений">
            <Spinner />
          </div>
        ) : history.status === 'error' ? (
          <div className="messages__status">
            <Typography.Label role="alert">{history.error}</Typography.Label>
            <Button type="button" onClick={() => setRetry((current) => current + 1)}>
              Повторить
            </Button>
          </div>
        ) : (
          <div
            className="messages__list"
            role="log"
            aria-label="Сообщения"
            aria-live="polite"
            aria-relevant="additions"
          >
            {history.messages.map((message) => (
              <Message key={message.id} text={message.text} outgoing={message.direction === 'outgoing'} />
            ))}
          </div>
        )}
      </div>
      <SendMessage
        disabled={syncing || history?.status !== 'ready'}
        sending={history?.sending ?? false}
        onSend={(text) => sendMessage(chat.id, text)}
      />
    </RightPanel>
  );
}
