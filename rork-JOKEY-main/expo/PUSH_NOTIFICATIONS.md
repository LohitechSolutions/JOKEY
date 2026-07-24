# Jokey Push Notifications

Production push pipeline: **Expo Push Notifications** + **Supabase** (`push_devices` table + Edge Function `notify-new-content`).

## Why this stack

- No separate Node backend; Supabase already hosts auth/data.
- Expo Push sits on FCM (Android) and APNs (iOS) without custom native push code.
- Works for foreground, background, killed app, and locked phone once the OS allows notifications.

## Flow

1. User enables Notifications in Jokey Settings → OS permission prompt → Expo push token saved in `push_devices`.
2. Admin publishes an image, or a creator publishes audio/video.
3. Client invokes Edge Function `notify-new-content`.
4. Function loads all `enabled` tokens and sends Expo Push messages:
   - Image → title `JOKEY`, body `A new image was published!`
   - Audio/Video → title `JOKEY`, body `A new joke was published!`
5. Invalid tokens (`DeviceNotRegistered`) are deleted.

## Files

| Path | Role |
|------|------|
| `lib/push-notifications.ts` | Permissions, channel, Expo token |
| `lib/push-devices-client.ts` | Supabase token sync + notify invoke |
| `supabase-push-devices.sql` | Table + RLS |
| `supabase/functions/notify-new-content/index.ts` | Fan-out |
| `app/settings.tsx` | Real toggle + open system settings |
| `contexts/AppContext.tsx` | Sync on login; cleanup on logout; notify on image publish |
| `app/(tabs)/record/index.tsx` | Notify on audio/video publish |
| `app.json` | `expo-notifications` plugin, Android POST_NOTIFICATIONS, iOS remote-notification |

## Manual setup (required for real device pop-ups)

### 1. Supabase SQL

Run `supabase-push-devices.sql` in the Supabase SQL Editor.

### 2. Deploy Edge Function

```bash
supabase login
supabase functions deploy notify-new-content --project-ref ybafpeuelshlofltoebe
```

### 3. EAS project ID

```bash
cd rork-JOKEY-main/expo
npx eas-cli init
```

Put the UUID into `app.json` → `expo.extra.eas.projectId` (and optionally `EXPO_PUBLIC_EAS_PROJECT_ID`).

### 4. Android FCM (so Jokey appears under system Notifications)

1. Firebase Console → project for package `app.rork.azbb4413e811lknfmyslw`
2. `google-services.json` is already in `rork-JOKEY-main/expo/` and linked via `android.googleServicesFile`
3. Upload the FCM v1 service account to EAS (Expo dashboard → credentials) or:
   ```bash
   eas credentials
   ```

### 5. iOS APNs

In Apple Developer + EAS credentials: enable Push Notifications for `app.rork.azbb4413e811lknfmyslw` and upload the APNs key to EAS.

### 6. Rebuild a native binary

Push does **not** work from a plain web build. Rebuild Android APK/AAB (and iOS) after these config changes:

```bash
npx expo prebuild --clean --platform android
# then assembleRelease / EAS build
```

## Testing checklist

- [ ] Settings → enable Notifications → OS prompt appears
- [ ] Phone Settings → Apps → Jokey → Notifications exists
- [ ] Token row present in `push_devices` (`enabled = true`)
- [ ] Publish image (admin) → devices get “A new image was published!”
- [ ] Publish audio/video → “A new joke was published!”
- [ ] Works with app open, background, killed, locked
- [ ] Toggle off → `enabled = false` (no more pushes)
- [ ] Logout removes device token row
- [ ] Denied permission → alert + Open Settings

## Notes

- Expo Go has limited push support; use a **dev/production build**.
- Publishing never fails if push fails (errors are logged only).
- Web clients are not registered for push.
