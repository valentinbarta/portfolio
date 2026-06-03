import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { apiKeyMiddleware, errorHandler } from './middleware/auth.js'
import contactRoutes from './routes/contact.js'
import chatRoutes from './routes/chat.js'

dotenv.config()
console.log(process.cwd())
console.log('Google AI API:', process.env.GOOGLE_API_KEY ? '✓ Configured' : '✗ Missing')

const app = express()
const PORT = process.env.PORT || 5000

app.use((req, res, next) => {
  console.log('Origin:', req.headers.origin)
  next()
})

// Middleware
app.use(express.json())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://portfolio-valentinb.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}))

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

app.use('/api/contact', contactRoutes)
app.use('/api/chat', chatRoutes)

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Error Handler
app.use(errorHandler)

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📧 Contact form endpoint: POST http://localhost:${PORT}/api/contact`)
  console.log(`💬 Chat endpoint: POST http://localhost:${PORT}/api/chat`)
})
