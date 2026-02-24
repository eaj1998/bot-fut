import { Request, Response, NextFunction } from 'express';
import { ApiError } from './error.middleware';

import { plainToInstance } from 'class-transformer';
import { validate as classValidate } from 'class-validator';

/**
 * Middleware para validar DTOs com class-validator
 * Utiliza o whitelist e forbidNonWhitelisted para evitar Mass Assignment
 */
export const validateDto = (dtoClass: any) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.body) {
            req.body = {};
        }
        const dtoObj = plainToInstance(dtoClass, req.body, { enableImplicitConversion: true });

        const errors = await classValidate(dtoObj, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });

        if (errors.length > 0) {
            const validationErrors = errors.map(err => ({
                field: err.property,
                constraints: err.constraints
            }));

            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors,
                statusCode: 400
            });
        }

        req.body = dtoObj;
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
