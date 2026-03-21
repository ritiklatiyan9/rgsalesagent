import { registerPlugin, Capacitor } from '@capacitor/core';
import { io } from 'socket.io-client';
import { getAccessToken } from '@/lib/axios';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

let watcherId = null;
let socket = null;

// Initialize socket connection using existing token
const initSocket = () => {
  if (socket) return socket;
  const token = getAccessToken();
  if (!token) return null;

  socket = io(import.meta.env.VITE_API_URL || 'https://rivergreenbackend.onrender.com', {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  return socket;
};

export const startBackgroundTracking = async () => {
  try {
    const s = initSocket();
    if (!s) {
      console.warn('Cannot start tracking: No socket/token available.');
      return;
    }

    if (watcherId) {
      console.log('Background tracking already running');
      return;
    }

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      // Add watcher for Native (Android/iOS)
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Tracking active to ensure real-time map updates.',
          backgroundTitle: 'Agent Live Tracking',
          requestPermissions: true,
          stale: false,
          distanceFilter: 10, // Updates every 10 meters change
        },
        function callback(location, error) {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              const confirmed = window.confirm(
                'This app needs your location to track your real-time attendance and map location even when the app is in background.'
              );
              if (confirmed) {
                BackgroundGeolocation.openSettings();
              }
            }
            console.error(error);
            return;
          }

          if (location && s) {
            // Emit Live Location via Socket.io
            s.emit('updateLocation', {
              latitude: location.latitude,
              longitude: location.longitude,
            });
            console.log('Emitted updateLocation', location);
          }
        }
      );
      console.log('Background location tracking started.', watcherId);
    } else {
      // Add watcher for Web/PC Browser
      if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by your browser');
        return;
      }

      watcherId = navigator.geolocation.watchPosition(
        (position) => {
          if (s) {
            s.emit('updateLocation', {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            console.log('Emitted updateLocation (Web)', position.coords);
          }
        },
        (error) => {
          console.error('Web Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 27000
        }
      );
      console.log('Web location tracking started.', watcherId);
    }
  } catch (err) {
    console.error('Failed to start background tracking:', err);
  }
};

export const stopBackgroundTracking = async () => {
  if (watcherId !== null) {
    if (Capacitor.isNativePlatform()) {
      await BackgroundGeolocation.removeWatcher({ id: watcherId });
    } else {
      navigator.geolocation.clearWatch(watcherId);
    }
    watcherId = null;
    console.log('Location tracking stopped.');
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
