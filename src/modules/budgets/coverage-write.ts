import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { ClientSession, Connection, mongo, Types } from 'mongoose';

class CoverageLockInsertRace extends Error {}

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
    const owner = new Types.ObjectId(userId);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await activeSession.withTransaction(async () => {
          await connection
            .collection('budgetCoverageLocks')
            .updateOne(
              { _id: owner },
              { $inc: { revision: 1 } },
              { upsert: true, session: activeSession },
            )
            .catch((error: unknown) => {
              // Two first writes can race to insert this owner's lock document.
              // Retry the whole aborted transaction if Mongo did not mark it transient.
              if (
                error instanceof mongo.MongoServerError &&
                error.code === 11000 &&
                !error.hasErrorLabel('TransientTransactionError')
              )
                throw new CoverageLockInsertRace();
              throw error;
            });
          return work(activeSession);
        });
        if (result === undefined) throw new Error('Transaction did not commit');
        return result;
      } catch (error) {
        if (!(error instanceof CoverageLockInsertRace)) throw error;
      }
    }
    throw new Error('Coverage lock could not be acquired');
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new ServiceUnavailableException(
      'Coverage change could not be committed; transactional database required. Reload and retry',
    );
  } finally {
    await session?.endSession();
  }
}
