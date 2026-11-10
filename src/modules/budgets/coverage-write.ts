import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { ClientSession, Connection, Types } from 'mongoose';

/** All coverage-changing writers take this owner lock BEFORE reading a snapshot. */
export async function coverageWrite<T>(
  connection: Connection,
  userId: string,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  let session: ClientSession | undefined;
  try {
    session = await connection.startSession();
    const activeSession = session;
    const result = await session.withTransaction(async () => {
      await connection
        .collection('budgetCoverageLocks')
        .updateOne(
          { _id: new Types.ObjectId(userId) },
          { $inc: { revision: 1 } },
          { upsert: true, session: activeSession },
        );
      return work(activeSession);
    });
    if (result === undefined) throw new Error('Transaction did not commit');
    return result;
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new ServiceUnavailableException(
      'Coverage change could not be committed; transactional database required. Reload and retry',
    );
  } finally {
    await session?.endSession();
  }
}
