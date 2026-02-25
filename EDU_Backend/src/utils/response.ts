import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export const sendSuccess = <T>(res: Response, data?: T, message = 'Success', statusCode = 200): Response => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  } as ApiResponse<T>);
};

export const sendError = (res: Response, error: string, statusCode = 500): Response => {
  return res.status(statusCode).json({
    success: false,
    error,
  } as ApiResponse);
};

export const sendCreated = <T>(res: Response, data?: T, message = 'Created successfully'): Response => {
  return sendSuccess(res, data, message, 201);
};

export const sendNotFound = (res: Response, message = 'Resource not found'): Response => {
  return sendError(res, message, 404);
};

export const sendBadRequest = (res: Response, message = 'Bad request'): Response => {
  return sendError(res, message, 400);
};

export const sendUnauthorized = (res: Response, message = 'Unauthorized'): Response => {
  return sendError(res, message, 401);
};
