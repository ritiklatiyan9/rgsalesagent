# Permissions & Privacy Policy Setup Guide

## What Was Added

I've added the following compliance features to your Agent Panel app:

### 1. **Privacy Policy** (`PRIVACY_POLICY.md`)
   - Complete privacy policy template customized for your RiverGreen Sales app
   - Explains data collection, permissions usage, and user rights
   - **Action Required**: Deploy to https://www.croplandagritech.com/privacy-policy

### 2. **Permissions Handler** (`src/utils/permissionsHandler.js`)
   - Utility module to request app permissions programmatically
   - Functions for:
     - `requestPermissions()` - Request all core permissions
     - `requestLocationPermission()` - Optional location tracking
     - `checkPermissionStatus()` - Verify permission status
     - `openAppSettings()` - Direct user to settings

### 3. **Permissions Modal Component** (`src/components/PermissionsModal.jsx`)
   - Beautiful UI that explains why each permission is needed
   - Shows permission status with visual indicators
   - Privacy policy link included
   - Shows on first app launch

### 4. **App Integration** (`src/App.jsx`)
   - Permissions modal automatically triggers on first launch
   - Uses localStorage to remember that permissions were requested
   - Displays before user authentication

## Files Created/Modified

```
AgentPanel/
├── PRIVACY_POLICY.md                    (NEW - Template)
├── src/
│   ├── App.jsx                          (MODIFIED - Added permissions logic)
│   ├── components/
│   │   └── PermissionsModal.jsx         (NEW - Permissions UI)
│   └── utils/
│       └── permissionsHandler.js        (NEW - Permissions utility)
```

## Next Steps Before Deployment

### 1. **Deploy Privacy Policy**
```bash
# Copy the privacy policy to your website
# URL: https://www.croplandagritech.com/privacy-policy
```

### 2. **Test Locally**
```bash
npm run build
npx cap sync android
cd android
cmd /c gradlew.bat assembleDebug
# Install the debug APK on a test device
```

### 3. **Update Google Play Store Listing**
   - In Play Console, add this Privacy Policy URL
   - Copy text from `PRIVACY_POLICY.md` to your store listing

### 4. **Update Permissions in Google Play Console**
   - Permission categories automatically map to Play Store
   - Ensure descriptions match your actual app usage

## Permission Details

| Permission | Why Needed | Usage |
|-----------|-----------|-------|
| CALL_PHONE | Make outbound calls | Lead follow-ups, dialing |
| READ_PHONE_STATE | Detect call states | Incoming call handling |
| READ_CALL_LOG | Display call history | Sync and view past calls |
| POST_NOTIFICATIONS | Send alerts | Reminders, call notifications |
| ACCESS_FINE_LOCATION | Field agent tracking | Location-based features (optional) |

## How It Works

1. **First Launch**: User sees permissions modal
2. **Permission Request**: Taps continue → Android prompts for each permission
3. **Storage**: App remembers permissions were requested via localStorage
4. **Subsequent Launches**: Modal doesn't appear again (unless localStorage is cleared)

## Customization

### Change Privacy Policy URL
Edit `src/components/PermissionsModal.jsx` line 49:
```jsx
href="https://www.croplandagritech.com/privacy-policy"
```

### Add More Permissions
Edit `src/utils/permissionsHandler.js` and add to `permissionRequests` array:
```javascript
{
  name: 'YOUR_NEW_PERMISSION',
  label: 'Permission Label',
  description: 'Why this is needed'
}
```

### Skip Permissions Modal (Testing Only)
Delete localStorage on first run:
```javascript
// In browser console
localStorage.removeItem('permissionsRequested');
```

## Testing the Permissions Modal

```javascript
// Test in browser console
localStorage.removeItem('permissionsRequested');
location.reload();
```

## Important Notes

✅ **Privacy Policy**: Update with actual links and contact info  
✅ **Data Retention**: Specify how long you keep user data  
✅ **Third-party Sharing**: Be clear about integrations  
✅ **GDPR Compliance**: Consider data deletion requests  
✅ **CCPA Compliance**: Consider California privacy laws  

## Questions?

- Privacy Policy Template: See `PRIVACY_POLICY.md`
- Permissions Logic: See `src/utils/permissionsHandler.js`
- UI Component: See `src/components/PermissionsModal.jsx`

---

**Status**: Ready for deployment after testing and hosting privacy policy
