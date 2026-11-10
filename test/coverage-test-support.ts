/** Controlled unit-test transaction routing; this does not emulate Mongo isolation. */
export function coverageTestConnection() {
  const lock = jest.fn().mockResolvedValue({ matchedCount: 1 });
  const session = {
    withTransaction: jest.fn((work: () => Promise<unknown>) => work()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
  return {
    startSession: jest.fn().mockResolvedValue(session),
    collection: jest.fn(() => ({ updateOne: lock })),
    session,
    lock,
  };
}
