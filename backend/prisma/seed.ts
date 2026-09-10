import { PrismaClient, BookingStatus, Gender, ServiceType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = 'demo@example.com';
  const passwordHash = await bcrypt.hash('password123', 12);

  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: {
      name: 'Demo User',
      email,
      phone: '9999999999',
      passwordHash,
    },
  });

  const rahul = await prisma.passenger.create({
    data: {
      userId: user.id,
      name: 'Rahul Jani',
      age: 30,
      gender: Gender.MALE,
      phone: '9876543210',
    },
  });

  const priya = await prisma.passenger.create({
    data: {
      userId: user.id,
      name: 'Priya Shah',
      age: 28,
      gender: Gender.FEMALE,
      phone: '9876543211',
    },
  });

  const firstBooking = await prisma.bookingTask.create({
    data: {
      userId: user.id,
      serviceType: ServiceType.TRAIN,
      provider: 'MOCK',
      source: 'BRC',
      destination: 'MMCT',
      journeyDate: new Date('2026-08-28T00:00:00.000Z'),
      scheduledAt: new Date('2026-08-27T04:25:00.000Z'),
      trainNumber: '20902',
      travelClass: '3A',
      quota: 'GENERAL',
      status: BookingStatus.SCHEDULED,
      passengers: { create: [{ passengerId: rahul.id }] },
    },
  });

  const secondBooking = await prisma.bookingTask.create({
    data: {
      userId: user.id,
      serviceType: ServiceType.TRAIN,
      provider: 'IRCTC',
      source: 'MMCT',
      destination: 'BRC',
      journeyDate: new Date('2026-09-05T00:00:00.000Z'),
      scheduledAt: new Date('2026-09-04T04:00:00.000Z'),
      trainNumber: '12932',
      travelClass: 'CC',
      quota: 'GENERAL',
      status: BookingStatus.SCHEDULED,
      passengers: { create: [{ passengerId: priya.id }] },
    },
  });

  await prisma.executionLog.createMany({
    data: [
      {
        bookingTaskId: firstBooking.id,
        step: 'TASK_CREATED',
        status: 'INFO',
        message: 'Seed booking task created. No real booking was executed.',
        metadata: { train: '20902', phase: 1 },
      },
      {
        bookingTaskId: secondBooking.id,
        step: 'TASK_CREATED',
        status: 'INFO',
        message: 'Seed return booking task created. No real booking was executed.',
        metadata: { train: '12932', phase: 1 },
      },
    ],
  });

  console.log('Seed complete');
  console.log('Demo user: demo@example.com / password123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
