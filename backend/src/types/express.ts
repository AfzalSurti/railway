export {};

declare global {
  // Express uses a namespace for Request augmentation.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
