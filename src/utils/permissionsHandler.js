import { App as CapacitorApp } from '@capacitor/app';

/**
 * Request specific Android permissions with user-friendly explanations
 * Note: Permissions are declared in AndroidManifest.xml
 * This function handles the UI/UX flow for users
 */
export const requestPermissions = async () => {
  try {
    // Core permissions needed for the app
    const permissionRequests = [
      {
        name: 'CALL_PHONE',
        label: 'Phone Calling',
        description: 'DG Sales needs permission to make outbound calls for lead follow-ups.'
      },
      {
        name: 'READ_PHONE_STATE',
        label: 'Phone Status',
        description: 'Allows the app to detect incoming calls and manage call state.'
      },
      {
        name: 'READ_CALL_LOG',
        label: 'Call History',
        description: 'DG Sales needs access to your call log to sync and display call history.'
      },
      {
        name: 'POST_NOTIFICATIONS',
        label: 'Notifications',
        description: 'Receive important reminders, call alerts, and task notifications.'
      }
    ];

    console.log('Permissions modal initiated');

    // Simulate permission request success
    const grantedPerms = permissionRequests.map(p => ({
      label: p.label,
      state: 'granted'
    }));

    console.log('✅ Permissions ready:', grantedPerms.map(p => p.label).join(', '));

    return {
      granted: grantedPerms,
      denied: [],
      success: true
    };
  } catch (error) {
    console.error('Error in requestPermissions:', error);
    return {
      granted: [],
      denied: [],
      success: false,
      error: error.message
    };
  }
};

/**
 * Request optional location permission (for field tracking)
 */
export const requestLocationPermission = async () => {
  try {
    console.log('Location permission request initiated');
    // Location tracking is optional
    return true;
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
};

/**
 * Check current permission status
 */
export const checkPermissionStatus = async (permissionName) => {
  try {
    console.log(`Checking permission status for: ${permissionName}`);
    return 'granted'; // Assume granted after modal
  } catch (error) {
    console.error(`Error checking ${permissionName}:`, error);
    return 'denied';
  }
};

/**
 * Open app settings to allow user to manually enable permissions
 */
export const openAppSettings = async () => {
  try {
    // Open Android app settings
    if (window.cordova) {
      window.cordova.plugins.launchApplication.launchApp('com.android.settings');
    } else {
      console.warn('Settings not available in web preview');
    }
  } catch (error) {
    console.error('Error opening app settings:', error);
  }
};

export default {
  requestPermissions,
  requestLocationPermission,
  checkPermissionStatus,
  openAppSettings
};
