import { useState } from 'react'
import { useScrollAnimation } from '../hooks/useScrollAnimation'
import { motion } from 'framer-motion'
import { Mail, MapPin, Phone } from 'lucide-react'
import axios from 'axios'

export const Contact = () => {
  const ref = useScrollAnimation()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('sending')

    try {
      await axios.post('/api/contact', formData)
      setStatus('success')
      setFormData({ name: '', email: '', subject: '', message: '' })
      setTimeout(() => setStatus(''), 3000)
    } catch (error) {
      setStatus('error')
      setTimeout(() => setStatus(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="contact" className="relative py-20" ref={ref}>
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-5xl font-bold text-center mb-16 gradient-text">Get In Touch</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-2xl font-bold mb-8">Let's Connect</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Mail className="text-neon-purple mt-1" size={24} />
                <div>
                  <h4 className="font-bold mb-1">Email</h4>
                  <a href="mailto:your.email@example.com" className="text-gray-400 hover:text-neon-purple">
                    your.email@example.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Phone className="text-neon-purple mt-1" size={24} />
                <div>
                  <h4 className="font-bold mb-1">Phone</h4>
                  <a href="tel:+1234567890" className="text-gray-400 hover:text-neon-purple">
                    +1 (234) 567-890
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <MapPin className="text-neon-purple mt-1" size={24} />
                <div>
                  <h4 className="font-bold mb-1">Location</h4>
                  <p className="text-gray-400">Your City, Country</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-4"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div>
              <input
                type="text"
                name="name"
                placeholder="Your Name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-dark-800 border border-neon-purple border-opacity-30 rounded-lg focus:outline-none focus:border-opacity-100 text-white transition"
              />
            </div>
            <div>
              <input
                type="email"
                name="email"
                placeholder="Your Email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-dark-800 border border-neon-purple border-opacity-30 rounded-lg focus:outline-none focus:border-opacity-100 text-white transition"
              />
            </div>
            <div>
              <input
                type="text"
                name="subject"
                placeholder="Subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-dark-800 border border-neon-purple border-opacity-30 rounded-lg focus:outline-none focus:border-opacity-100 text-white transition"
              />
            </div>
            <div>
              <textarea
                name="message"
                placeholder="Your Message"
                rows="5"
                value={formData.message}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-dark-800 border border-neon-purple border-opacity-30 rounded-lg focus:outline-none focus:border-opacity-100 text-white transition resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 font-bold disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Message'}
            </button>

            {status === 'success' && (
              <p className="text-green-400 text-center">Message sent successfully!</p>
            )}
            {status === 'error' && (
              <p className="text-red-400 text-center">Failed to send message. Try again!</p>
            )}
          </motion.form>
        </div>
      </div>
    </section>
  )
}
