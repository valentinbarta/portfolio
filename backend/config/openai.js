import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

console.log('GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? '✓ Configured' : '✗ Missing')

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

export { genAI }