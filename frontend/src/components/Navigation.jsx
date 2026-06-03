import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export const Navigation = ({ onChatClick }) => {
  const [isOpen, setIsOpen] = useState(false)

  const navLinks = ['Home', 'Skills', 'Projects', 'Contact', 'AI Chat']

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setIsOpen(false)
    }
  }

  const handleNavClick = (link) => {
    if (link.toLowerCase() === 'ai chat') {
      onChatClick()
    } else {
      scrollToSection(link.toLowerCase().replace(' ', '-'))
    }
    setIsOpen(false)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 bg-dark-900 bg-opacity-95 backdrop-blur-md z-50 border-b border-neon-purple border-opacity-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center cursor-pointer" onClick={() => scrollToSection('home')}>
            <span className="text-2xl font-bold gradient-text">Portfolio</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8">
            {navLinks.map((link) => (
              <button
                key={link}
                onClick={() => handleNavClick(link)}
                className="text-gray-300 hover:text-neon-purple transition duration-300 font-medium"
              >
                {link}
              </button>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-neon-purple hover:text-neon-pink"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden bg-dark-800 border-t border-neon-purple border-opacity-20">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link}
                  onClick={() => handleNavClick(link)}
                  className="block w-full text-left px-3 py-2 text-gray-300 hover:text-neon-purple hover:bg-dark-700 rounded-md transition"
                >
                  {link}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
