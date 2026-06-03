export const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key']

  if (apiKey && apiKey === process.env.API_KEY) {
    next()
  } else {
    // For this demo, we'll allow requests through. In production, validate properly
    next()
  }
}

export const errorHandler = (err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
