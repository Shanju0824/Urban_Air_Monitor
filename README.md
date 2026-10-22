# Urban Air Monitor

A MERN stack environmental monitoring system for centralized AQI, PM2.5, PM10, NO2, SO2, and pollution trend visibility.

## Features

- React dashboard for urban authorities
- Express API with MongoDB/Mongoose station and reading models
- AQI risk bands, trend analytics, active alerts, and policy action queue
- Seeded sample data fallback for local development before MongoDB is connected

## Run locally

```bash
npm run install:all
npm run dev
```

The frontend runs on `http://127.0.0.1:5173` and proxies API calls to `http://127.0.0.1:5000`.

## MongoDB setup

Copy `backend/.env.example` to `backend/.env`, set `MONGODB_URI`, `SESSION_SECRET`, and a unique `INITIAL_ADMIN_PASSWORD` (12+ characters with uppercase, lowercase, a number, and a symbol). The first administrator is created when the API connects to MongoDB. Keep this file private. The bootstrap credentials only create an account on first run; they do not overwrite an existing admin password.

Authority users sign in with a private User ID and password issued by the administrator. New users submit an access request from the sign-in page with their name, work email, organization, and reason. Administrators see new requests in the dashboard's **Access requests** module, where they review the request and issue the user's private ID. The approved requester sees the ID on the device used to request access and sets their own strong password there. Access requests appear in the app's sidebar notification badge. `CLIENT_ORIGIN` accepts a comma-separated list of exact origins, for example `http://127.0.0.1:5173,http://192.168.1.23:5173`, when using both the PC and its mobile LAN address.

Then seed the monitoring stations:

```bash
npm run seed --prefix backend
```

If MongoDB is not available, local development serves the included sample readings. Deployed single-server mode requires MongoDB to connect successfully before startup.

The dashboard and station APIs require an authenticated authority account. Accounts are stored with scrypt password hashes; login and public access-request attempts are throttled, and the session cookie is HTTP-only, SameSite strict, and Secure in production. Set `CLIENT_ORIGIN` to the exact deployed frontend origin when hosting the frontend and API on separate origins. Dashboard readings are demonstration data unless connected to live monitoring hardware.

## Deploy to Vercel

The root `vercel.json` builds the Vite frontend into `frontend/dist` and routes `/api/*` to the Express function in `api/[...path].js`. Import the project root into Vercel; keep the project root set to `.` so both the frontend and API are included.

Add these environment variables in the Vercel project settings for Production (and Preview if you use preview deployments):

- `MONGODB_URI`: your MongoDB Atlas connection URI, with the production database name.
- `SESSION_SECRET`: a stable random secret with at least 32 characters. Generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` and store it only in Vercel environment settings.
- `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD`, and `INITIAL_ADMIN_EMAIL`: set these if the configured database does not already contain the administrator account. The initial password must meet the same strong-password rules as local setup.

In MongoDB Atlas, configure network access for the deployment before publishing. Once deployed, check `/api/health`, sign in, request access, and verify that the request status and password setup flow work on a phone. Vercel Hobby outbound IPs may be dynamic, so Atlas IP allowlisting can be a limitation for this setup.

## Free demo deployment to Render

The root `render.yaml` configures a single Node web service that builds the Vite frontend and serves it from Express, so the app and `/api` share one origin. In Render, create a Blueprint from the GitHub repository and select `render.yaml`. Set the prompted secrets:

- `MONGODB_URI`: MongoDB Atlas connection URI for the `urban_air_monitor` database.
- `INITIAL_ADMIN_PASSWORD`: a new strong password (12+ characters with uppercase, lowercase, a number, and a symbol).
- `INITIAL_ADMIN_EMAIL`: the administrator's email address.

The Blueprint configures the initial administrator ID as `air-admin1`; change that value in `render.yaml` before creating the Blueprint if needed. Render generates `SESSION_SECRET`. In MongoDB Atlas **Security → Network Access**, allow the Singapore outbound IP ranges shown under the service's **Connect → Outbound** tab. Render's ranges are shared with other services in the same region.

Render Free web services sleep after 15 minutes without traffic and may take about a minute to wake. Free services also have an ephemeral filesystem and limited monthly usage. Use the free plan for a demo only, not for production authority operations.
