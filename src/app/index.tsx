import { View, Text, useColorScheme } from 'react-native';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const hideSplash = async () => {
      await SplashScreen.hideAsync();
    };
    hideSplash();
  }, []);

  const isDark = colorScheme === 'dark';
  const containerBg = isDark ? '#1F1F1F' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: containerBg }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: textColor,
          }}
        >
          Transfer Files - Home
        </Text>
      </View>
    </SafeAreaView>
  );
}
