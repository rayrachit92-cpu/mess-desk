# Mess Management System — Frontend

React + Vite + Tailwind, talking to the Flask API via JWT bearer tokens.
The frontend never sends an `owner_id` anywhere — every request relies on
the backend deriving identity from the token.

## Run locally

```bash
cd frontend
npm install
cp .env.example .env    # adjust VITE_API_URL if your backend runs elsewhere
npm run dev
```

Opens on `http://localhost:5173`. Make sure the backend is running first
(see `../backend/README.md`) and that `FRONTEND_ORIGIN` on the backend
matches this URL for CORS to work.

## Structure

```
src/
  api/client.js          fetch wrapper: attaches JWT, auto-refreshes on 401
  context/AuthContext.jsx login/register/logout state, current owner
  components/             Layout (nav), StatusBadge, Modal, banners
  pages/
    Login.jsx, Register.jsx
    Dashboard.jsx          summary cards
    Students.jsx           list + search/filter + add
    StudentDetail.jsx       full student view: payments, holidays, edit/delete
    Payments.jsx            all payments, quick add
    Holidays.jsx             all holidays, quick add
    Notifications.jsx       ending-soon/expired/payment/holiday alerts
    Reports.jsx              monthly report by year/month
    Profile.jsx              owner/mess settings, password change, audit log
```

## Build for production

```bash
npm run build   # outputs to dist/
```

Serve `dist/` from any static host (nginx, Netlify, Vercel, S3+CloudFront)
behind HTTPS, and point `VITE_API_URL` at your deployed backend's HTTPS URL.

## Notes

- Tokens are stored in `localStorage`. This is standard for SPAs; if you
  want extra XSS-hardening later, move the refresh token to an httpOnly
  cookie issued by the backend and keep only the short-lived access token
  in memory.
- This codebase was generated without npm registry access, so dependencies
  in `package.json` are pinned to versions known-compatible but were not
  installed/build-tested here. Run `npm install && npm run build` once to
  confirm in your own environment — if anything needs a version bump,
  `npm outdated` will tell you.
