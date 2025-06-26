#!/usr/bin/env bun

import { GitLabAPIClient } from '../gitlab/api/client.js';
import { GitLabDataFetcher } from '../gitlab/data/fetcher.js';
import { GitLabTriggerValidator } from '../gitlab/validation/trigger.js';
import { createGitLabPrompt } from '../gitlab/create-prompt/index.js';
import { 
  GitLabConfig, 
  GitLabActionConfig, 
  TriggerResult 
} from '../gitlab/types.js';

async function main() {
  try {
    // Get configuration from environment variables
    const gitlabUrl = process.env.GITLAB_URL;
    const gitlabToken = process.env.GITLAB_TOKEN;
    const claudeTriggerData = process.env.CLAUDE_TRIGGER_DATA;

    if (!gitlabUrl || !gitlabToken) {
      throw new Error('GITLAB_URL and GITLAB_TOKEN environment variables are required');
    }

    if (!claudeTriggerData) {
      throw new Error('CLAUDE_TRIGGER_DATA environment variable is required');
    }

    // Parse trigger data
    const triggerData = JSON.parse(claudeTriggerData);
    const triggerResult: TriggerResult = {
      shouldTrigger: true,
      triggerType: triggerData.triggerType,
      resourceType: triggerData.resourceType,
      resourceId: triggerData.resourceId,
      projectId: triggerData.projectId,
      triggeredBy: triggerData.triggeredBy,
      triggerComment: triggerData.triggerComment,
    };

    // Create GitLab API client
    const gitlabConfig: GitLabConfig = {
      url: gitlabUrl,
      token: gitlabToken,
    };
    const client = new GitLabAPIClient(gitlabConfig);

    // Create action configuration
    const actionConfig: GitLabActionConfig = {
      triggerPhrase: process.env.TRIGGER_PHRASE || '@claude',
      assigneeTrigger: process.env.ASSIGNEE_TRIGGER,
      labelTrigger: process.env.LABEL_TRIGGER || 'claude',
      baseBranch: process.env.BASE_BRANCH || 'main',
      branchPrefix: process.env.BRANCH_PREFIX || 'claude/',
      maxTurns: parseInt(process.env.MAX_TURNS || '10'),
      timeoutMinutes: parseInt(process.env.TIMEOUT_MINUTES || '30'),
      claudeModel: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      customInstructions: process.env.CUSTOM_INSTRUCTIONS,
      allowedTools: process.env.ALLOWED_TOOLS?.split(','),
      disallowedTools: process.env.DISALLOWED_TOOLS?.split(','),
      useBedrock: process.env.USE_BEDROCK === 'true',
      useVertex: process.env.USE_VERTEX === 'true',
    };

    // Fetch context data
    const fetcher = new GitLabDataFetcher(client);
    const context = await fetcher.fetchFullContext(triggerResult.projectId!, triggerResult);

    console.log('Fetched GitLab context:', {
      project: context.project.name,
      resourceType: triggerResult.resourceType,
      resourceId: triggerResult.resourceId,
      notesCount: context.notes.length,
      filesCount: context.files?.length || 0,
    });

    // Create initial progress comment
    let claudeCommentId: string;
    let claudeBranch: string | undefined;

    if (triggerResult.resourceType === 'issue') {
      // For issues, create a new branch and initial comment
      claudeBranch = `${actionConfig.branchPrefix}issue-${triggerResult.resourceId}`;
      
      try {
        await client.createBranch(triggerResult.projectId!, claudeBranch, actionConfig.baseBranch);
        console.log(`Created branch: ${claudeBranch}`);
      } catch (error) {
        // Branch might already exist, that's okay
        console.log(`Branch ${claudeBranch} already exists or creation failed:`, error);
      }

      const initialComment = await client.createIssueNote(
        triggerResult.projectId!,
        triggerResult.resourceId!,
        '🤔 **Claude is processing** <img src="https://github.com/user-attachments/assets/5ac382c7-e004-429b-8e35-7feb3e8f9c6f" width="14px" height="14px" style="vertical-align: middle; margin-left: 4px;" />\n\n---\n*This comment will be updated with progress*'
      );
      claudeCommentId = initialComment.id.toString();

    } else if (triggerResult.resourceType === 'merge_request') {
      // For MRs, use existing branch or create new one if MR is closed
      const mr = context.mergeRequest!;
      
      if (mr.state === 'opened') {
        claudeBranch = mr.source_branch;
      } else {
        claudeBranch = `${actionConfig.branchPrefix}mr-${triggerResult.resourceId}`;
        try {
          await client.createBranch(triggerResult.projectId!, claudeBranch, actionConfig.baseBranch);
          console.log(`Created branch: ${claudeBranch}`);
        } catch (error) {
          console.log(`Branch ${claudeBranch} already exists or creation failed:`, error);
        }
      }

      const initialComment = await client.createMergeRequestNote(
        triggerResult.projectId!,
        triggerResult.resourceId!,
        '🤔 **Claude is processing** <img src="https://github.com/user-attachments/assets/5ac382c7-e004-429b-8e35-7feb3e8f9c6f" width="14px" height="14px" style="vertical-align: middle; margin-left: 4px;" />\n\n---\n*This comment will be updated with progress*'
      );
      claudeCommentId = initialComment.id.toString();
    } else {
      throw new Error(`Unsupported resource type: ${triggerResult.resourceType}`);
    }

    // Create prompt
    const promptResult = await createGitLabPrompt(
      context,
      actionConfig,
      claudeCommentId,
      claudeBranch
    );

    // Set environment variables for the GitLab runner
    console.log(`::set-env name=CLAUDE_COMMENT_ID::${claudeCommentId}`);
    console.log(`::set-env name=PROJECT_ID::${triggerResult.projectId}`);
    console.log(`::set-env name=RESOURCE_TYPE::${triggerResult.resourceType}`);
    console.log(`::set-env name=RESOURCE_IID::${triggerResult.resourceId}`);
    console.log(`::set-env name=BRANCH_NAME::${claudeBranch || actionConfig.baseBranch}`);
    console.log(`::set-env name=GITLAB_URL::${gitlabUrl}`);
    console.log(`::set-env name=GITLAB_TOKEN::${gitlabToken}`);
    console.log(`::set-env name=ALLOWED_TOOLS::${promptResult.allowedTools}`);
    console.log(`::set-env name=DISALLOWED_TOOLS::${promptResult.disallowedTools}`);

    console.log('GitLab preparation completed successfully');
    console.log('Prompt file created at:', promptResult.promptFile);
    console.log('Claude comment ID:', claudeCommentId);
    console.log('Branch:', claudeBranch);

  } catch (error) {
    console.error('GitLab preparation failed:', error);
    process.exit(1);
  }
}

main();