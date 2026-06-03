import Groq from 'groq-sdk'
import 'dotenv/config'

console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✓ Configured' : '✗ Missing')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export { groq }