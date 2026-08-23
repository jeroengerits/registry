import path from 'node:path';
// Return the shared command result shape used by the CLI runner.
import type { CommandResult } from '../../../types.js';
// Read the project state and the application version before planning changes.
import { readRootVersion, readState } from '../../../state.js';
// Parse component sources, discover stable versions, and preserve update constraints.
import { availableVersions, parseGitReference, updateConstraint } from '../../../git.js';
// Resolve dependency graphs, validate file plans, and apply staged mutations safely.
import { applyPlans, aggregateDependencies, errorResult, planFiles, resolveReferences } from '../shared.js';
// Use the shared terminal interaction, formatting, and progress behavior.
import { chooseVersion, confirmAction, frame, interactive, withSpinner } from '../../ui.js';
// Render human output or clean machine-readable JSON from the same payload.
import { cancelled, present } from '../../presentation.js';
// Save the prior state before an update so the operation can be undone.
import { saveRollback } from './revert.js';
// Render update plans and progress using the shared update vocabulary.
import { renderUpdateIntent, renderUpdateReport, updateProgress, type UpdateItem } from '../../update-flow.js';

/**
 * Resolves, validates, stages, and installs one or more components.
 *
 * The function intentionally performs all validation before mutation so normal
 * failures leave the project and its persisted state unchanged.
 */
