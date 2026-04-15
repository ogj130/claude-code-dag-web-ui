import Dexie, { type Table } from 'dexie';
import type { SessionWorkspaceBinding } from '@/types/workspace';

const DB_NAME = 'cc-web-workspace';

class SessionWorkspaceBindingDB extends Dexie {
  bindings!: Table<SessionWorkspaceBinding, string>;

  constructor() {
    super(DB_NAME);

    this.version(1).stores({
      bindings: 'sessionId, workspaceId, createdBy, lastActiveAt',
    });
  }
}

const edb = new SessionWorkspaceBindingDB();

export async function bindSessionToWorkspace(
  sessionId: string,
  workspaceId: string,
  createdBy: SessionWorkspaceBinding['createdBy'],
): Promise<SessionWorkspaceBinding> {
  const now = Date.now();
  const binding: SessionWorkspaceBinding = {
    sessionId,
    workspaceId,
    createdBy,
    createdAt: now,
    lastActiveAt: now,
  };

  await edb.bindings.put(binding);
  return binding;
}

export async function getBindingBySessionId(sessionId: string): Promise<SessionWorkspaceBinding | undefined> {
  return edb.bindings.get(sessionId);
}

export async function touchBinding(sessionId: string): Promise<void> {
  await edb.bindings.update(sessionId, { lastActiveAt: Date.now() });
}

export async function getLatestSessionBindingByWorkspaceId(
  workspaceId: string,
): Promise<SessionWorkspaceBinding | undefined> {
  const bindings = await edb.bindings.where('workspaceId').equals(workspaceId).sortBy('lastActiveAt');
  return bindings.at(-1);
}

export { edb };
