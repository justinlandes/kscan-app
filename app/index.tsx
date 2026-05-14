import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function Home() {
  return (
    <View testID="router-home-screen" style={styles.container}>
      <Text style={styles.title}>K SCAN AI</Text>
      <Text style={styles.subtitle}>STYLE-PARSE ENGINE READY</Text>

      <Pressable testID="start-scan-button" style={styles.button} onPress={() => router.push('/scan')}>
        <Text style={styles.buttonText}>START SCAN</Text>
      </Pressable>

      <Pressable testID="privacy-button" style={styles.secondaryButton} onPress={() => router.push('/privacy')}>
        <Text style={styles.secondaryButtonText}>PRIVACY CONTROL</Text>
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
  title: { 
    color: '#FFFFFF',
    fontSize: 32, 
    fontWeight: '900',
    letterSpacing: 3
  },
  subtitle: { 
    color: '#A1A1AA',
    marginTop: 10,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase'
  },
  button: {
    marginTop: 36,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  secondaryButtonText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
