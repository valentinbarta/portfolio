import express from 'express'
import nodemailer from 'nodemailer'
import Contact from '../models/Contact.js'

const router = express.Router()

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Save to MongoDB
    const contact = new Contact({ name, email, subject, message })
    await contact.save()
    console.log('Contact saved to DB:', contact._id)

    // Respond immediately — don't wait for email
    res.json({ success: true, message: 'Message received successfully' })

    // Send email in background (won't block the response)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD !== 'testme') {
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Thank you for contacting me',
        html: `<h3>Hi ${name},</h3><p>I received your message and will get back to you soon!</p>`
      }).catch(err => console.error('Email error:', err))
    }

  } catch (error) {
    console.error('Contact error:', error)
    res.status(500).json({ error: 'Failed to process contact form' })
  }
})

export default router