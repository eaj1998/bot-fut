import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../../logger/logger.service';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const createErrorHandler = (logger: LoggerService) => {
  return (
    err: Error | ApiError,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    // Handle known ApiError
    if (err instanceof ApiError) {
      logger.log(`API Error: ${err.message}`, {
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
      });

      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        statusCode: err.statusCode,
      });
    }

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      logger.log('Validation Error', { error: err.message });
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: err.message,
        statusCode: 400,
      });
    }

    // Handle Mongoose duplicate key errors
    if (err.name === 'MongoServerError' && (err as any).code === 11000) {
      const field = Object.keys((err as any).keyPattern)[0];
      logger.log('Duplicate Key Error', { field });
      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
        statusCode: 409,
      });
    }

    // Handle Mongoose CastError (invalid ObjectId)
    if (err.name === 'CastError') {
      logger.log('Cast Error', { error: err.message });
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format',
        statusCode: 400,
      });
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
      logger.log('JWT Error', { error: err.message });
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        statusCode: 401,
      });
    }

    if (err.name === 'TokenExpiredError') {
      logger.log('Token Expired Error');
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        statusCode: 401,
      });
    }

    // Unhandled errors
    logger.log('Unexpected error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
      statusCode: 500,
    });
  };
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware para tratar rotas não encontradas
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
  });
};
