import { Container, MaxUI } from '@maxhub/max-ui';
import { useLoginStore } from './app/services/login.service';
import { useNavigationStore } from './app/services/navigation.service';
import { useThemeStore } from './app/services/theme.service';
import { ChatsList } from './widgets/chats-list/chats-list.component';
import { Navigation } from './widgets/navigation/navigation.component';
import { Login } from './widgets/login/login.component';
import { Settings } from './widgets/settings/settings.component';
import { Theme } from './widgets/theme/theme.component';
import { Account } from './widgets/account/account.component';
import './App.css';

function App() {
  const selected = useNavigationStore((state) => state.selected);
  const settingsPage = useNavigationStore((state) => state.settingsPage);
  const theme = useThemeStore((state) => state.theme);
  const isLoggedIn = useLoginStore((state) => Boolean(state.idInstance && state.apiTokenInstance));

  return (
    <MaxUI colorScheme={theme}>
      {isLoggedIn ? (
        <Container fullWidth className="app-layout">
          <Navigation />
          {selected === 'chat' ? <ChatsList /> : <Settings />}
          {selected === 'settings' && settingsPage === 'theme' && <Theme />}
          {selected === 'settings' && settingsPage === 'account' && <Account />}
        </Container>
      ) : <Login />}
    </MaxUI>
  );
}

export default App;
