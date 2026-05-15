import { Stack } from 'expo-router';
import { AuthSessionProvider } from '../contexts/AuthSessionContext';
import { PrivacyPreferencesProvider } from '../contexts/PrivacyPreferencesContext';

export default function Layout() {
  return (
    <AuthSessionProvider>
      <PrivacyPreferencesProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </PrivacyPreferencesProvider>
    </AuthSessionProvider>
  );
}
