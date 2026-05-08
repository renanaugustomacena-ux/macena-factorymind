/**
 * R-INFLUX-TASK-001 — F-MED-DATA-001 closure regression.
 *
 * Locks down:
 *  - `tasksHealth()` returns ok:false with a missing-list when any of the
 *    three canonical downsampling tasks is absent (live query, not cache).
 *  - `bootstrapTasks()` enumerates tasks AFTER creation and logs `{name, id}`
 *    at INFO so the operator can correlate with the InfluxDB UI.
 *  - The set of canonical task names is the source of truth (importing
 *    EXPECTED_DOWNSAMPLING_TASKS from the writer module).
 */

'use strict';

const infoCalls = [];

jest.mock('../src/utils/logger', () => ({
  info: jest.fn((obj, msg) => { infoCalls.push({ obj, msg }); }),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn()
}));

let mockOrgs = [{ id: 'org-1' }];
let mockTasks = [];
let mockGetTasksError = null;
let mockGetOrgsError = null;
let mockPostedTasks = [];

jest.mock('@influxdata/influxdb-client', () => ({
  InfluxDB: jest.fn().mockImplementation(() => ({
    getWriteApi: () => ({
      useDefaultTags: jest.fn(),
      writePoint: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    }),
    getQueryApi: () => ({ queryRows: jest.fn() })
  })),
  Point: jest.fn().mockImplementation(() => ({
    tag: jest.fn().mockReturnThis(),
    floatField: jest.fn().mockReturnThis(),
    intField: jest.fn().mockReturnThis(),
    stringField: jest.fn().mockReturnThis(),
    booleanField: jest.fn().mockReturnThis(),
    timestamp: jest.fn().mockReturnThis()
  }))
}));

jest.mock('@influxdata/influxdb-client-apis', () => ({
  OrgsAPI: jest.fn().mockImplementation(() => ({
    getOrgs: jest.fn().mockImplementation(() => {
      if (mockGetOrgsError) return Promise.reject(mockGetOrgsError);
      return Promise.resolve({ orgs: mockOrgs });
    })
  })),
  TasksAPI: jest.fn().mockImplementation(() => ({
    getTasks: jest.fn().mockImplementation(() => {
      if (mockGetTasksError) return Promise.reject(mockGetTasksError);
      return Promise.resolve({ tasks: mockTasks });
    }),
    postTasks: jest.fn().mockImplementation(({ body }) => {
      mockPostedTasks.push(body);
      return Promise.resolve({ id: `created-${mockPostedTasks.length}` });
    })
  })),
  BucketsAPI: jest.fn().mockImplementation(() => ({
    getBuckets: jest.fn().mockResolvedValue({ buckets: [] })
  }))
}));

const influx = require('../src/services/influx-writer');

beforeEach(() => {
  mockOrgs = [{ id: 'org-1' }];
  mockTasks = [];
  mockGetTasksError = null;
  mockGetOrgsError = null;
  mockPostedTasks = [];
  infoCalls.length = 0;
});

describe('EXPECTED_DOWNSAMPLING_TASKS contract', () => {
  it('exports the three canonical names in the documented order', () => {
    expect(influx.EXPECTED_DOWNSAMPLING_TASKS).toEqual([
      'downsample_1m',
      'downsample_1h',
      'downsample_1d'
    ]);
  });

  it('is frozen — cannot be mutated by callers', () => {
    expect(Object.isFrozen(influx.EXPECTED_DOWNSAMPLING_TASKS)).toBe(true);
  });
});

describe('tasksHealth() (R-INFLUX-TASK-001)', () => {
  it('all 3 tasks present → ok:true, missing empty', async () => {
    mockTasks = [
      { name: 'downsample_1m', id: 't1', status: 'active' },
      { name: 'downsample_1h', id: 't2', status: 'active' },
      { name: 'downsample_1d', id: 't3', status: 'active' }
    ];
    const health = await influx.tasksHealth();
    expect(health.ok).toBe(true);
    expect(health.present).toEqual(['downsample_1m', 'downsample_1h', 'downsample_1d']);
    expect(health.missing).toEqual([]);
  });

  it('one task missing → ok:false with that name in missing[]', async () => {
    mockTasks = [
      { name: 'downsample_1m', id: 't1' },
      { name: 'downsample_1d', id: 't3' }
    ];
    const health = await influx.tasksHealth();
    expect(health.ok).toBe(false);
    expect(health.missing).toEqual(['downsample_1h']);
    expect(health.present).toEqual(['downsample_1m', 'downsample_1d']);
  });

  it('all 3 tasks missing → ok:false with all canonical names in missing[]', async () => {
    mockTasks = [];
    const health = await influx.tasksHealth();
    expect(health.ok).toBe(false);
    expect(health.missing).toEqual(['downsample_1m', 'downsample_1h', 'downsample_1d']);
    expect(health.present).toEqual([]);
  });

  it('extra non-canonical tasks do not affect ok:true', async () => {
    mockTasks = [
      { name: 'downsample_1m', id: 't1' },
      { name: 'downsample_1h', id: 't2' },
      { name: 'downsample_1d', id: 't3' },
      { name: 'custom_task', id: 't4' }
    ];
    const health = await influx.tasksHealth();
    expect(health.ok).toBe(true);
    expect(health.present).toEqual(['downsample_1m', 'downsample_1h', 'downsample_1d']);
  });

  it('Influx getTasks throws → ok:false with error message captured', async () => {
    mockGetTasksError = new Error('influxdb 503 service unavailable');
    const health = await influx.tasksHealth();
    expect(health.ok).toBe(false);
    expect(health.error).toBe('influxdb 503 service unavailable');
    expect(health.missing).toEqual(['downsample_1m', 'downsample_1h', 'downsample_1d']);
  });

  it('org not found → ok:false with "org not found"', async () => {
    mockOrgs = [];
    const health = await influx.tasksHealth();
    expect(health.ok).toBe(false);
    expect(health.error).toBe('org not found');
  });
});

describe('bootstrapTasks() logging (R-INFLUX-TASK-001)', () => {
  it('logs an INFO line listing tasks with id+name+status after creation', async () => {
    mockTasks = [
      { name: 'downsample_1m', id: 't1', status: 'active' },
      { name: 'downsample_1h', id: 't2', status: 'active' },
      { name: 'downsample_1d', id: 't3', status: 'active' }
    ];
    await influx.bootstrapTasks();
    const completed = infoCalls.find((c) => c.msg.includes('bootstrap complete'));
    expect(completed).toBeTruthy();
    expect(completed.obj.tasks).toEqual([
      { name: 'downsample_1m', id: 't1', status: 'active' },
      { name: 'downsample_1h', id: 't2', status: 'active' },
      { name: 'downsample_1d', id: 't3', status: 'active' }
    ]);
    expect(completed.obj.expected).toEqual(['downsample_1m', 'downsample_1h', 'downsample_1d']);
    expect(completed.obj.present_count).toBe(3);
  });
});