export async function addComponent(
  cwd: string,
  references: string[],
  options: {
    dryRun: boolean;
    force: boolean;
    update: boolean;
    version?: string;
    json: boolean;
    command?: string;
  },
): Promise<CommandResult> {
  // Reject an empty source list with the canonical usage diagnostic.
  if (!references.length) {
    return errorResult('Usage: ui add <repository-or-path> [--version <version>] [--dry-run] [--force] [--json]', options.json);
  }

  // Reject versions that are not stable three-part semantic versions.
  if (options.version && !/^v?\d+\.\d+\.\d+$/.test(options.version)) {
    return errorResult('The --version value must be a stable semver version such as 1.2.3.', options.json);
  }

  // Normalize every source relative to the project before any repository work.
  const referencesWithVersion = references.map((reference) => parseGitReference(reference, cwd));

  // Non-interactive installs can report discovered versions without prompting.
  const showAvailableVersions = !interactive() && !options.version && referencesWithVersion.some((reference) => !reference.version);

  // Apply one explicit version to every source when the caller supplied it.
  if (options.version) {
    // Process each source so a conflicting inline version is reported precisely.
    for (const reference of referencesWithVersion) {
      // Avoid silently choosing between two competing version specifications.
      if (reference.version) {
        throw new Error('Specify the component version either in the URL or with --version, not both.');
      }

      // Persist the explicit version into the normalized reference.
      reference.version = options.version;
    }
  } else if (interactive()) {
    // Interactive users can choose a stable version for each unpinned source.
    for (const reference of referencesWithVersion) {
      // Preserve a version that was already included in the source reference.
      if (reference.version) continue;

      // Ask Git for stable tags before displaying the version selector.
      const versions = await availableVersions(reference.repository);

      // Do not present an empty selector when the repository has no release tags.
      if (!versions.length) {
        throw new Error(`Repository ${reference.repository} has no stable semver tag.`);
      }

      // Store the selected version so dependency resolution uses the same choice.
      reference.version = await chooseVersion(reference.repository, versions);
    }
  }

  // Resolve the complete dependency graph before entering the mutation phase.
  const resolved = await withSpinner(
    'Resolving component versions...',
    () => resolveReferences(referencesWithVersion, path.join(cwd, '.ui-sources')),
    (value) => `Resolved ${value.length} component${value.length === 1 ? '' : 's'}`,
    !options.json,
  );

  try {
    // Track names so duplicate manifests cannot produce ambiguous state.
    const names = new Set<string>();

    // Validate every resolved manifest name before planning files.
    for (const item of resolved) {
      // Reject duplicate component identities inside one install operation.
      if (names.has(item.manifest.name)) {
        throw new Error(`Duplicate component ${item.manifest.name}.`);
      }

      // Remember the validated name for later duplicate checks.
      names.add(item.manifest.name);
    }

    // Load the existing project state once for planning and rollback.
    const loadedState = await readState(cwd);

    // Use an empty state for a first install without writing it prematurely.
    const state = loadedState ?? { components: {} };

    // Clone the previous state so a failed mutation can restore exact metadata.
    const previousState = loadedState ? JSON.parse(JSON.stringify(loadedState)) as typeof loadedState : null;

    // Preserve the application version in newly written registry state.
    const rootVersion = await readRootVersion(cwd);

    // Only overwrite the state version when the project declares one.
    if (rootVersion) state.version = rootVersion;

    // Identify root repositories so dependency updates can be filtered correctly.
    const rootRepositories = new Set(referencesWithVersion.map((reference) => reference.repository));

    // Keep root results separate from recursively resolved dependencies.
    const roots = resolved.filter((item) => rootRepositories.has(item.reference.repository));

    // Keep already-current components in the report without blocking other updates.
    const unchangedRoots = options.update
      ? roots.filter((item) => item.version === state.components[item.manifest.name]?.version)
      : [];

    // For updates, select roots and only dependencies whose versions changed.
    const selected = options.update
      ? resolved.filter((item) => item.version !== state.components[item.manifest.name]?.version)
      : resolved;

    // Find components that would be overwritten by this operation.
    const alreadyInstalled = selected.filter((item) => state.components[item.manifest.name]);

    // Require explicit force semantics for an ordinary install collision.
    if (alreadyInstalled.length && !options.force) {
      // Format all conflicting names in one actionable diagnostic.
      const installedNames = alreadyInstalled.map((item) => `"${item.manifest.name}"`).join(', ');

      // Explain whether one or multiple components caused the collision.
      throw new Error(`${alreadyInstalled.length === 1 ? 'Component' : 'Components'} ${installedNames} ${alreadyInstalled.length === 1 ? 'is' : 'are'} already installed. Use --force to overwrite${alreadyInstalled.length === 1 ? ' it' : ' them'}.`);
    }

    // Preserve existing targets that are explicitly allowed to be overwritten.
    const overwrite = new Set(
      alreadyInstalled.flatMap((item) => [
        item.manifest.files[0]?.target,
        ...(state.components[item.manifest.name]?.files ?? []).map((file) => file.path),
      ]).filter((target): target is string => Boolean(target)),
    );

    // Build a safe, collision-free file plan without touching project files.
    const plans = await planFiles(cwd, selected, overwrite);

    // Merge package dependencies and reject incompatible declarations.
    const dependencies = aggregateDependencies(selected);

    // Identify tracked files that disappeared from an updated manifest.
    const obsolete = selected.flatMap((item) => {
      // Record the target paths declared by the new manifest.
      const current = new Set(item.manifest.files.map((file) => file.target));

      // Return old paths that are no longer present in the new declaration.
      return (state.components[item.manifest.name]?.files ?? [])
        .map((file) => file.path)
        .filter((file) => !current.has(file));
    });

    // Build the shared update representation for prompts, progress, and output.
    const changes: UpdateItem[] = selected.map((item) => ({
      name: item.manifest.name,
      current: `v${loadedState?.components[item.manifest.name]?.version ?? 'new'}`,
      next: `v${item.version}`,
      status: 'updated',
    }));
    const unchanged = unchangedRoots.map((item) => ({
      name: item.manifest.name,
      current: `v${item.version}`,
      next: `v${item.version}`,
      status: 'unchanged' as const,
    }));
    const updateItems = [...changes, ...unchanged];

    // Report a no-op update consistently instead of entering the mutation path.
    if (options.update && !selected.length) {
      return present(options.json, { components: [], updates: unchanged }, renderUpdateReport(unchanged));
    }

    // Show and confirm an interactive update plan only for real mutations.
    if (options.update && !options.dryRun && !options.json && interactive()) {
      // Keep the plan on stdout because it is the human command result.
      process.stdout.write(`${renderUpdateIntent(changes)}\n\n`);

      // Stop before rollback or file mutation when the user declines.
      if (!(await confirmAction('Update now?', true))) return cancelled(options.json);
    }

    // Save the previous state only when a real update can be reverted.
    if (options.update && !options.dryRun && loadedState) {
      await saveRollback(cwd, loadedState);
    }

    // Prepare the stable machine-readable payload before mutation begins.
    const result = {
      components: selected.map((item) => ({
        name: item.manifest.name,
        version: item.version,
        availableVersions: item.availableVersions,
        commit: item.commit,
        files: item.manifest.files.map((file) => file.target),
        dependencies,
      })),
      updates: updateItems,
    };

    // Return a complete preview without writing files when requested.
    if (options.dryRun) {
      // Describe the planned action and every selected component compactly.
      const preview = [
        `would ${options.update ? 'update' : 'add'} ${selected.length} component${selected.length === 1 ? '' : 's'}`,
        '',
        ...selected.map((item) => `  ${item.manifest.name} ${item.version}`),
        '',
        'no files changed',
      ];

      // Reuse the same payload for JSON and the same text frame for humans.
      return present(options.json, result, options.update ? renderUpdateReport(updateItems) : frame(options.command ?? 'component add', preview.join('\n'), 'Next: remove --dry-run to apply'));
    }

    // Replace each selected component record with the newly resolved metadata.
    for (const item of selected) {
      // Preserve an existing enabled flag while updating source metadata.
      state.components[item.manifest.name] = {
        enabled: state.components[item.manifest.name]?.enabled ?? true,
        repository: item.reference.repository,
        constraint: updateConstraint(item.version, item.reference.version),
        version: item.version,
        path: item.manifest.files[0]?.target ?? '',
        sourcePath: item.directory,
        files: item.manifest.files.map((file) => ({ path: file.target, sha256: '' })),
        dependencies: item.manifest.components,
      };
    }

    // Apply staged files, state, and dependencies through the rollback-safe pipeline.
    await withSpinner(
      options.update ? updateProgress(changes) : 'Installing component files...',
      () => applyPlans(cwd, state, plans, dependencies, obsolete, previousState),
      () => 'Component files installed',
      !options.json,
    );

    // Render one consistent verb-first line for each completed mutation.
    const messages = selected.flatMap((item) => {
      // Recover the pre-update version from the immutable change plan.
      const previous = changes.find((change) => change.name === item.manifest.name)?.current.replace(/^v/, '') ?? 'new';

      // Use one language for both installs and updates.
      const change = options.update
        ? `updated ${item.manifest.name} ${previous} -> ${item.version}`
        : `added ${item.manifest.name}@${item.version}`;

      // Keep optional available-version details subordinate to the result line.
      return [change, ...(showAvailableVersions ? [`  available: ${item.availableVersions.join(', ') || 'none'}`] : [])];
    });

    // Return the mutation result in either human or machine-readable form.
    const human = options.update
      ? renderUpdateReport(updateItems, 'ui undo')
      : frame(options.command ?? 'component add', messages.join('\n'), 'Next: ui component');
    return present(options.json, result, human);
  } finally {
    // Always clean temporary checkouts after success, preview, or failure.
    await Promise.all(resolved.map((item) => item.cleanup()));
  }
}
