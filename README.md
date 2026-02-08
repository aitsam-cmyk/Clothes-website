---
title: Clothes Website
emoji: 👗
colorFrom: pink
colorTo: purple
sdk: docker
pinned: false
---

# Clothes Website with Admin Panel

This is a professional e-commerce website with a complete backend, SQL database, and role-based access control (Admin vs Customer).

## Features

- **SQL Database**: Uses SQLite for robust data storage (Users, Products, Orders).
- **Admin Panel**:
  - Secure Login
  - Add, Edit, and Remove products
  - View Dashboard (Total Orders, Revenue, Recent Orders)
- **Customer Features**:
  - Sign Up / Login
  - View Products
  - Add to Cart / Wishlist
  - Place Orders
- **Real-time Updates**: Changes made by admins are immediately visible to customers.
- **Responsive Design**: Works on mobile and desktop.

## Prerequisites

- Node.js installed on your computer.

## How to Run Locally

1.  **Install Dependencies**:
    Open a terminal in this folder and run:
    ```bash
    npm install
    ```

2.  **Start the Server**:
    Run the following command:
    ```bash
    npm start
    ```
    Or:
    ```bash
    node server.js
    ```

3.  **Open the Website**:
    Go to `http://localhost:3000` in your browser.

## Admin Credentials

Default admin accounts are pre-created (Password is case-sensitive):

- **Email**: `zellburyofficial3@gmail.com`
  - **Password**: `farnaz90`
- **Email**: `jasimkhan5917@gmail.com`
  - **Password**: `@Jasimkhan5917`
- **Email**: `admin@store.com`
  - **Password**: `admin123`

## 🚀 How to Go Live on GitHub (Important!)

GitHub itself only hosts **Static** websites (HTML/CSS). Since this project uses a **Database** and a **Backend Server**, you cannot just upload it to GitHub Pages.

However, you can use **Render** (which connects to your GitHub) to host the full website for free.

### Step 1: Push Code to GitHub
1.  Create a new repository on [GitHub.com](https://github.com/new).
2.  Run these commands in your terminal (replace `YOUR_REPO_URL` with the one from GitHub):
    ```bash
    git remote add origin YOUR_REPO_URL
    git branch -M main
    git push -u origin main
    ```

### Step 2: Deploy to Render (Free)
1.  Go to [Render.com](https://render.com) and sign up with GitHub.
2.  Click **New +** -> **Web Service**.
3.  Select your `clothes-website` repository from the list.
4.  Settings:
    - **Name**: `clothes-website`
    - **Environment**: `Node`
    - **Build Command**: `npm install`
    - **Start Command**: `node server.js`
5.  Click **Create Web Service**.

**That's it!** Render will give you a link (e.g., `https://clothes-website.onrender.com`).
- The database will be created automatically.
- **Note**: On the free plan, the database will reset if the server restarts (ephemeral storage). For a permanent database, you would need a cloud database (like Neon or Turso), but for a demo, this works perfectly.

## File Structure

- `server.js`: The backend server code (API).
- `database.js`: Database connection and setup.
- `schema.sql`: The database tables structure.
- `script.js`: Frontend logic (connects to the API).
- `index.html`: The main website page.
- `style.css`: Styling for the website.
