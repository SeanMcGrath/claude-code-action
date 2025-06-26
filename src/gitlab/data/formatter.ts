import { 
  GitLabContext, 
  GitLabIssue, 
  GitLabMergeRequest, 
  GitLabNote, 
  GitLabCommit, 
  GitLabFile, 
  GitLabDiff 
} from '../types.js';

export class GitLabDataFormatter {
  formatFullContext(context: GitLabContext): string {
    const sections: string[] = [];

    // Project information
    sections.push(this.formatProject(context.project));

    // Resource-specific information
    if (context.issue) {
      sections.push(this.formatIssue(context.issue));
    }

    if (context.mergeRequest) {
      sections.push(this.formatMergeRequest(context.mergeRequest));
      
      if (context.commits && context.commits.length > 0) {
        sections.push(this.formatCommits(context.commits));
      }
      
      if (context.diffs && context.diffs.length > 0) {
        sections.push(this.formatDiffs(context.diffs));
      }
    }

    // Comments/Notes
    if (context.notes && context.notes.length > 0) {
      sections.push(this.formatNotes(context.notes));
    }

    // Files
    if (context.files && context.files.length > 0) {
      sections.push(this.formatFiles(context.files));
    }

    return sections.join('\n\n---\n\n');
  }

  private formatProject(project: any): string {
    return `## Project: ${project.name}
- **Path**: ${project.path_with_namespace}
- **Default Branch**: ${project.default_branch}
- **URL**: ${project.web_url}`;
  }

  private formatIssue(issue: GitLabIssue): string {
    const assignees = issue.assignees.map(a => `@${a.username}`).join(', ');
    const labels = issue.labels.join(', ');

    return `## Issue #${issue.iid}: ${issue.title}
- **State**: ${issue.state}
- **Author**: @${issue.author.username} (${issue.author.name})
- **Created**: ${new Date(issue.created_at).toLocaleString()}
- **Updated**: ${new Date(issue.updated_at).toLocaleString()}
${assignees ? `- **Assignees**: ${assignees}` : ''}
${labels ? `- **Labels**: ${labels}` : ''}
- **URL**: ${issue.web_url}

### Description
${issue.description || 'No description provided.'}`;
  }

  private formatMergeRequest(mr: GitLabMergeRequest): string {
    const assignees = mr.assignees.map(a => `@${a.username}`).join(', ');
    const labels = mr.labels.join(', ');

    return `## Merge Request !${mr.iid}: ${mr.title}
- **State**: ${mr.state}
- **Author**: @${mr.author.username} (${mr.author.name})
- **Source Branch**: ${mr.source_branch}
- **Target Branch**: ${mr.target_branch}
- **SHA**: ${mr.sha}
- **Created**: ${new Date(mr.created_at).toLocaleString()}
- **Updated**: ${new Date(mr.updated_at).toLocaleString()}
${assignees ? `- **Assignees**: ${assignees}` : ''}
${labels ? `- **Labels**: ${labels}` : ''}
${mr.merge_status ? `- **Merge Status**: ${mr.merge_status}` : ''}
- **URL**: ${mr.web_url}

### Description
${mr.description || 'No description provided.'}`;
  }

  private formatNotes(notes: GitLabNote[]): string {
    const userNotes = notes.filter(note => !note.system);
    
    if (userNotes.length === 0) {
      return '## Comments\nNo comments yet.';
    }

    const formattedNotes = userNotes.map(note => {
      const timestamp = new Date(note.created_at).toLocaleString();
      return `### Comment by @${note.author.username} (${timestamp})
${note.body}`;
    }).join('\n\n');

    return `## Comments\n${formattedNotes}`;
  }

