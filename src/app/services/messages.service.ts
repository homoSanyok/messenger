import { create } from 'zustand';

import { useChatStore } from './chat.service';
import { useLoginStore } from './login.service';

export interface Message {
  id: string;
  chatId: string;
  text: string;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
}

interface Credentials {
  idInstance: string;
  apiTokenInstance: string;
}

interface ChatMessages {
  apiChatId: string | null;
  messages: Message[];
  pendingMessages: Message[];
  status: 'syncing' | 'ready' | 'error';
  sending: boolean;
  error: string | null;
}

interface MessagesState {
  byChat: Record<string, ChatMessages>;
  notificationError: string | null;
  startNotifications: () => () => void;
  loadHistory: (chatId: string) => () => void;
  sendMessage: (chatId: string, text: string) => Promise<void>;
}

interface HistoryPage {
  messages: Message[];
  ids: Set<string>;
}

const API_URL = 'https://3100.api.green-api.com';
const HISTORY_COUNT = 20;
const RECEIVE_TIMEOUT = 5;
const NOTIFICATION_INTERVAL = 100;
const RETRY_INTERVAL = 1000;
const REQUEST_TIMEOUT = 30_000;
const chatIds = new Map<string, string>();
const historyLoads = new Map<string, AbortController>();
let stopNotifications: (() => void) | undefined;
const sends = new Map<string, AbortController>();
let sessionVersion = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getCredentials(): Credentials {
  const { idInstance, apiTokenInstance } = useLoginStore.getState();
  if (!idInstance || !apiTokenInstance) throw new Error('Войдите в аккаунт, чтобы открыть чат.');
  return { idInstance, apiTokenInstance };
}

