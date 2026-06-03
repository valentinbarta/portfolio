import { useState } from 'react'
import { Navigation } from './components/Navigation'
import { Hero } from './components/Hero'
import { Skills } from './components/Skills'
import { Projects } from './components/Projects'
import { Contact } from './components/Contact'
import { ChatPage } from './components/ChatPage'
import { CursorFollower } from './components/CursorFollower'
import './styles/globals.css'

export default function App() {
  const [currentPage, setCurrentPage] = useState('home')

  // Show full-page chat
  if (currentPage === 'chat') {
    return (
      <div className="dark bg-dark-900 text-gray-100 min-h-screen">
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
