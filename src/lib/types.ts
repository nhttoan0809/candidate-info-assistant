import type { UIMessage } from 'ai';

export type Intent =
  | 'overview'
  | 'experience'
  | 'skills'
  | 'projects'
  | 'images'
  | 'profile'
  | 'fit'
  | 'greeting'
  | 'thanks'
  | 'help'
  | 'clarification'
  | 'other';
export interface Classification {
  intent: Intent;
  method: 'model' | 'rules';
  summary: string;
}
export interface Evidence {
  id: string;
  title: string;
  url: string;
  kind: 'profile' | 'repository' | 'file' | 'activity';
  excerpt?: string;
}
export interface ProjectImage {
  id: string;
  repository: string;
  path: string;
  src: string;
  sourceUrl: string;
  alt: string;
  origin: 'readme' | 'repository';
  fork?: boolean;
}
export interface Activity {
  id: string;
  label: string;
  detail: string;
  status: 'running' | 'done' | 'error';
  kind: 'classification' | 'plan' | 'tool' | 'answer';
  elapsedMs?: number;
}
export interface Progress {
  phase:
    | 'classification'
    | 'waiting-model'
    | 'reasoning'
    | 'tool'
    | 'preparing'
    | 'streaming'
    | 'done'
    | 'error';
  label: string;
  detail: string;
  elapsedMs: number;
}
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  elapsedMs: number;
  steps: number;
  finishReason: string;
  classificationMs?: number;
  firstTextMs?: number;
  firstModelEventMs?: number;
}
export type ChatMessage = UIMessage<
  never,
  {
    activity: Activity;
    classification: Classification;
    sources: Evidence[];
    usage: Usage;
    progress: Progress;
    images: ProjectImage[];
  }
>;
export interface CandidateProfile {
  login: string;
  name: string | null;
  avatar: string;
  url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  publicRepos: number;
  joined: string;
}
export interface Repository {
  name: string;
  description: string | null;
  url: string;
  language: string | null;
  fork: boolean;
  stars: number;
  updated: string;
  branch: string;
}
export interface Bootstrap {
  appName: string;
  model: string;
  scope: string;
  profile: CandidateProfile | null;
  repositories: Repository[];
  githubError?: string;
  candidateBio?: string;
  owner?: string;
}
export const intentLabels: Record<Intent, string> = {
  overview: 'Tổng quan',
  experience: 'Kinh nghiệm',
  skills: 'Kỹ năng',
  projects: 'Dự án',
  images: 'Hình ảnh dự án',
  profile: 'Hồ sơ',
  fit: 'Mức độ phù hợp',
  greeting: 'Chào hỏi',
  thanks: 'Cảm ơn',
  help: 'Hướng dẫn',
  clarification: 'Làm rõ câu hỏi',
  other: 'Ngoài phạm vi',
};
