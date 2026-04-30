# Pulse Android widget scaffolding

Placeholder directory. The `.template` files are NOT on the Android build path until a human performs the following steps.

## Manual steps

1. Run `bunx cap add android` from the repo root to materialize `android/`.
2. Rename `PulseWidgetProvider.kt.template` → `PulseWidgetProvider.kt`.
3. Move `widget_layout.xml.template` → `android/app/src/main/res/layout/pulse_widget_layout.xml`.
4. Move `pulse_widget_info.xml.template` → `android/app/src/main/res/xml/pulse_widget_info.xml`.
5. Register the provider in `AndroidManifest.xml`:

```xml
<receiver android:name="com.pulse.nightlife.widget.PulseWidgetProvider"
         android:exported="true">
  <intent-filter>
    <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
  </intent-filter>
  <meta-data android:name="android.appwidget.provider"
             android:resource="@xml/pulse_widget_info" />
</receiver>
```

## Data contract

The provider reads from `SharedPreferences` under the name `CapacitorStorage` (the default used by `@capacitor/preferences`). Keys match the iOS App Group names:

- `widget:trending` → JSON `{ neighborhood, venues: [{ name, score }] }`

Keep this schema in sync with the iOS widget (`ios/App/PulseWidget/README.md`).
