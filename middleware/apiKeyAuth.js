// middleware/apiKeyAuth.js
export default function apiKeyAuth(req, res, next) {
  const apiKey = req.header('x-api-key');
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(403).json({ message: 'Forbidden: Invalid API key' });
  }
  next();
}

