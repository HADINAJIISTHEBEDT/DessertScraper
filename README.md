# Dessert Cafe Manager

A web app to manage dessert timers and compare ingredient prices from Şok and Migros markets.

## Download Desktop App

[Download Dessert Cafe Manager (Windows)](https://drive.google.com/file/d/1wQEgO-Nvfk-yPdBRFNFuE7LRIDEPlxea/view?usp=drive_link)

Double-click the downloaded file to run the application.

## Features
- Timer management for dessert expiration
- Price comparison across Şok and Migros
- English/Arabic language support
- Automatic server startup

## Deployment Instructions

### Step 1: Deploy Backend to Render (Free)

1. Go to [render.com](https://render.com) and sign up/login
2. Click **New +** → **Web Service**
3. Connect your GitHub/GitLab repository
4. Settings:
   - **Name**: `dessert-scraper`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free
5. Click **Create Web Service**
6. Wait for deployment to complete
7. Copy your backend URL (e.g., `https://dessert-scraper.onrender.com`)

### Step 2: Configure Frontend for Production

Edit `js.js` and change line 8:

```javascript
// Change from:
const REMOTE_BACKEND_URL = null;

// To your Render URL:
const REMOTE_BACKEND_URL = "https://dessert-scraper.onrender.com";
```

### Step 3: Deploy Frontend to Netlify (Free)

1. Go to [netlify.com](https://netlify.com) and sign up/login
2. Click **Add new site** → **Deploy manually**
3. Drag and drop these files:
   - `index.html`
   - `js.js`
   - `css.css`
   - `netlify.toml`
4. Your site will be live!

## Local Development

Double-click `start.bat` to run locally. The server will:
- Install dependencies (first time)
- Start the Node.js server
- Auto-open the browser

## File Structure

```
├── index.html      # Main HTML
├── js.js           # Frontend JavaScript
├── css.css         # Styles
├── server.js       # Backend server
├── scraper.js      # Web scraping logic
├── start.bat       # Auto-start script
├── netlify.toml    # Netlify config
├── render.yaml     # Render config
└── package.json    # Dependencies
```

## Language Support

- English
- العربية (Arabic)

The app automatically remembers your language preference.
