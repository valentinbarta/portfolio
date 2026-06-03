import { useScrollAnimation } from '../hooks/useScrollAnimation'
import { motion } from 'framer-motion'
import { ExternalLink, Github } from 'lucide-react'

export const Projects = () => {
  const ref = useScrollAnimation()

  const projects = [
    {
      title: 'E-Commerce Platform',
      description: 'Full-stack MERN application with Stripe integration, product management, and real-time inventory tracking.',
      tech: ['React', 'Node.js', 'MongoDB', 'Stripe'],
      image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&h=300&fit=crop',
      link: '#'
    },
    {
      title: 'AI Chat Assistant',
      description: 'Intelligent chatbot powered by OpenAI API with conversation history and context management.',
      tech: ['React', 'Express', 'OpenAI', 'Socket.io'],
      image: 'https://images.unsplash.com/photo-1676499365986-cd18447ed636?w=500&h=300&fit=crop',
      link: '#'
    },
    {
      title: 'Analytics Dashboard',
      description: 'Interactive data visualization dashboard with real-time metrics and custom reporting.',
      tech: ['React', 'D3.js', 'Node.js', 'PostgreSQL'],
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&h=300&fit=crop',
      link: '#'
    },
    {
      title: 'Real Estate Listing App',
      description: 'Modern real estate platform with advanced filtering, map integration, and user authentication.',
      tech: ['Vue.js', 'Firebase', 'Google Maps', 'Tailwind'],
      image: 'https://images.unsplash.com/photo-1552674605-5defe6aa44bb?w=500&h=300&fit=crop',
      link: '#'
    }
  ]

  return (
    <section id="projects" className="relative py-20" ref={ref}>
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-5xl font-bold text-center mb-16 gradient-text">Recent Projects</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {projects.map((project, idx) => (
            <motion.div
              key={idx}
              className="card overflow-hidden group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <div className="relative h-48 overflow-hidden rounded-lg mb-4">
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                />
              </div>
              <h3 className="text-2xl font-bold mb-2">{project.title}</h3>
              <p className="text-gray-400 mb-4">{project.description}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {project.tech.map((t, i) => (
                  <span key={i} className="px-3 py-1 bg-neon-purple bg-opacity-20 text-neon-purple text-sm rounded">
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex gap-3">
                <a href={project.link} className="flex items-center gap-2 text-neon-purple hover:text-neon-pink transition">
                  <ExternalLink size={18} /> Live
                </a>
                <a href={project.link} className="flex items-center gap-2 text-neon-purple hover:text-neon-pink transition">
                  <Github size={18} /> Code
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
