import { View, Text } from 'react-native';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Screen } from '@/shared/components';

export default function HomeScreen() {
  useEffect(() => {
    const hideSplash = async () => {
      await SplashScreen.hideAsync();
    };
    hideSplash();
  }, []);

  return (
    <Screen>
      <View className="flex-1 justify-center items-center">
        <Text className="text-2xl font-bold text-text-light dark:text-text-dark">
          Transfer Files - Home
        </Text>
      </View>
    </Screen>
  );
}
