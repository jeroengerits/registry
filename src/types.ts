export interface ComponentFile {
  source: string;
  target: string;
}

export interface ComponentManifest {
  schemaVersion: 1;
  name: string;
  description?: string;
  files: ComponentFile[];
  dependencies: Record<string, string>;
  components: ComponentReference[];
}

export interface ComponentReference {
  repository: string;
  version?: string;
}

export interface InstalledFile {
  path: string;
  sha256: string;
}

export interface ComponentState {
  version: string;
  constraint?: string;
  path: string;
  repository?: string;
  files?: InstalledFile[];
  dependencies?: ComponentReference[];
}

export interface UiState {
  $schema?: string;
  version?: string;
  components: Record<string, ComponentState>;
}

export interface CommandResult {
  output: string;
  exitCode: number;
}
