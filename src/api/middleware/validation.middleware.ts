import { Request, Response, NextFunction } from 'express';
import { ApiError } from './error.middleware';

/**
 * Middleware de validação genérico
 * Valida os dados da requisição contra um schema
 */
export const validate = (schema: any) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const errors = error.details.map((detail: any) => ({
                field: detail.path.join('.'),
                message: detail.message,
            }));

            throw new ApiError(400, 'Validation failed', true);
        }

        next();
    };
};

/**
 * Valida parâmetros de paginação
 */
export const validatePagination = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    const page = parseInt(req.query.page as string);
    const limit = parseInt(req.query.limit as string);

    if (page && (isNaN(page) || page < 1)) {
        throw new ApiError(400, 'Page must be a positive integer');
    }

    if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
        throw new ApiError(400, 'Limit must be between 1 and 100');
    }

    next();
};

/**
 * Valida ObjectId do MongoDB
 */
export const validateObjectId = (paramName: string = 'id') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const id = req.params[paramName];

        if (!id) {
            throw new ApiError(400, `${paramName} is required`);
        }

        const objectIdRegex = /^[a-f\d]{24}$/i;
        if (!objectIdRegex.test(id)) {
            throw new ApiError(400, `Invalid ${paramName} format`);
        }

        next();
    };
};

/**
 * Valida formato de telefone E.164
 */
export const validatePhoneE164 = (fieldName: string = 'phone') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const phone = req.body[fieldName];

        if (!phone) {
            return next();
        }

        const e164Regex = /^\+[1-9]\d{1,14}$/;
        if (!e164Regex.test(phone)) {
            throw new ApiError(
                400,
                `${fieldName} must be in E.164 format (e.g., +5511999999999)`,
            );
        }

        next();
    };
};

/**
 * Valida campos obrigatórios
 */
export const validateRequired = (fields: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const missingFields: string[] = [];

        for (const field of fields) {
            if (!req.body[field]) {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            throw new ApiError(
                400,
                `Missing required fields: ${missingFields.join(', ')}`,
            );
        }

        next();
    };
};

/**
 * Sanitiza entrada removendo campos perigosos
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
    if (req.body) {
        const dangerousFields = ['__proto__', 'constructor', 'prototype'];

        for (const field of dangerousFields) {
            if (field in req.body) {
                delete req.body[field];
            }
        }
    }

    next();
};
