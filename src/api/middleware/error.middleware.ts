import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../../logger/logger.service';
import { inject } from 'tsyringe';


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
    if (err instanceof ApiError) {
      logger.log(`API Error: ${err.message}`, { statusCode: err.statusCode, path: req.path });
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        statusCode: err.statusCode,
      });
    }

    // Unhandled errors
    logger.log('Unexpected error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      statusCode: 500,
    });
  };
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
