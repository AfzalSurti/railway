export type PublicUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthPayload = {
  user: PublicUser;
  token: string;
};
