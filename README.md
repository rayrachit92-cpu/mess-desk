# Mess Management System

A secure multi-tenant mess management system with:

```text
MESS-SYSTEM/
├── backend/       # Flask API with JWT auth, tenant isolation, audit logs
├── frontend/      # React + Vite web app
├── mobile/        # React Native + Expo Android app
└── README.md
```

The mobile and web clients both use the same backend API:

```text
Mobile App / Web App -> Backend API -> Database
```

Clients never send or control `owner_id`. The backend derives the owner from
the authenticated JWT and keeps IDOR/BOLA protection in the route layer.

## 1. Run The Backend

```bash
cd backend
pip install -r requirements.txt
export JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
export FRONTEND_ORIGIN="http://localhost:5173"
python3 app.py
```

Default local API URL:

```text
http://127.0.0.1:5001
```

For a physical Android phone on the same Wi-Fi, run the backend on all network
interfaces instead:

```bash
cd backend
export JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
flask --app app run --host 0.0.0.0 --port 5001
```

Then use your computer's LAN IP in the mobile `.env`, for example
`http://192.168.1.50:5001`.

## 2. Run The Web Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

Optional `frontend/.env`:

```bash
VITE_API_URL=http://127.0.0.1:5001
```

## 3. Run The Expo Mobile App

```bash
cd mobile
npm install
cp .env.example .env
npm start
```

Set `mobile/.env` for your target:

```bash
# Android emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:5001

# Physical Android phone, replace with your computer's Wi-Fi/LAN IP
EXPO_PUBLIC_API_URL=http://192.168.1.50:5001
```

The app stores JWT access and refresh tokens with `expo-secure-store`.

## 4. Connect A Physical Android Phone

1. Install **Expo Go** from the Google Play Store.
2. Connect the phone and computer to the same Wi-Fi network.
3. Find your computer's LAN IP:

```bash
ipconfig getifaddr en0
```

4. Start the backend with `--host 0.0.0.0` as shown above.
5. Put that LAN IP in `mobile/.env` as `EXPO_PUBLIC_API_URL`.
6. Start Expo:

```bash
cd mobile
npm start
```

7. Scan the QR code with Expo Go.

If the phone cannot connect, check firewall settings and confirm that
`http://YOUR_LAN_IP:5001/health` opens from the phone browser.

## 5. Build An Android APK/AAB

Install and log in to EAS:

```bash
cd mobile
npm install
npx eas-cli login
npx eas-cli build:configure
```

Build an APK for direct installation/testing:

```bash
npx eas-cli build --platform android --profile preview
```

Build an AAB for Play Store upload:

```bash
npx eas-cli build --platform android --profile production
```

Before building, set the production backend URL:

```bash
EXPO_PUBLIC_API_URL=https://your-api-domain.example.com
```

Use HTTPS in production. No AI API keys are required for normal application
functionality.

## Mobile Screens

The Expo app includes:

- Login
- Owner Registration
- Dashboard
- Student List
- Add Student
- Student Details
- Edit Student
- Add Payment
- Payment History
- Holiday List
- Add Holiday
- Notifications
- Reports
- Profile / Settings

## Notes

- The current backend code is Flask-based, while some earlier requirements
  mention FastAPI. The mobile app intentionally reuses the existing backend
  routes and response formats already present in this repository.
- Do not connect the mobile app directly to SQLite/PostgreSQL.
- Do not add `owner_id` to client request bodies.
