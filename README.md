# Получение уведомлений GREEN-API

После входа приложение последовательно вызывает `ReceiveNotification` с `receiveTimeout=5`,
обрабатывает уведомление и подтверждает его через `DeleteNotification` с полученным `receiptId`.
Пустое тело ответа и JSON `null` означают, что уведомлений пока нет.
Получатель работает на уровне аккаунта, в том числе при закрытом чате и на странице настроек.
При выходе или смене учётных данных запросы отменяются.

## Настройка инстанса

В [личном кабинете GREEN-API](https://console.green-api.com/) настройте:

- `webhookUrl`: пустая строка. После очистки ранее заданного URL подождите около минуты.
- `incomingWebhook`: `yes` для входящих сообщений.
- `outgoingMessageWebhook` и `outgoingAPIMessageWebhook`: `yes` для сообщений,
  отправленных с телефона и через API.
- `editedMessageWebhook` и `deletedMessageWebhook`: `yes`, если нужны изменения и удаления сообщений.

Приложение использует API URL `https://3100.api.green-api.com`, заданный в
`src/app/services/messages.service.ts`. Он должен соответствовать инстансу.

[Документация HTTP API](https://green-api.com/v3/docs/api/receiving/technology-http-api/)

## Поведение приложения

- История последних 20 сообщений загружается при открытии чата через `GetChatHistory`.
  Новые сообщения поступают из очереди; периодического опроса журналов больше нет.
- Уведомления обновляют сообщения и превью закрытых чатов, добавляют новых собеседников
  и группы. Чат без доступного номера телефона открывается по `chatId`.
- Повторная доставка не добавляет дубликат сообщения. При ошибке обработки уведомление
  остаётся в очереди. Ошибки запросов запускают повторные попытки с задержкой до минуты.
- Файлы и другие нетекстовые сообщения показываются подписью или названием типа.
  Сервисные уведомления и статусы подтверждаются без добавления в переписку.
- Сообщения хранятся в памяти текущей сессии приложения; при перезагрузке история
  запрашивается заново. Список чатов сохраняется в `sessionStorage`.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
