# Frontend Update: Dedicated Chat Page

## Current Issue
The "AI Chat" button in navbar scrolls to a section instead of opening a dedicated full-page chat.

## Solution: Full-Page Chat Component

### Step 1: Update App.jsx

Replace the current App.jsx with this:

```jsx
import { useState } from 'react'
import { Navigation } from './components/Navigation'
import { Hero } from './components/Hero'
import { Skills } from './components/Skills'
import { Projects } from './components/Projects'
import { Contact } from './components/Contact'
import { AIChat } from './components/AIChat'
import { ChatPage } from './components/ChatPage'
import { CursorFollower } from './components/CursorFollower'
import './styles/globals.css'

export default function App() {
  const [currentPage, setCurrentPage] = useState('home')

  // Show full-page chat
  if (currentPage === 'chat') {
    return (
      <div className="dark bg-dark-900 text-gray-100">
        <CursorFollower />
        <ChatPage onBack={() => setCurrentPage('home')} />
      </div>
    )
  }

  // Show portfolio home
  return (
    <div className="dark bg-dark-900 text-gray-100">
      <CursorFollower />
      <Navigation onChatClick={() => setCurrentPage('chat')} />
      <Hero />
      <Skills />
      <Projects />
      <Contact />

      {/* Footer */}
      <footer className="bg-dark-800 border-t border-neon-purple border-opacity-20 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-400">
          <p>© 2026 Vali's Portfolio. All rights reserved. | Crafted with passion ❤️</p>
        </div>
      </footer>
    </div>
  )
}
```

### Step 2: Update Navigation.jsx

Update the "AI Chat" button to call a function:

```jsx
// In Navigation component, update the navLinks click handler:

const handleNavClick = (link) => {
  if (link.toLowerCase() === 'ai chat') {
    // Call the onChatClick prop instead of scrolling
    props.onChatClick()
  } else {
    scrollToSection(link.toLowerCase().replace(' ', '-'))
  }
  setIsOpen(false)
}

// Update button:
<button
  onClick={() => handleNavClick(link)}
  className="text-gray-300 hover:text-neon-purple transition duration-300 font-medium"
>
  {link}
</button>
```

### Step 3: Create ChatPage.jsx

Create a new file: `components/ChatPage.jsx`

```jsx
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, ArrowLeft } from 'lucide-react'
import axios from 'axios'

export const ChatPage = ({ onBack }) => {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hi! I'm your AI assistant. How can I help you today?", sender: 'bot' }
  ])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage = { id: Date.now(), text: inputValue, sender: 'user' }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setLoading(true)

    try {
      const response = await axios.post('/api/chat', {
        message: inputValue,
        conversationHistory: messages
      })

      const botMessage = {
        id: Date.now() + 1,
        text: response.data.reply,
        sender: 'bot'
      }
      setMessages(prev => [...prev, botMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I encountered an error. Please try again.",
        sender: 'bot'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 flex flex-col bg-dark-900 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-neon-purple to-neon-pink p-4 flex justify-between items-center border-b border-neon-purple border-opacity-20">
        <div>
          <h1 className="text-3xl font-bold">AI Chat</h1>
          <p className="text-sm text-gray-300">Powered by Google Gemini</p>
        </div>
        <motion.button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-10 hover:bg-opacity-20 rounded-lg transition"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft size={20} />
          Back
        </motion.button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl px-6 py-3 rounded-lg ${
                msg.sender === 'user'
                  ? 'bg-neon-purple text-white rounded-br-none'
                  : 'bg-dark-700 text-gray-200 rounded-bl-none'
              }`}
            >
              {msg.text}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-dark-700 px-6 py-3 rounded-lg rounded-bl-none">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-neon-purple rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-neon-purple rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-neon-purple rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neon-purple border-opacity-20 bg-dark-800 p-6 flex gap-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !loading && handleSendMessage()}
          placeholder="Type your message... (or press Enter)"
          className="flex-1 bg-dark-700 border border-neon-purple border-opacity-30 rounded-lg px-4 py-3 focus:outline-none focus:border-opacity-100 transition text-white placeholder-gray-400"
          disabled={loading}
        />
        <motion.button
          onClick={handleSendMessage}
          disabled={loading || !inputValue.trim()}
          className="bg-gradient-to-r from-neon-purple to-neon-pink hover:from-neon-pink hover:to-neon-purple text-white p-3 rounded-lg transition disabled:opacity-50"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Send size={20} />
        </motion.button>
      </div>
    </motion.div>
  )
}
```

### Step 3: Update Navigation.jsx props

```jsx
export const Navigation = ({ onChatClick }) => {
  // ... existing code ...

  const handleNavClick = (link) => {
    if (link.toLowerCase() === 'ai chat') {
      onChatClick()
    } else {
      scrollToSection(link.toLowerCase().replace(' ', '-'))
    }
    setIsOpen(false)
  }

  // Update button clicks to use handleNavClick
  // Change: onClick={() => scrollToSection(link.toLowerCase().replace(' ', '-'))}
  // To: onClick={() => handleNavClick(link)}
}
```

---

## ✅ After Updates

1. Click "AI Chat" in navbar → Full page chat opens
2. Chat with Google Gemini
3. Click "Back" → Return to portfolio
4. Floating chat button removed (replaced with page)

---

## 🧪 Test Checklist

- [ ] Navbar "AI Chat" button works
- [ ] Chat page opens fullscreen
- [ ] Can send/receive messages
- [ ] Back button returns to home
- [ ] Smooth transitions
- [ ] Mobile responsive

---

Ready to apply these changes? Let me know! 🚀
