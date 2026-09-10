export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type Passenger = {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  createdAt: string;
  updatedAt: string;
};

export type PassengerInput = {
  name: string;
  age: number;
  gender: Gender;
  phone: string;
};
