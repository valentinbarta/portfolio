import { useScrollAnimation } from '../hooks/useScrollAnimation'
import { motion } from 'framer-motion'
import { Code, Database, Zap, Brain } from 'lucide-react'

export const Skills = () => {
  const ref = useScrollAnimation()

  const skills = [
    { icon: Code, title: 'Frontend', desc: 'React, Vue, Tailwind CSS, JavaScript/TypeScript' },
    { icon: Database, title: 'Backend', desc: 'Node.js, Express, MongoDB, PostgreSQL, REST APIs' },
    { icon: Zap, title: 'DevOps', desc: 'Docker, Git, CI/CD, Cloud Deployment, Vercel, Railway' },
    { icon: Brain, title: 'AI/ML', desc: 'OpenAI API, ChatGPT Integration, Prompt Engineering' }
  ]

  return (
    <section id="skills" className="relative py-20" ref={ref}>
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-5xl font-bold text-center mb-16 gradient-text">Skills & Expertise</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {skills.map((skill, idx) => {
            const Icon = skill.icon
            return (
              <motion.div
                key={idx}
                className="card group cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-neon-purple bg-opacity-20 rounded-lg group-hover:bg-opacity-40 transition">
                    <Icon size={32} className="text-neon-purple" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-center mb-3">{skill.title}</h3>
                <p className="text-gray-400 text-center text-sm">{skill.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
