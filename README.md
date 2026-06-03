# 🚀 Full-Stack AI Portfolio Website

A modern, interactive portfolio website built with React, Express, and OpenAI API integration. Features a custom cursor, scroll animations, dark mode theme, and an intelligent AI chat assistant powered by ChatGPT.

## ✨ Features

- **Reactive UI Elements**
  - Custom pointer icon with trailing circle
  - Smooth scroll animations
  - Parallax effects
  - Hover animations on all interactive elements

- **Dark Mode Theme**
  - Deep navy background with neon purple and pink accents
  - Eye-catching gradient effects
  - Beautiful typography

- **Portfolio Sections**
  - Hero section with typed text animation
  - Skills showcase with interactive cards
  - Recent projects gallery
  - Contact form with API integration
  - Footer

- **AI Chat Integration**
  - Real-time chat widget
  - Powered by OpenAI ChatGPT API
  - Conversation history management
  - Floating action button

- **Responsive Design**
  - Mobile-first approach
  - Works on all screen sizes
  - Touch-friendly interfaces

- **Full-Stack Architecture**
  - React frontend with Vite
  - Express.js backend
  - CORS-enabled API
  - Environment variable configuration

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Fast build tool
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Axios** - HTTP client
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **OpenAI API** - AI integration
- **CORS** - Cross-origin support
- **Nodemailer** - Email service (optional)

## 📋 Prerequisites

- **Node.js** (v18+) and npm
- **OpenAI API Key** (Get from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys))
- Modern web browser
- Git (for version control)

## 🚀 Quick Start

### 1. Clone & Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd Final\ Boss

# Navigate to frontend
cd frontend
npm install

# Navigate to backend
cd ../backend
npm install
```

### 2. Configure Environment Variables

#### Backend Configuration

```bash
# In backend directory, create .env file
cp .env.example .env

# Edit .env with your values:
```

**.env** file:
```
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
OPENAI_API_KEY=sk-your-api-key-here
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
API_KEY=your_secret_api_key
```

#### Frontend Configuration

The frontend automatically proxies API requests to `http://localhost:5000` during development (configured in `vite.config.js`).

### 3. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

Visit `http://localhost:5173` in your browser.

## 📚 Usage Guide

### Customization

#### Update Portfolio Information
Edit `frontend/src/components/Hero.jsx`, `Skills.jsx`, `Projects.jsx`, and `Contact.jsx` with your information:

```jsx
// Example in Hero.jsx
<h1>Hello, I'm {Your Name}</h1>
<p>{Your Description}</p>
```

#### Modify Projects
Update the `projects` array in `frontend/src/components/Projects.jsx`:

```jsx
const projects = [
  {
    title: 'Your Project',
    description: 'Project description',
    tech: ['React', 'Node.js'],
    image: 'image-url',
    link: 'project-link'
  }
]
```

#### Update Contact Information
Edit contact details in `frontend/src/components/Contact.jsx`:

```jsx
<a href="mailto:your.email@example.com">your.email@example.com</a>
<a href="tel:+1234567890">+1 (234) 567-890</a>
```

### AI Chat Customization

Modify the system prompt in `backend/routes/chat.js`:

```javascript
const systemPrompt = `Your custom AI assistant instructions...`
```

## 🔧 API Endpoints

### Health Check
```
GET /api/health
Response: { status: 'ok', message: 'Server is running' }
```

### Contact Form
```
POST /api/contact
Body: {
  "name": "string",
  "email": "string",
  "subject": "string",
  "message": "string"
}
Response: { success: true, message: 'Message received successfully' }
```

### AI Chat
```
POST /api/chat
Body: {
  "message": "user message",
  "conversationHistory": [
    { "text": "message", "sender": "user|bot" }
  ]
}
Response: { 
  "reply": "AI response",
  "success": true 
}
```

## 🌐 Deployment

### Frontend (Vercel - Recommended)

1. **Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

