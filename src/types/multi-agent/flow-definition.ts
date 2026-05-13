import type { WorkerType } from './ceo-agent';

export interface FlowAgent {
  id: string;
  name: string;
  agentType: WorkerType;
  taskDescription: string;
  dependencies: string[];
}

export interface FlowDefinition {
  mode: 'parallel' | 'sequential' | 'pipeline' | 'coordinator' | 'reviewer';
  agents: FlowAgent[];
  connections?: Array<{ from: string; to: string }>;
}
