/** Shared domain and CLI result types used across the registry. */

/** Maps a repository file to its project-relative installation target. */
export interface ComponentFile {
  source: string;
  target: string;
}

/** Validated manifest published by a component repository. */
export interface ComponentManifest {
  schemaVersion: 1;
  name: string;
  description?: string;
  files: ComponentFile[];
  dependencies: Record<string, string>;
  components: ComponentReference[];
}

/** Optional dependency on another component repository. */
export interface ComponentReference {
  repository: string;
  version?: string;
}

/** Hash metadata recorded for an installed component file. */
export interface InstalledFile {
  path: string;
  sha256: string;
}

/** Persisted installation metadata and enabled state for one component. */
export interface ComponentState {
  enabled: boolean;
  version: string;
  constraint?: string;
  path: string;
  repository?: string;
  files?: InstalledFile[];
  dependencies?: ComponentReference[];
}

/** Project-level registry state stored in `ui.json`. */
export interface UiState {
  $schema?: string;
  version?: string;
  components: Record<string, ComponentState>;
}

/** Text output and process status returned by a CLI command. */
export interface CommandResult {
  output: string;
  exitCode: number;
  /** Structured payload used when composing commands and rendering JSON. */
  data?: unknown;
  /** Human-readable diagnostics that belong on stderr. */
  error?: string;
}
