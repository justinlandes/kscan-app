import { View, Text, StyleSheet } from 'react-native';

export default function Home() {
  return (
    <View testID="router-home-screen" style={styles.container}>
      <Text style={styles.title}>K SCAN AI</Text>
      <Text style={styles.subtitle}>STYLE-PARSE ENGINE READY</Text>
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
});
