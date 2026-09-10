import { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler => {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
};
