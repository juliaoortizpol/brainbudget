import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports that the API is healthy', () => {
    const result = new HealthController().check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('brainbudget-api');
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
  });
});
