export type SessionState = 'idle' | 'running' | 'approval' | 'completed';

export type StepCard = {
  id: string;
  title: string;
  status: 'completed' | 'running' | 'waiting';
  statusLabel: string;
};

export type RunningChatMessage = {
  id: number;
  role: 'agent' | 'user';
  text: string;
  time: string;
};
