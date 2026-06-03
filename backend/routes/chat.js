import express from 'express'
import { groq } from '../config/openai.js'

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

Valentin's Portfolio Context:
- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express
- AI Integration: Groq API chatbot
- Projects: AI Portfolio Chatbot, Developer Portfolio Website
`

router.post('/', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'Groq API key not configured' })
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory
        .filter(msg => msg && msg.text && msg.sender)
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        })),
      { role: 'user', content: message }
    ]

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      max_tokens: 1500,
      temperature: 0.7
    })

    const reply = response.choices[0].message.content

    res.json({ reply, success: true })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({
      error: error.message || 'Failed to process chat message'
    })
  }
})

export default router