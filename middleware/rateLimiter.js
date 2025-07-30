import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1005, // limit each IP to 5 requests per window
  message: '❌ Too many requests from this IP, please try again later.',
  handler: (request, response, next, options) => {
    console.warn(`⚠️ Rate limit exceeded for IP: ${request.ip}`);
    response.status(options.statusCode).json({ message: options.message });
  },
});