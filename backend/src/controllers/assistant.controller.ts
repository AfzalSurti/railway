import { Request, Response } from 'express';
import { handleAssistantMessage } from '../assistant/assistant.service';
import { AssistantSearchInput } from '../schemas/assistant.schema';
import { sendSuccess } from '../utils/apiResponse';

export const assistantController = {
  async search(req: Request, res: Response): Promise<void> {
    const body = req.body as AssistantSearchInput;
    const response = await handleAssistantMessage({
      message: body.message,
      draft: body.draft ?? {},
      awaiting: body.awaiting ?? null,
    });
    sendSuccess(res, response);
  },
};
