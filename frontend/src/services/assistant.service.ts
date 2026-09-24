import { api } from './api';
import type { ApiSuccess } from '../types/api';
import type { AssistantDraft, AssistantResponse, AssistantSlot } from '../types/assistant';

export const assistantService = {
  async search(input: { message: string; draft: AssistantDraft; awaiting: AssistantSlot | null }) {
    const { data } = await api.post<ApiSuccess<AssistantResponse>>('/api/assistant/search', input);
    return data.data;
  },
};
