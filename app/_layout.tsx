import { Stack } from 'expo-router';
import { PrivacyBootstrap } from '../components/PrivacyBootstrap';

export default function Layout() {
  return (
    <>
      <PrivacyBootstrap />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
