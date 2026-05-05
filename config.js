/**
 * K-SCAN API config. Use your machine's local IP so the device/emulator can reach the backend.
 * Server may run on port 8081 or 8082 (Expo).
 */
const LOCAL_IP = '192.168.2.84';
const PORT = 8081;

export const SERVER_URL = `http://${LOCAL_IP}:${PORT}/api/analyze`;
