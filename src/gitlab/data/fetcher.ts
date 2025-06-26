import { GitLabAPIClient } from '../api/client.js';
import { 
  GitLabProject, 
  GitLabIssue, 
  GitLabMergeRequest, 
  GitLabNote, 
  GitLabCommit, 
  GitLabFile, 
  GitLabDiff,
  GitLabContext,
  TriggerResult 
} from '../types.js';

export class GitLabDataFetcher {
  constructor(private client: GitLabAPIClient) {}

  async fetchFullContext(
    projectId: number, 
    triggerResult: TriggerResult
  ): Promise<GitLabContext> {
    const project = await this.client.getProject(projectId);
    
    let issue: GitLabIssue | undefined;
    let mergeRequest: GitLabMergeRequest | undefined;
    let notes: GitLabNote[] = [];
    let files: GitLabFile[] = [];
    let commits: GitLabCommit[] = [];
    let diffs: GitLabDiff[] = [];

    if (triggerResult.resourceType === 'issue' && triggerResult.resourceId) {
      issue = await this.client.getIssue(projectId, triggerResult.resourceId);
      notes = await this.client.getIssueNotes(projectId, triggerResult.resourceId);
    } else if (triggerResult.resourceType === 'merge_request' && triggerResult.resourceId) {
      mergeRequest = await this.client.getMergeRequest(projectId, triggerResult.resourceId);
      notes = await this.client.getMergeRequestNotes(projectId, triggerResult.resourceId);
      
      // Fetch MR-specific data
      commits = await this.client.getMergeRequestCommits(projectId, triggerResult.resourceId);
      const changes = await this.client.getMergeRequestChanges(projectId, triggerResult.resourceId);
      diffs = changes.changes;
      
      // Fetch modified files content
      files = await this.fetchModifiedFiles(projectId, diffs, mergeRequest.source_branch);
    }

    return {
      project,
      issue,
      mergeRequest,
      notes,
      triggerResult,
      files,
      commits,
      diffs,
    };
  }

  async fetchIssueContext(projectId: number, issueIid: number): Promise<{
    project: GitLabProject;
    issue: GitLabIssue;
    notes: GitLabNote[];
  }> {
    const [project, issue, notes] = await Promise.all([
      this.client.getProject(projectId),
      this.client.getIssue(projectId, issueIid),
      this.client.getIssueNotes(projectId, issueIid),
    ]);

    return { project, issue, notes };
  }

  async fetchMergeRequestContext(projectId: number, mergeRequestIid: number): Promise<{
    project: GitLabProject;
    mergeRequest: GitLabMergeRequest;
    notes: GitLabNote[];
    commits: GitLabCommit[];
    diffs: GitLabDiff[];
    files: GitLabFile[];
  }> {
    const [project, mergeRequest, notes, commits] = await Promise.all([
      this.client.getProject(projectId),
      this.client.getMergeRequest(projectId, mergeRequestIid),
      this.client.getMergeRequestNotes(projectId, mergeRequestIid),
      this.client.getMergeRequestCommits(projectId, mergeRequestIid),
    ]);

    const changes = await this.client.getMergeRequestChanges(projectId, mergeRequestIid);
    const diffs = changes.changes;
    
    // Fetch content of modified files
    const files = await this.fetchModifiedFiles(projectId, diffs, mergeRequest.source_branch);

    return {
      project,
      mergeRequest,
      notes,
      commits,
      diffs,
      files,
    };
  }

  private async fetchModifiedFiles(
    projectId: number, 
    diffs: GitLabDiff[], 
    branch: string
  ): Promise<GitLabFile[]> {
    const files: GitLabFile[] = [];
    
    // Limit to prevent overwhelming the context
    const maxFiles = 20;
    const relevantDiffs = diffs
      .filter(diff => !diff.deleted_file && this.isRelevantFile(diff.new_path))
      .slice(0, maxFiles);

    for (const diff of relevantDiffs) {
      try {
        const file = await this.client.getFile(projectId, diff.new_path, branch);
        if (file.content) {
          // Decode base64 content
          file.content = Buffer.from(file.content, 'base64').toString('utf-8');
        }
        files.push(file);
      } catch (error) {
        console.warn(`Failed to fetch file ${diff.new_path}:`, error);
      }
    }

    return files;
  }

  private isRelevantFile(filePath: string): boolean {
    // Filter out binary files, lock files, etc.
    const excludePatterns = [
      /\.(png|jpg|jpeg|gif|ico|svg|pdf|zip|tar|gz|exe|bin|dll)$/i,
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/,
      /Gemfile\.lock$/,
      /composer\.lock$/,
      /\.min\.(js|css)$/,
      /node_modules\//,
      /\.git\//,
      /build\//,
      /dist\//,
    ];

    return !excludePatterns.some(pattern => pattern.test(filePath));
  }

  async fetchProjectFiles(
    projectId: number, 
    ref: string = 'main', 
    maxDepth: number = 3
  ): Promise<Array<{ path: string; type: 'file' | 'directory' }>> {
    const tree = await this.client.getRepositoryTree(projectId, '', ref, true);
    
    return tree
      .filter(item => {
        const depth = item.path.split('/').length;
        return depth <= maxDepth && this.isRelevantFile(item.path);
      })
      .map(item => ({
        path: item.path,
        type: item.type === 'blob' ? 'file' as const : 'directory' as const,
      }));
  }

  async fetchFileContent(
    projectId: number, 
    filePath: string, 
    ref: string = 'main'
  ): Promise<string | null> {
    try {
      const file = await this.client.getFile(projectId, filePath, ref);
      if (file.content) {
        return Buffer.from(file.content, 'base64').toString('utf-8');
      }
      return null;
    } catch (error) {
      console.warn(`Failed to fetch file ${filePath}:`, error);
      return null;
    }
  }

  async fetchRecentCommits(
    projectId: number, 
    ref: string = 'main', 
    limit: number = 10
  ): Promise<GitLabCommit[]> {
    try {
      // GitLab API doesn't have a direct way to get recent commits with limit
      // We'd need to implement this by getting the commit list
      // For now, we'll return empty array as this would require additional API calls
      return [];
    } catch (error) {
      console.warn('Failed to fetch recent commits:', error);
      return [];
    }
  }
}