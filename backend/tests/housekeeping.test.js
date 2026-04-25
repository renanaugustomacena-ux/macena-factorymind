/**
 * Housekeeping scheduler — contract test.
 */

'use strict';

const mockPoolQuery = jest.fn();
jest.mock('../src/db/pool', () => ({
  pool: { query: (...a) => mockPoolQuery(...a), end: jest.fn() }
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(),
  debug: jest.fn(), fatal: jest.fn()
}));

const housekeeping = require('../src/services/housekeeping');

describe('housekeeping.runOnce', () => {
  beforeEach(() => mockPoolQuery.mockReset());

  it('chiama factorymind_housekeeping() e ritorna le righe', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        { task: 'audit_log_retention', rows_affected: 5 },
        { task: 'refresh_tokens_expired', rows_affected: 2 },
        { task: 'users_hard_deleted', rows_affected: 0 }
      ]
    });
    const rows = await housekeeping.runOnce();
    expect(rows).toHaveLength(3);
    expect(mockPoolQuery).toHaveBeenCalledWith(expect.stringContaining('factorymind_housekeeping'));
  });

  it('ritorna null e non lancia su errore DB', async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error('connection refused'));
    const rows = await housekeeping.runOnce();
    expect(rows).toBeNull();
  });
});

describe('housekeeping.start/stop', () => {
  afterEach(() => housekeeping.stop());

  it('interval=0 non avvia timer', () => {
    housekeeping.start(0);
    expect(housekeeping._state().running).toBe(false);
  });
});
