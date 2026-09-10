export type NodeEnvironment = 'development' | 'test' | 'production';

export interface ErrorHandlingConfig {
  nodeEnv: NodeEnvironment;
  includeDebugDetails: boolean;
}

function readNodeEnvironment(environment: NodeJS.ProcessEnv): NodeEnvironment {
  return environment.NODE_ENV === 'development' ||
    environment.NODE_ENV === 'test'
    ? environment.NODE_ENV
    : 'production';
}

// Fail-closed: only an exact opt-in in development enables response diagnostics.
export function getErrorHandlingConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ErrorHandlingConfig {
  const nodeEnv = readNodeEnvironment(environment);
  const includeDebugDetails =
    nodeEnv === 'development' &&
    environment.ERROR_DETAILS_IN_RESPONSE === 'true';
  return { nodeEnv, includeDebugDetails };
}
