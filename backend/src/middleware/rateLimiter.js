'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication endpoints (login).
 * 5 attempts per IP per 15 minutes.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts from this IP. Please wait 15 minutes before trying again.'
  },
  skipSuccessfulRequests: true, // Only count failed attempts
});

/**
 * Rate limiter for ABHA/ABDM OTP generation.
 * 3 OTP requests per IP per 15 minutes — prevents ABDM account abuse.
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many OTP requests. Please wait 15 minutes before requesting another OTP.'
  },
});

/**
 * General API rate limiter for all routes.
 * 200 requests per IP per minute.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please slow down.'
  },
  skip: (req) => {
    // Skip rate limiting for health checks and metrics
    return req.path === '/health' || req.path === '/health-db';
  },
});

module.exports = { loginLimiter, otpLimiter, apiLimiter };
