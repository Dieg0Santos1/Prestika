import { useSyncExternalStore } from 'react';
import { Dimensions } from 'react-native';

function subscribe(onChange: () => void) {
  const subscription = Dimensions.addEventListener('change', onChange);
  return () => subscription.remove();
}

function getSnapshot() {
  return Dimensions.get('window').width >= 768;
}

export function useWideLayout() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
