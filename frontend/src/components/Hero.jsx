import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown } from 'lucide-react'

export const Hero = () => {
  const [displayedText, setDisplayedText] = useState('')
  const fullText = 'Full-Stack Developer & AI Enthusiast'

  useEffect(() => {
    let index = 0
    const interval = setInterval(() => {
      if (index < fullText.length) {
        setDisplayedText(fullText.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [])

  return (
    <section id="home" className="relative pt-20 min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(168, 85, 247, 0.1) 25%, rgba(168, 85, 247, 0.1) 26%, transparent 27%, transparent 74%, rgba(168, 85, 247, 0.1) 75%, rgba(168, 85, 247, 0.1) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(168, 85, 247, 0.1) 25%, rgba(168, 85, 247, 0.1) 26%, transparent 27%, transparent 74%, rgba(168, 85, 247, 0.1) 75%, rgba(168, 85, 247, 0.1) 76%, transparent 77%, transparent)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="max-w-4xl mx-auto text-center z-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="gradient-text">Hello, I'm Vali</span>
          </h1>

          <h2 className="text-2xl md:text-4xl font-semibold text-neon-purple mb-6 h-16 flex items-center justify-center">
            {displayedText}
            <span className="animate-pulse">|</span>
          </h2>

          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-8">
            I create beautiful, responsive web applications with cutting-edge technologies.
            Specializing in React, Node.js, and AI integrations to build the next generation of digital experiences.
          </p>

          <motion.div
            className="flex gap-4 justify-center flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <button className="btn-primary px-8 py-3 text-lg">
              View My Work
            </button>
            <button className="btn-secondary px-8 py-3 text-lg">
              Contact Me
            </button>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ArrowDown size={32} className="text-neon-purple" />
        </motion.div>
      </div>
    </section>
  )
}
