# Deployment Guide

Follow these steps to deploy your clothes website using Vercel (Frontend), Neon (Database), and Hugging Face (Backend).

## 1. Database (Neon)
1.  Go to [Neon Console](https://console.neon.tech/).
2.  Create a new project.
3.  Copy the **Connection String** (e.g., `postgres://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require`).
4.  You will need this for the Backend deployment.

## 2. Backend (Hugging Face)
1.  Go to [Hugging Face Spaces](https://huggingface.co/spaces).
2.  Create a new Space.
    *   **Space Name**: `clothes-backend` (or similar).
    *   **SDK**: `Docker`.
3.  Upload your project files to the Space (you can drag and drop or use Git).
    *   *Important*: Ensure `Dockerfile`, `package.json`, `server.js`, and `database.js` are uploaded.
4.  **Settings**:
    *   Go to the **Settings** tab of your Space.
    *   Scroll to **Variables and secrets**.
    *   Add a new Secret:
        *   **Name**: `DATABASE_URL`
        *   **Value**: (Paste your Neon Connection String from Step 1)
5.  Wait for the Space to build. Once running, copy the **Direct URL** (e.g., `https://yourname-clothes-backend.hf.space`).

## 3. Frontend (Vercel)
1.  **Update API URL**:
    *   Open `script.js`.
    *   Update `const REMOTE_API` with your new Hugging Face URL (if it changed).
2.  **Deploy**:
    *   Go to [Vercel](https://vercel.com/).
    *   Import your project (from GitHub or upload folder).
    *   Deploy.

## 4. Verification
*   Open your Vercel website URL.
*   It should connect to your Hugging Face backend, which connects to your Neon database.
