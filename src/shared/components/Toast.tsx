import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface ToastProps {
  message: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  onClose?: () => void;
  icon?: string;
}

/**
 * Toast/Snackbar component for displaying brief notifications.
 * Includes proper padding between icon, text, and close button to ensure visibility.
 * Used for error messages, confirmations, and other notifications (T-803).
 */
export function Toast({ message, variant = 'info', onClose, icon }: ToastProps) {
  const bgColorClass = {
    success: 'bg-success',
    error: 'bg-error',
    warning: 'bg-warning-light dark:bg-warning-dark',
    info: 'bg-primary',
  }[variant];

  const textColorClass = {
    success: 'text-white',
    error: 'text-white',
    warning: 'text-text-light dark:text-text-dark',
    info: 'text-white',
  }[variant];

  const defaultIcon = {
    success: '✓',
    error: '⚠️',
    warning: '!',
    info: 'ℹ',
  }[variant];

  return (
    <View
      className={`${bgColorClass} rounded-lg px-4 py-3 flex-row items-center justify-between gap-3`}
    >
      <View className="flex-row items-center gap-3 flex-1">
        <Text className="text-lg">{icon ?? defaultIcon}</Text>
        <Text className={`${textColorClass} text-sm font-medium flex-1`} numberOfLines={2}>
          {message}
        </Text>
      </View>
      {onClose && (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar notificação"
          className="pl-2"
        >
          <Text className={`${textColorClass} text-lg font-bold`}>×</Text>
        </Pressable>
      )}
    </View>
  );
}
