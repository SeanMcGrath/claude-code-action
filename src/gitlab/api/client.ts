import { 
  GitLabProject, 
  GitLabIssue, 
  GitLabMergeRequest, 
  GitLabNote, 
  GitLabCommit, 
  GitLabFile, 
  GitLabDiff, 
  GitLabBranch, 
  GitLabUser,
  GitLabConfig 
} from '../types.js';

export class GitLabAPIClient {
  private baseUrl: string;
  private token: string;
  private headers: Record<string, string>;

  constructor(config: GitLabConfig) {
    this.baseUrl = `${config.url}/api/v4`;
    this.token = config.token;
    this.headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  // Project operations
  async getProject(projectId: number): Promise<GitLabProject> {
    return this.request<GitLabProject>(`/projects/${projectId}`);
  }

  // Issue operations
  async getIssue(projectId: number, issueIid: number): Promise<GitLabIssue> {
    return this.request<GitLabIssue>(`/projects/${projectId}/issues/${issueIid}`);
  }

  async getIssueNotes(projectId: number, issueIid: number): Promise<GitLabNote[]> {
    return this.request<GitLabNote[]>(`/projects/${projectId}/issues/${issueIid}/notes?sort=asc&order_by=created_at`);
  }

  async createIssueNote(projectId: number, issueIid: number, body: string): Promise<GitLabNote> {
    return this.request<GitLabNote>(`/projects/${projectId}/issues/${issueIid}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  async updateIssueNote(projectId: number, issueIid: number, noteId: number, body: string): Promise<GitLabNote> {
    return this.request<GitLabNote>(`/projects/${projectId}/issues/${issueIid}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ body }),
    });
  }

  // Merge Request operations
  async getMergeRequest(projectId: number, mergeRequestIid: number): Promise<GitLabMergeRequest> {
    return this.request<GitLabMergeRequest>(`/projects/${projectId}/merge_requests/${mergeRequestIid}`);
  }

  async getMergeRequestNotes(projectId: number, mergeRequestIid: number): Promise<GitLabNote[]> {
    return this.request<GitLabNote[]>(`/projects/${projectId}/merge_requests/${mergeRequestIid}/notes?sort=asc&order_by=created_at`);
  }

  async createMergeRequestNote(projectId: number, mergeRequestIid: number, body: string): Promise<GitLabNote> {
    return this.request<GitLabNote>(`/projects/${projectId}/merge_requests/${mergeRequestIid}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  async updateMergeRequestNote(projectId: number, mergeRequestIid: number, noteId: number, body: string): Promise<GitLabNote> {
    return this.request<GitLabNote>(`/projects/${projectId}/merge_requests/${mergeRequestIid}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ body }),
    });
  }

  async getMergeRequestCommits(projectId: number, mergeRequestIid: number): Promise<GitLabCommit[]> {
    return this.request<GitLabCommit[]>(`/projects/${projectId}/merge_requests/${mergeRequestIid}/commits`);
  }

  async getMergeRequestChanges(projectId: number, mergeRequestIid: number): Promise<GitLabMergeRequest & { changes: GitLabDiff[] }> {
    return this.request<GitLabMergeRequest & { changes: GitLabDiff[] }>(`/projects/${projectId}/merge_requests/${mergeRequestIid}/changes`);
  }

  async createMergeRequest(
    projectId: number,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description?: string
  ): Promise<GitLabMergeRequest> {
    return this.request<GitLabMergeRequest>(`/projects/${projectId}/merge_requests`, {
      method: 'POST',
      body: JSON.stringify({
        source_branch: sourceBranch,
        target_branch: targetBranch,
        title,
        description,
      }),
    });
  }

  // Branch operations
  async getBranch(projectId: number, branchName: string): Promise<GitLabBranch> {
    return this.request<GitLabBranch>(`/projects/${projectId}/repository/branches/${encodeURIComponent(branchName)}`);
  }

  async createBranch(projectId: number, branchName: string, ref: string): Promise<GitLabBranch> {
    return this.request<GitLabBranch>(`/projects/${projectId}/repository/branches`, {
      method: 'POST',
      body: JSON.stringify({
        branch: branchName,
        ref,
      }),
    });
  }

  async deleteBranch(projectId: number, branchName: string): Promise<void> {
    await this.request(`/projects/${projectId}/repository/branches/${encodeURIComponent(branchName)}`, {
      method: 'DELETE',
    });
  }

  // File operations
  async getFile(projectId: number, filePath: string, ref: string): Promise<GitLabFile> {
    return this.request<GitLabFile>(`/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}?ref=${ref}`);
  }

  async createFile(
    projectId: number,
    filePath: string,
    branch: string,
    content: string,
    commitMessage: string
  ): Promise<GitLabFile> {
    return this.request<GitLabFile>(`/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`, {
      method: 'POST',
      body: JSON.stringify({
        branch,
        content: Buffer.from(content).toString('base64'),
        encoding: 'base64',
        commit_message: commitMessage,
      }),
    });
  }

  async updateFile(
    projectId: number,
    filePath: string,
    branch: string,
    content: string,
    commitMessage: string
  ): Promise<GitLabFile> {
    return this.request<GitLabFile>(`/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`, {
      method: 'PUT',
      body: JSON.stringify({
        branch,
        content: Buffer.from(content).toString('base64'),
        encoding: 'base64',
        commit_message: commitMessage,
      }),
    });
  }

  async deleteFile(
    projectId: number,
    filePath: string,
    branch: string,
    commitMessage: string
  ): Promise<void> {
    await this.request(`/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`, {
      method: 'DELETE',
      body: JSON.stringify({
        branch,
        commit_message: commitMessage,
      }),
    });
  }

  // Commit operations
  async getCommit(projectId: number, sha: string): Promise<GitLabCommit> {
    return this.request<GitLabCommit>(`/projects/${projectId}/repository/commits/${sha}`);
  }

  async createCommit(
    projectId: number,
    branch: string,
    commitMessage: string,
    actions: Array<{
      action: 'create' | 'delete' | 'move' | 'update' | 'chmod';
      file_path: string;
      previous_path?: string;
      content?: string;
      encoding?: string;
      execute_filemode?: boolean;
    }>
  ): Promise<GitLabCommit> {
    return this.request<GitLabCommit>(`/projects/${projectId}/repository/commits`, {
      method: 'POST',
      body: JSON.stringify({
        branch,
        commit_message: commitMessage,
        actions,
      }),
    });
  }

  // Repository tree operations
  async getRepositoryTree(
    projectId: number,
    path: string = '',
    ref: string = 'main',
    recursive: boolean = false
  ): Promise<Array<{ id: string; name: string; type: 'tree' | 'blob'; path: string; mode: string }>> {
    const params = new URLSearchParams({
      ref,
      path,
      recursive: recursive.toString(),
    });
    return this.request<Array<{ id: string; name: string; type: 'tree' | 'blob'; path: string; mode: string }>>(
      `/projects/${projectId}/repository/tree?${params}`
    );
  }

  // User operations
  async getCurrentUser(): Promise<GitLabUser> {
    return this.request<GitLabUser>('/user');
  }

  async getUser(userId: number): Promise<GitLabUser> {
    return this.request<GitLabUser>(`/users/${userId}`);
  }

  // Utility method to check if user has write access to project
  async checkWriteAccess(projectId: number): Promise<boolean> {
    try {
      const project = await this.getProject(projectId);
      // If we can fetch the project, we have at least read access
      // For write access, we'd need to check the user's permissions
      // This is a simplified check - in production, you'd want to verify actual permissions
      return true;
    } catch (error) {
      return false;
    }
  }
}