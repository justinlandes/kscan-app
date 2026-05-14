import { Stack } from 'expo-router';
import { PrivacyPreferencesProvider } from '../contexts/PrivacyPreferencesContext';

export default function Layout() {
  return (
    <PrivacyPreferencesProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </PrivacyPreferencesProvider>
  );
}