async function request(
  credentials: Credentials,
  method: 'checkAccount' | 'getChatHistory' | 'receiveNotification' | 'deleteNotification' | 'sendMessage',
  signal: AbortSignal,
  body?: Record<string, unknown>,
  query?: Record<string, string>,
  receiptId?: number,
): Promise<unknown> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, REQUEST_TIMEOUT);
  const { idInstance, apiTokenInstance } = credentials;
  const suffix = receiptId === undefined ? '' : `/${receiptId}`;
  const search = query ? `?${new URLSearchParams(query)}` : '';

  try {
    const response = await fetch(
      `${API_URL}/waInstance${encodeURIComponent(idInstance)}/${method}/${encodeURIComponent(apiTokenInstance)}${suffix}${search}`,
      {
        method: method === 'deleteNotification' ? 'DELETE' : body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('GREEN-API отклонил запрос. Проверьте данные входа и доступ к инстансу.');
      }
      if (response.status === 400 && (method === 'receiveNotification' || method === 'deleteNotification')) {
        const details = await response.text();
        if (details.includes('custom webhook url is set')) {
          throw new Error('Очистите webhookUrl в настройках инстанса GREEN-API и подождите около минуты.');
        }
      }
      if (response.status === 429) throw new Error('Слишком много запросов к GREEN-API. Повторите чуть позже.');
      throw new Error(`Не удалось выполнить ${method} (HTTP ${response.status}).`);
    }

    const responseText = await response.text();
    const data: unknown = method === 'receiveNotification' && !responseText.trim()
      ? null
      : JSON.parse(responseText);
    signal.throwIfAborted();
    return data;
  } catch (cause) {
    signal.throwIfAborted();
    if (controller.signal.aborted) throw new Error('GREEN-API не ответил за 30 секунд. Попробуйте снова.');
    if (cause instanceof TypeError) throw new Error('Не удалось связаться с GREEN-API. Проверьте соединение.');
    if (cause instanceof SyntaxError) throw new Error('GREEN-API вернул некорректный ответ.');
    throw cause;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

function normalizePhoneNumber(value: string | number) {
  return String(value).replace(/\D/g, '');
}

async function resolveChatId(credentials: Credentials, phoneNumber: string, signal: AbortSignal) {
  const phone = normalizePhoneNumber(phoneNumber);
  const key = `messenger.chat-id.${encodeURIComponent(credentials.idInstance)}.${phone}`;
  const cached = chatIds.get(key);
  if (cached) return cached;

  try {
    const stored = sessionStorage.getItem(key);
    if (stored && /^-?\d+$/.test(stored)) {
      chatIds.set(key, stored);
      return stored;
    }
  } catch {
    // Keep the in-memory session cache available if browser storage is blocked.
  }

  const data = await request(credentials, 'checkAccount', signal, { phoneNumber: Number(phone) });
  if (!isRecord(data) || typeof data.exist !== 'boolean') {
    throw new Error('GREEN-API не смог проверить аккаунт. Проверьте авторизацию инстанса и повторите позже.');
  }
  if (!data.exist) throw new Error('Для этого номера не найден аккаунт MAX.');
  if (typeof data.chatId !== 'string' || !/^-?\d+$/.test(data.chatId)) {
    throw new Error('GREEN-API вернул некорректный идентификатор чата.');
  }

  const chatId = data.chatId;
  signal.throwIfAborted();
  chatIds.set(key, chatId);
  try {
    sessionStorage.setItem(key, chatId);
  } catch {
    // The ID is still cached for subsequent openings in this running session.
  }
  return chatId;
}

function parseMessage(value: unknown, chatId: string): Message | null {
  if (
    !isRecord(value) ||
    typeof value.idMessage !== 'string' ||
    (value.type !== 'incoming' && value.type !== 'outgoing') ||
    typeof value.timestamp !== 'number' ||
    !Number.isFinite(value.timestamp) ||
    value.chatId !== chatId
  )
    return null;

  const extended = isRecord(value.extendedTextMessage) ? value.extendedTextMessage.text : undefined;
  const text = value.isDeleted === true
    ? 'Сообщение удалено'
    : typeof value.textMessage === 'string' ? value.textMessage : extended;
  if (typeof text !== 'string') return null;

  const date = new Date(value.timestamp * 1000);
  if (Number.isNaN(date.getTime())) return null;

  return {
    id: value.idMessage,
    chatId,
    text,
    direction: value.type,
    createdAt: date.toISOString(),
  };
}

function parseHistory(entries: unknown[], chatId: string): HistoryPage {
  const ids = new Set<string>();
  const messages = new Map<string, Message>();
  for (const entry of entries) {
    if (!isRecord(entry) || entry.chatId !== chatId) continue;
    if (typeof entry.idMessage === 'string') ids.add(entry.idMessage);
    const message = parseMessage(entry, chatId);
    if (message) messages.set(message.id, message);
  }

  return {
    messages: [...messages.values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .slice(-HISTORY_COUNT),
    ids,
  };
}

async function getHistory(credentials: Credentials, chatId: string, signal: AbortSignal): Promise<HistoryPage> {
  const data = await request(credentials, 'getChatHistory', signal, { chatId, count: HISTORY_COUNT });
  if (!Array.isArray(data)) throw new Error('GREEN-API вернул некорректную историю чата.');
  return parseHistory(data, chatId);
}

function mergeMessages(...pages: Message[][]): Message[] {
  const messages = new Map<string, Message>();
  for (const page of pages) {
    for (const message of page) messages.set(message.id, message);
  }
  return [...messages.values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(-HISTORY_COUNT);
}

function emptyChat(apiChatId: string | null = null): ChatMessages {
  return { apiChatId, messages: [], pendingMessages: [], status: 'syncing', sending: false, error: null };
}

function parseNotification(body: Record<string, unknown>) {
  if (!['incomingMessageReceived', 'outgoingMessageReceived', 'outgoingAPIMessageReceived'].includes(String(body.typeWebhook))) {
    // Delivery statuses and account events do not contain messages for the chat UI.
    return null;
  }
  const sender = body.senderData;
  const data = body.messageData;
  if (!isRecord(sender) || typeof sender.chatId !== 'string' || !/^-?\d+$/.test(sender.chatId) ||
      !isRecord(data) || typeof data.typeMessage !== 'string' ||
      typeof body.idMessage !== 'string' || !body.idMessage ||
      typeof body.timestamp !== 'number' || !Number.isFinite(body.timestamp)) {
    throw new Error('GREEN-API вернул некорректное уведомление о сообщении.');
  }

  let id = body.idMessage;
  let text: unknown;
  let isUpdate = false;
  switch (data.typeMessage) {
    case 'textMessage':
      text = isRecord(data.textMessageData) ? data.textMessageData.textMessage : undefined;
      break;
    case 'extendedTextMessage':
      text = isRecord(data.extendedTextMessageData) ? data.extendedTextMessageData.text : undefined;
      break;
    case 'editedMessage':
    case 'deletedMessage': {
      const update = data.typeMessage === 'editedMessage' ? data.editedMessageData : data.deletedMessageData;
      if (!isRecord(update) || typeof update.stanzaId !== 'string' || !update.stanzaId) {
        throw new Error('GREEN-API вернул некорректное изменение сообщения.');
      }
      id = update.stanzaId;
      text = data.typeMessage === 'deletedMessage' ? 'Сообщение удалено' : update.textMessage;
      isUpdate = true;
      break;
    }
    default: {
      const labels: Record<string, string> = {
        imageMessage: 'Изображение', videoMessage: 'Видео', audioMessage: 'Аудио',
        documentMessage: 'Документ', stickerMessage: 'Стикер', locationMessage: 'Геолокация',
        contactMessage: 'Контакт', pollMessage: 'Опрос', reactionMessage: 'Реакция на сообщение',
      };
      const caption = isRecord(data.fileMessageData) ? data.fileMessageData.caption : undefined;
      text = typeof caption === 'string' && caption ? caption : labels[data.typeMessage] ?? 'Неподдерживаемый тип сообщения';
    }
  }
  const date = new Date(body.timestamp * 1000);
  if (typeof text !== 'string' || Number.isNaN(date.getTime())) {
    throw new Error('GREEN-API вернул некорректное содержимое сообщения.');
  }
  const rawPhone = sender.chatType === 'user' &&
    (typeof sender.senderPhoneNumber === 'string' || typeof sender.senderPhoneNumber === 'number')
    ? normalizePhoneNumber(sender.senderPhoneNumber) : '';
  const phone = /^[1-9]\d{6,14}$/.test(rawPhone) ? `+${rawPhone}` : '';
  const message: Message = {
    id, chatId: sender.chatId, text,
    direction: body.typeWebhook === 'incomingMessageReceived' ? 'incoming' : 'outgoing',
    createdAt: date.toISOString(),
  };
  return { message, phone, title: typeof sender.chatName === 'string' ? sender.chatName : '', isUpdate };
}

export const useMessagesStore = create<MessagesState>((set, get) => {
  const updateChat = (chatId: string, state: ChatMessages) => {
    set((current) => ({ byChat: { ...current.byChat, [chatId]: state } }));
  };

  const processNotification = (body: Record<string, unknown>) => {
    const notification = parseNotification(body);
    if (!notification) return;
    const { message, phone, title, isUpdate } = notification;
    const chat = useChatStore.getState().upsertNotificationChat(message.chatId, phone, title);
    const current = get().byChat[chat.id] ?? emptyChat(message.chatId);
    const previous = current.messages.find((item) => item.id === message.id);
    const updated = isUpdate && previous
      ? { ...previous, text: message.text }
      : message;
    const messages = mergeMessages(current.messages, [updated]);
    updateChat(chat.id, {
      ...current, apiChatId: message.chatId, messages,
      pendingMessages: mergeMessages(current.pendingMessages, [updated]),
    });
    useChatStore.getState().setLastMessage(chat.id, messages[messages.length - 1]?.text ?? '');
  };

  return {
    byChat: {},
    notificationError: null,
    startNotifications: () => {
      stopNotifications?.();
      const controller = new AbortController();
      const version = sessionVersion;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let failures = 0;
      const active = () => !controller.signal.aborted && version === sessionVersion;
      const stop = () => {
        controller.abort();
        clearTimeout(timer);
        if (stopNotifications === stop) stopNotifications = undefined;
      };
      stopNotifications = stop;

      const receive = async () => {
        if (!active()) return;
        let delay = NOTIFICATION_INTERVAL;
        try {
          const credentials = getCredentials();
          const data = await request(credentials, 'receiveNotification', controller.signal, undefined, {
            receiveTimeout: String(RECEIVE_TIMEOUT),
          });
          if (!active()) return;
          if (data !== null) {
            if (!isRecord(data) || typeof data.receiptId !== 'number' || !Number.isSafeInteger(data.receiptId) ||
                data.receiptId < 0 || !isRecord(data.body) || typeof data.body.typeWebhook !== 'string') {
              throw new Error('GREEN-API вернул некорректное уведомление.');
            }
            processNotification(data.body);
            // A processing failure leaves the notification in the queue for retry.
            const deleted = await request(credentials, 'deleteNotification', controller.signal, undefined, undefined, data.receiptId);
            if (!isRecord(deleted) || deleted.result !== true) {
              throw new Error('Не удалось подтвердить обработку уведомления. Повторяем получение.');
            }
          }
          if (!active()) return;
          failures = 0;
          set({ notificationError: null });
        } catch (cause) {
          if (!active()) return;
          delay = Math.min(RETRY_INTERVAL * 2 ** Math.min(failures++, 6), 60_000);
          set({ notificationError: cause instanceof Error ? cause.message : 'Не удалось получить уведомления.' });
        } finally {
          // Sequential receive → process → delete, with a cap of 10 cycles per second.
          if (active()) timer = setTimeout(() => void receive(), delay);
        }
      };
      // Deferring the first request also avoids duplicate requests on StrictMode mount.
      timer = setTimeout(() => void receive(), 0);
      return stop;
    },
    loadHistory: (chatId) => {
      historyLoads.get(chatId)?.abort();
      const controller = new AbortController();
      const version = sessionVersion;
      historyLoads.set(chatId, controller);
      const active = () => !controller.signal.aborted && version === sessionVersion;
      const current = get().byChat[chatId] ?? emptyChat();
      updateChat(chatId, { ...current, status: 'syncing', error: null, sending: sends.has(chatId) });

      const load = async () => {
        try {
          const credentials = getCredentials();
          const chat = useChatStore.getState().chats.find((item) => item.id === chatId);
          if (!chat) throw new Error('Выбранный чат не найден.');
          const apiChatId = chat.apiChatId ?? await resolveChatId(credentials, chat.phoneNumber, controller.signal);
          if (!active()) return;
          useChatStore.getState().setApiChatId(chatId, apiChatId);
          const page = await getHistory(credentials, apiChatId, controller.signal);
          if (!active()) return;
          const latest = get().byChat[chatId];
          const messages = mergeMessages(page.messages, latest.pendingMessages);
          updateChat(chatId, {
            ...latest, apiChatId, messages,
            pendingMessages: latest.pendingMessages.filter((message) => !page.ids.has(message.id)),
            status: 'ready', error: null,
          });
          useChatStore.getState().setLastMessage(chatId, messages[messages.length - 1]?.text ?? '');
        } catch (cause) {
          if (!active()) return;
          updateChat(chatId, {
            ...get().byChat[chatId], status: 'error',
            error: cause instanceof Error ? cause.message : 'Не удалось загрузить сообщения.',
          });
        } finally {
          if (historyLoads.get(chatId) === controller) historyLoads.delete(chatId);
        }
      };
      const timer = setTimeout(() => void load(), 0);
      return () => {
        clearTimeout(timer);
        controller.abort();
        if (historyLoads.get(chatId) === controller) historyLoads.delete(chatId);
        // Keep received messages when switching chats: they have already been acknowledged.
      };
    },
    sendMessage: async (chatId, value) => {
      const text = value.trim();
      if (!text) return;
      if (text.length > 4000) throw new Error('Сообщение должно быть не длиннее 4000 символов.');
      const credentials = getCredentials();
      const chat = get().byChat[chatId];
      if (!chat || chat.status !== 'ready' || !chat.apiChatId || sends.has(chatId)) {
        throw new Error('Дождитесь загрузки сообщений и попробуйте снова.');
      }
      const version = sessionVersion;
      const controller = new AbortController();
      sends.set(chatId, controller);
      updateChat(chatId, { ...chat, sending: true });
      try {
        const data = await request(credentials, 'sendMessage', controller.signal, {
          chatId: chat.apiChatId, message: text, typingTime: 1000,
        });
        if (!isRecord(data) || typeof data.idMessage !== 'string' || !data.idMessage) {
          throw new Error('GREEN-API не подтвердил отправку сообщения.');
        }
        if (version !== sessionVersion || controller.signal.aborted) return;
        const current = get().byChat[chatId];
        // The outgoing notification can arrive before the send response.
        if (current.messages.some((message) => message.id === data.idMessage)) return;
        const message: Message = {
          id: data.idMessage, chatId: chat.apiChatId, text,
          direction: 'outgoing', createdAt: new Date().toISOString(),
        };
        const messages = mergeMessages(current.messages, [message]);
        updateChat(chatId, {
          ...current, messages,
          pendingMessages: mergeMessages(current.pendingMessages, [message]),
        });
        useChatStore.getState().setLastMessage(chatId, messages[messages.length - 1]?.text ?? '');
      } finally {
        if (sends.get(chatId) === controller) sends.delete(chatId);
        const current = get().byChat[chatId];
        if (version === sessionVersion && current) updateChat(chatId, { ...current, sending: false });
      }
    },
  };
});

useLoginStore.subscribe((state, previous) => {
  if (state.idInstance !== previous.idInstance || state.apiTokenInstance !== previous.apiTokenInstance) {
    sessionVersion += 1;
    stopNotifications?.();
    historyLoads.forEach((controller) => controller.abort());
    sends.forEach((controller) => controller.abort());
    historyLoads.clear();
    sends.clear();
    chatIds.clear();
    useMessagesStore.setState({ byChat: {}, notificationError: null });
  }
});