  private formatCommits(commits: GitLabCommit[]): string {
    if (commits.length === 0) {
      return '## Commits\nNo commits in this merge request.';
    }

    const formattedCommits = commits.map(commit => {
      const timestamp = new Date(commit.committed_date).toLocaleString();
      return `- **${commit.short_id}**: ${commit.title} (${commit.author_name}, ${timestamp})`;
    }).join('\n');

    return `## Commits (${commits.length} total)
${formattedCommits}`;
  }

  private formatDiffs(diffs: GitLabDiff[]): string {
    if (diffs.length === 0) {
      return '## File Changes\nNo file changes.';
    }

    const formattedDiffs = diffs.map(diff => {
      let status = 'modified';
      if (diff.new_file) status = 'added';
      if (diff.deleted_file) status = 'deleted';
      if (diff.renamed_file) status = 'renamed';

      const path = diff.new_path || diff.old_path;
      return `- **${status}**: ${path}${diff.renamed_file && diff.old_path !== diff.new_path ? ` (from ${diff.old_path})` : ''}`;
    }).join('\n');

    return `## File Changes (${diffs.length} files)
${formattedDiffs}`;
  }

  private formatFiles(files: GitLabFile[]): string {
    if (files.length === 0) {
      return '## File Contents\nNo files to display.';
    }

    const formattedFiles = files.map(file => {
      const content = file.content || 'Content not available';
      const truncated = content.length > 10000 ? `${content.substring(0, 10000)}\n\n... (content truncated)` : content;
      
      return `### File: ${file.file_path}
\`\`\`
${truncated}
\`\`\``;
    }).join('\n\n');

    return `## File Contents
${formattedFiles}`;
  }

  formatTriggerInfo(triggerResult: any): string {
    return `## Trigger Information
- **Type**: ${triggerResult.triggerType}
- **Resource**: ${triggerResult.resourceType} #${triggerResult.resourceId}
- **Triggered by**: @${triggerResult.triggeredBy?.username}`;
  }

  formatProgressComment(status: string, details?: string): string {
    const timestamp = new Date().toLocaleString();
    
    let emoji = '🤔';
    switch (status) {
      case 'processing': emoji = '⚡'; break;
      case 'completed': emoji = '✅'; break;
      case 'error': emoji = '❌'; break;
      case 'waiting': emoji = '⏳'; break;
    }

    return `${emoji} **Claude is ${status}** (${timestamp})

${details || ''}

---
*This comment will be updated with progress*`;
  }

  formatCompletionComment(
    result: string, 
    executionTime: number, 
    cost?: number, 
    branchName?: string,
    mergeRequestUrl?: string
  ): string {
    const timestamp = new Date().toLocaleString();
    
    let sections = [
      `✅ **Claude completed** (${timestamp})`,
      '',
      result
    ];

    if (branchName) {
      sections.push(`🌿 **Branch created**: \`${branchName}\``);
    }

    if (mergeRequestUrl) {
      sections.push(`🔗 **Merge Request**: ${mergeRequestUrl}`);
    }

    sections.push(`⏱️ **Execution time**: ${Math.round(executionTime / 1000)}s`);
    
    if (cost) {
      sections.push(`💰 **Cost**: $${cost.toFixed(4)}`);
    }

    return sections.join('\n');
  }

  formatErrorComment(error: Error, executionTime: number): string {
    const timestamp = new Date().toLocaleString();
    
    return `❌ **Claude encountered an error** (${timestamp})

\`\`\`
${error.message}
\`\`\`

⏱️ **Execution time**: ${Math.round(executionTime / 1000)}s

Please check the configuration and try again.`;
  }

  // Utility method to sanitize content for GitLab markdown
  sanitizeMarkdown(content: string): string {
    // Escape GitLab-specific markdown characters if needed
    return content
      .replace(/\[([^\]]+)\]\((?!https?:\/\/)[^)]+\)/g, '[$1]') // Remove relative links
      .replace(/```([^`]+)```/g, (match, code) => {
        // Ensure code blocks are properly formatted
        return '```\n' + code.trim() + '\n```';
      });
  }
}