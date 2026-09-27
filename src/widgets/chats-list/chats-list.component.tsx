import { Avatar, CellList, CellSimple, Container, Typography, useColorScheme } from '@maxhub/max-ui';
import { useId, useState } from 'react';

import { useChatStore } from '../../app/services/chat.service';
import { AddChat } from '../../entities/add-chat/add-chat.component';
import { Messages } from '../messeges/messeges.component';
import './chats-list.style.css';

export function ChatsList() {
  const colorScheme = useColorScheme();
  const chats = useChatStore((state) => state.chats);
  const [pressedChatId, setPressedChatId] = useState<(typeof chats)[number]['id'] | null>(null);
  const selectedChat = useChatStore((state) => state.selectedChat);
  const selectChat = useChatStore((state) => state.selectChat);
  const titleId = useId();
  const clearPressedChat = (chatId: (typeof chats)[number]['id']) => {
    setPressedChatId((currentChatId) => (currentChatId === chatId ? null : currentChatId));
  };

  return (
    <>
    <Container asChild fullWidth className="chats-list">
      <section aria-labelledby={titleId} data-color-scheme={colorScheme}>
        <Container asChild fullWidth className="chats-list__header">
          <header>
            <Typography.Display id={titleId}>Чаты</Typography.Display>
            <AddChat />
          </header>
        </Container>

        <Container className="chats-list__divider" aria-hidden="true" />

        <CellList className="chats-list__items" mode="full-width" role="list">
          {chats.map((chat) => (
            <Container key={chat.id} fullWidth role="listitem">
              <CellSimple
                asChild
                className={[
                  'chats-list__chat',
                  selectedChat?.id === chat.id && 'chats-list__chat--selected',
                  pressedChatId === chat.id && 'chats-list__chat--pressed',
                ].join(' ')}
                title={<Typography.Body>{chat.title}</Typography.Body>}
                subtitle={chat.lastMessage ? <Typography.Label>{chat.lastMessage}</Typography.Label> : undefined}
                before={
                  <Avatar.Container size={56}>
                    <Avatar.Text>
                      <Typography.Body>{chat.phoneNumber.slice(-2)}</Typography.Body>
                    </Avatar.Text>
                  </Avatar.Container>
                }
              >
                <button
                  type="button"
                  aria-pressed={selectedChat?.id === chat.id}
                  aria-controls={selectedChat?.id === chat.id ? 'chat-messages-panel' : undefined}
                  aria-expanded={selectedChat?.id === chat.id}
                  onClick={() => selectChat(chat)}
                  onPointerDown={(event) => {
                    if (event.button === 0) setPressedChatId(chat.id);
                  }}
                  onPointerUp={() => clearPressedChat(chat.id)}
                  onPointerLeave={() => clearPressedChat(chat.id)}
                  onPointerCancel={() => clearPressedChat(chat.id)}
                  onLostPointerCapture={() => clearPressedChat(chat.id)}
                  onKeyDown={(event) => {
                    if (event.key === ' ' || event.key === 'Enter') setPressedChatId(chat.id);
                  }}
                  onKeyUp={(event) => {
                    if (event.key === ' ' || event.key === 'Enter') clearPressedChat(chat.id);
                  }}
                  onBlur={() => clearPressedChat(chat.id)}
                />
              </CellSimple>
            </Container>
          ))}
        </CellList>
      </section>
    </Container>
    {selectedChat && <Messages key={selectedChat.id} chat={selectedChat} />}
    </>
  );
}
