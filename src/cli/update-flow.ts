import { colors, table } from './ui.js';

/** Lifecycle states rendered for every update target. */
export type UpdateStatus = 'pending' | 'updated' | 'unchanged' | 'failed';

/** Version transition shown in update plans and result reports. */
export interface UpdateItem {
  name: string;
  current: string;
  next: string;
  status?: UpdateStatus;
}

const statusLabel: Record<UpdateStatus, string> = {
  pending: colors.info('pending'),
  updated: colors.success('updated'),
  unchanged: colors.muted('unchanged'),
  failed: colors.error('failed'),
};

/** Describes the intended version transitions before work starts. */
export function renderUpdateIntent(items: UpdateItem[]): string {
  return `${colors.info('update plan')}\n\n${table(['Name', 'Current', 'Next', 'Status'], items.map((item) => [item.name, item.current, item.next, statusLabel.pending]))}`;
}

/** Reports per-item outcomes and exposes the supplied undo action. */
export function renderUpdateReport(items: UpdateItem[], undo?: string): string {
  const report = `${colors.info('update results')}\n\n${table(['Name', 'Current', 'Next', 'Status'], items.map((item) => [item.name, item.current, item.next, statusLabel[item.status ?? 'updated']]))}`;
  return undo ? `${report}\n\n${colors.muted(`undo: ${undo}`)}` : report;
}

/** Produces concise progress text for interactive spinners. */
export function updateProgress(items: UpdateItem[]): string {
  return items.map((item) => `${item.name} ${item.current} -> ${item.next}`).join(', ');
}
