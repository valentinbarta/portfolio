import express from 'express'
import { genAI } from '../config/openai.js'

const router = express.Router()

const systemPrompt = `
You are a friendly and helpful AI assistant on Valentin's portfolio website.

Your role is to:
- Answer questions about Valentin's skills, projects, and experience
- Provide information about web development, AI, and software engineering
- Help recruiters or collaborators understand his work
- Be professional, clear, and concise
- Stay helpful and approachable

Rules:
- Do NOT invent skills, projects, or experience
- If you don't know something, say so honestly
- Keep responses short and useful unless asked for detail
`

const portfolioContext = `
Valentin's Portfolio Context:
- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express
- AI Integration: Gemini API chatbot
- Projects: AI Portfolio Chatbot, Developer Portfolio Website
`

router.post('/', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    if (!process.env.GOOGLE_API_KEY) {
      return res.status(500).json({ error: 'Google AI API key not configured' })
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash'
    })

    // Clean conversation history
    let history = conversationHistory
      .filter(msg => msg && msg.text && msg.sender)
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }))

    // Remove invalid starting role (must start user/model properly alternating)
    if (history.length > 0 && history[0].role === 'model') {
      history = history.slice(1)
    }

const chat = model.startChat({
  history,
  systemInstruction: {
    role: 'user',
    parts: [
      {
        text: `${systemPrompt}\n\n${portfolioContext}`
      }
    ]
  },
  generationConfig: {
    maxOutputTokens: 1500,
    temperature: 0.7
  }
})

    const response = await chat.sendMessage(message)
    const reply = response.response.text()

    res.json({ reply, success: true })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({
      error: error.message || 'Failed to process chat message'
    })
  }
})

export default router