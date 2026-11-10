import { BadRequestException } from '@nestjs/common';
import { ClientSession, Types } from 'mongoose';
import { coverageWrite } from './coverage-write';
import { coverageTestConnection } from '../../../test/coverage-test-support';

describe('owner coverage write protocol (controlled)', () => {
  const owner = String(new Types.ObjectId());
  it('takes an owner-specific write lock before reading or writing and routes the same session', async () => {
    const connection = coverageTestConnection();
    const work = jest.fn((session: ClientSession) => {
      expect(session).toBe(connection.session);
      expect(connection.lock).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(owner) },
        { $inc: { revision: 1 } },
        { session, upsert: true },
      );
      return Promise.resolve('committed');
    });
    expect(await coverageWrite(connection as never, owner, work)).toBe(
      'committed',
    );
    expect(connection.session.endSession).toHaveBeenCalledTimes(1);
  });
  it('does no work without transaction support and returns a sanitized retry error', async () => {
    const connection = coverageTestConnection();
    connection.session.withTransaction.mockRejectedValue(
      new Error('private database detail'),
    );
    const work = jest.fn();
    await expect(
      coverageWrite(connection as never, owner, work),
    ).rejects.toThrow('transactional database required');
    expect(work).not.toHaveBeenCalled();
    expect(connection.session.endSession).toHaveBeenCalled();
  });
  it('propagates actionable validation errors while requesting transaction abort', async () => {
    const connection = coverageTestConnection();
    await expect(
      coverageWrite(connection as never, owner, () =>
        Promise.reject(new BadRequestException('Resolve saved assignment')),
      ),
    ).rejects.toThrow('Resolve saved assignment');
    expect(connection.session.endSession).toHaveBeenCalled();
  });
});