2. **Deploy on Vercel**
- Go to [vercel.com](https://vercel.com)
- Click "New Project"
- Import your GitHub repository
- Select `frontend` as root directory
- Add environment variables if needed
- Click "Deploy"

### Backend (Railway/Render)

#### Option 1: Railway.app

1. Push to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select repository and `backend` directory
5. Add environment variables:
   - `OPENAI_API_KEY`
   - `FRONTEND_URL` (your Vercel URL)
   - `NODE_ENV=production`
6. Deploy

#### Option 2: Render.com

1. Go to [render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect GitHub repository
4. Configure:
   - Build command: `npm install`
   - Start command: `npm start`
   - Root directory: `backend`
5. Add environment variables
6. Click "Create Web Service"

### Environment Variables for Deployment

```
OPENAI_API_KEY=sk-...
FRONTEND_URL=https://your-frontend-url.vercel.app
PORT=5000
NODE_ENV=production
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
```

### Connect Frontend to Backend

After deploying backend, update the proxy in `frontend/vite.config.js`:

```javascript
server: {
  proxy: {
    '/api': {
      target: 'https://your-backend-url.railway.app',
      changeOrigin: true
    }
  }
}
```

Or update in production build if using environment variables.

## 🎨 Customization Guide

### Colors & Theme

Edit `frontend/tailwind.config.js`:

```javascript
colors: {
  neon: {
    purple: '#a855f7',      // Primary color
    cyan: '#06b6d4',        // Secondary color
    pink: '#ec4899'         // Accent color
  }
}
```

### Fonts

Fonts are imported from Google Fonts in `frontend/index.html`. To change:

1. Remove current font link
2. Add new font from [fonts.google.com](https://fonts.google.com)
3. Update font-family in `tailwind.config.js`

### Animations

- Scroll animations: `frontend/src/hooks/useScrollAnimation.js`
- Cursor effects: `frontend/src/components/CursorFollower.jsx`
- Framer Motion animations: Check component files

## 🔐 Security Notes

1. **Never commit .env files** - Already in .gitignore
2. **Validate user inputs** on both frontend and backend
3. **Use environment variables** for all secrets
4. **Enable CORS properly** - Only allow your domain
5. **Rate limit API endpoints** - Prevent abuse
6. **Keep dependencies updated**

## 📱 Mobile Optimization

The site is fully responsive with:
- Mobile-friendly navigation menu
- Touch-optimized buttons
- Adjusted font sizes
- Responsive grid layouts
- Mobile-safe animations

Test on various devices using browser DevTools.

## ⚡ Performance Tips

1. **Frontend**: Vite automatically optimizes builds
2. **Backend**: Enable gzip compression in production
3. **Images**: Use optimized image formats
4. **Caching**: Implement browser caching headers
5. **Database**: If adding database, use indexes

## 🐛 Troubleshooting

### "Cannot find module" errors
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### CORS errors
- Check `FRONTEND_URL` in backend `.env`
- Ensure frontend and backend are on correct ports
- Verify CORS middleware is enabled

### OpenAI API errors
- Verify API key is valid
- Check API key has correct permissions
- Ensure account has available credits
- Test with `curl` command directly

### Chat not working
- Check browser console for errors
- Verify backend is running (`/api/health`)
- Check OpenAI API connection
- Review backend logs

## 📖 Project Structure

```
Final Boss/
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── styles/           # CSS files
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/
│   ├── routes/               # API routes
│   ├── middleware/           # Express middleware
│   ├── config/               # Configuration files
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
└── README.md
```

## 🚀 Next Steps

1. **Add Database** - MongoDB or PostgreSQL for storing messages
2. **Authentication** - Add user login/signup
3. **Admin Panel** - Manage projects and content
4. **Analytics** - Track visitor stats
5. **Blog** - Add blog section with articles
6. **Email Notifications** - Get notified on new contacts
7. **Search Functionality** - Search through projects

## 📄 License

This project is open source and available under the MIT License.

## 💬 Support

For issues or questions:
1. Check this README
2. Review browser console for errors
3. Check backend logs
4. Open an issue on GitHub

## 🙏 Acknowledgments

- **OpenAI** for the ChatGPT API
- **Vercel** for frontend hosting
- **Framer Motion** for beautiful animations
- **Tailwind CSS** for styling utilities

## 🎯 Tips for Success

1. **Test locally first** before deploying
2. **Keep your OpenAI API key secret**
3. **Update portfolio regularly** with new projects
4. **Monitor API usage** to avoid unexpected charges
5. **Get feedback** from friends and colleagues
6. **Iterate and improve** based on feedback

---

**Happy coding! 🎉 Build amazing things and share them with the world!**
