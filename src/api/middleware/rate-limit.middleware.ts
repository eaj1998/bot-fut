import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter geral para todas as requisições
 */
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many requests, please try again later',
        statusCode: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter para autenticação (mais restritivo)
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again later',
        statusCode: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

/**
 * Rate limiter para criação de recursos (moderado)
 */
export const createLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: 'Too many creation requests, please slow down',
        statusCode: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
});
