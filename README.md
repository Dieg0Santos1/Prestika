# Prestika

Aplicación para administrar préstamos personales con React Native, Expo, TypeScript y Supabase.

## Ejecutar el proyecto

```bash
npm install
npm run android
```

Para revisar la landing web:

```bash
npm run web
```

Las variables públicas necesarias están documentadas en `.env.example`. Las claves privadas y la clave `service_role` nunca deben incluirse en la aplicación.

## Verificaciones

```bash
npx tsc --noEmit
npm run lint
npx expo-doctor
npm run build:web
```

## Actualizaciones OTA

La APK de producción escucha el canal `production` de EAS Update. Los cambios compatibles con su código nativo se publican con:

```bash
npm run update:preview -- --message "Descripción del cambio"
npm run update:production -- --message "Descripción del cambio"
```

Cuando la actualización necesita cambios nativos, se incrementa la versión de la app, se genera una nueva APK y se registra su versión en `public.versiones_app`:

```bash
npm run build:android:apk
```

La aplicación descarga silenciosamente las actualizaciones OTA y ofrece reiniciarse cuando están listas. Para versiones nativas muestra el enlace registrado en Supabase.

## Automatización con GitHub

Cada cambio enviado a `main` pasa TypeScript y lint antes de publicar una actualización OTA en `production`. El repositorio debe tener el secreto `EXPO_TOKEN` en **Settings > Secrets and variables > Actions**.

No deben publicarse cambios nativos como OTA. En esos casos primero se cambia `expo.version`, se genera una APK y se prueba antes de activar el registro correspondiente en Supabase.

La lógica de negocio autoritativa está documentada en `LOGICA_APP_PRESTAMOS.txt`.
