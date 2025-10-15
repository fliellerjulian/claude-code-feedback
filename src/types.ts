export interface DiffContext {
  filePath: string;
  relativePath: string;
  startLine: number;
  endLine: number;
  selectedCode: string;
  relevantDiffHunk: string;
}
