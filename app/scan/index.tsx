import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function ScanScreen() {
  return (
    <View testID="scan-route-screen" style={styles.container}>
      <Text style={styles.eyebrow}>K SCAN AI</Text>
      <Text style={styles.title}>SCAN ROUTE READY</Text>
      <Text style={styles.subtitle}>Camera migration checkpoint</Text>

      <Pressable testID="back-home-button" style={styles.button} onPress={() => router.replace('/')}>
        <Text style={styles.buttonText}>BACK HOME</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  eyebrow: {
    color: '#A1A1AA',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  subtitle: {
    color: '#A1A1AA',
    marginTop: 10,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  button: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
