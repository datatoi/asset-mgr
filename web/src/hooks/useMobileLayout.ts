import { useSyncExternalStore } from 'react';

const query = '(max-width: 767px)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};

/** Layout follows viewport width, including rotation and browser resizing. */
export const useMobileLayout = () => useSyncExternalStore(
  subscribe,
  () => window.matchMedia(query).matches,
  () => false,
);
