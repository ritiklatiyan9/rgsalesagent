import { useState, useEffect } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import {
  requestPermissions,
  requestLocationPermission,
  openAppSettings
} from '@/utils/permissionsHandler';

export default function PermissionsModal({ onClose }) {
  const [isLoading, setIsLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [deniedCount, setDeniedCount] = useState(0);

  useEffect(() => {
    // Request permissions on modal open
    handleRequestPermissions();
  }, []);

  const handleRequestPermissions = async () => {
    setIsLoading(true);
    try {
      const result = await requestPermissions();
      setPermissions(result.granted);
      setDeniedCount(result.denied.length);
    } catch (error) {
      console.error('Error requesting permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestLocation = async () => {
    setIsLoading(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        alert(
          'Location permission is optional. You can enable it later in Settings.'
        );
      }
    } catch (error) {
      console.error('Error requesting location:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-800">
            App Permissions Required
          </h2>
        </div>

        {/* Description */}
        <p className="text-gray-600 text-sm mb-6">
          DG Sales needs certain permissions to provide you with the best
          experience. Here's what we need:
        </p>

        {/* Permissions List */}
        <div className="space-y-3 mb-6">
          {[
            {
              icon: '📞',
              title: 'Phone Calling',
              desc: 'Make outbound calls to leads'
            },
            {
              icon: '📱',
              title: 'Call History',
              desc: 'Display and sync your call logs'
            },
            {
              icon: '🔔',
              title: 'Notifications',
              desc: 'Send reminders and call alerts'
            }
          ].map((perm, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <span className="text-lg mt-1">{perm.icon}</span>
              <div>
                <p className="font-medium text-gray-800">{perm.title}</p>
                <p className="text-xs text-gray-600">{perm.desc}</p>
              </div>
              <Check className="w-5 h-5 text-green-500 ml-auto flex-shrink-0 mt-1" />
            </div>
          ))}
        </div>

        {/* Privacy Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
          <p className="text-xs text-blue-800">
            <strong>📋 Privacy:</strong> Your data is never shared with third parties.
            See our{' '}
            <a
              href="https://www.croplandagritech.com/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold hover:text-blue-900"
            >
              Privacy Policy
            </a>{' '}
            for details.
          </p>
        </div>

        {/* Optional Location */}
        <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" />
            <div>
              <p className="font-medium text-sm text-gray-800">
                📍 Location Tracking (Optional)
              </p>
              <p className="text-xs text-gray-600">
                Helps track field agent locations for better route optimization
              </p>
            </div>
          </label>
          {deniedCount === 0 && (
            <button
              onClick={handleRequestLocation}
              disabled={isLoading}
              className="mt-2 w-full text-sm py-2 px-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              {isLoading ? 'Requesting...' : 'Enable Location'}
            </button>
          )}
        </div>

        {/* Error State */}
        {deniedCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            <p className="text-xs text-red-800">
              <strong>⚠️ Note:</strong> Some permissions were denied. The app may not work
              as expected. You can enable them in Settings.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {deniedCount > 0 && (
            <button
              onClick={openAppSettings}
              className="flex-1 py-2 px-4 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition"
            >
              Open Settings
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isLoading}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
              deniedCount === 0
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            } disabled:opacity-50`}
          >
            {isLoading ? 'Requesting...' : 'Continue'}
          </button>
        </div>

        {/* Status Footer */}
        <p className="text-xs text-gray-500 text-center mt-4">
          {deniedCount === 0
            ? '✅ All permissions granted!'
            : `⚠️ ${deniedCount} permission(s) denied`}
        </p>
      </div>
    </div>
  );
}
