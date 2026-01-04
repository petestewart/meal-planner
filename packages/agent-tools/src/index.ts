// @meals/agent-tools - Claude agent interface
import { version as coreVersion } from '@meals/core';

export const version = '0.1.0';
export { coreVersion };

// Re-export all agent tool schemas
export * from './schemas/index.js';

// Re-export all agent tool handlers
export * from './tools/index.js';
