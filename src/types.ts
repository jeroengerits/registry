export interface ComponentState {
  version: string;
  path: string;
}

export interface UiState {
  $schema?: string;
  components: Record<string, ComponentState>;
}

export interface CommandResult {
  output: string;
  exitCode: number;
}
