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

## How to Go Live (Deployment)

To make this website live on the internet (e.g., Google Cloud, Heroku, Vercel, Render):

1.  **Database**: For a production site with high traffic, consider switching from SQLite to PostgreSQL or MySQL.
2.  **Hosting**: Upload this code to a hosting provider.
3.  **Docker**: A `Dockerfile` is included if you want to deploy using containers (e.g., Google Cloud Run).

## File Structure

- `server.js`: The backend server code (API).
- `database.js`: Database connection and setup.
- `schema.sql`: The database tables structure.
- `script.js`: Frontend logic (connects to the API).
- `index.html`: The main website page.
- `style.css`: Styling for the website.
