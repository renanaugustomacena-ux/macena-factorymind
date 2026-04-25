/**
 * Jest setup — isolate environment for unit tests. Tests that need a real
 * broker / database use dedicated integration-test files (not bundled here).
 */

'use strict';

process.env.APP_ENV = process.env.APP_ENV || 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_factorymind';
process.env.INFLUX_URL = process.env.INFLUX_URL || 'http://localhost:8086';
process.env.INFLUX_TOKEN = process.env.INFLUX_TOKEN || 'test-token-0123456789abcdef';
process.env.INFLUX_ORG = process.env.INFLUX_ORG || 'test-org';
process.env.INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'test-bucket';
process.env.MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-32-characters-xxx';
