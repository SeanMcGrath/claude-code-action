import fetch from 'node-fetch';
import { 
  GitLabWebhookEvent, 
  GitLabActionConfig, 
  TriggerResult 
} from '../../src/gitlab/types.js';

export class GitLabWebhookHandler {
  constructor(private config: GitLabActionConfig) {}

  async handleWebhook(event: GitLabWebhookEvent, triggerResult: TriggerResult): Promise<void> {
    try {
      // Trigger GitLab CI/CD pipeline with webhook data
      await this.triggerPipeline(event.project.id, {
        triggerType: triggerResult.triggerType,
        resourceType: triggerResult.resourceType,
        resourceId: triggerResult.resourceId,
        projectId: event.project.id,
        triggeredBy: triggerResult.triggeredBy,
        originalEvent: this.sanitizeEvent(event),
      });

    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  async handleManualTrigger(triggerResult: TriggerResult, prompt?: string): Promise<void> {
    if (!triggerResult.projectId) {
      throw new Error('Project ID is required for manual trigger');
    }

    await this.triggerPipeline(triggerResult.projectId, {
      triggerType: triggerResult.triggerType,
      resourceType: triggerResult.resourceType,
      resourceId: triggerResult.resourceId,
      projectId: triggerResult.projectId,
      triggeredBy: triggerResult.triggeredBy,
      prompt,
    });
  }

  private async triggerPipeline(projectId: number, data: any): Promise<void> {
    const gitlabUrl = process.env.GITLAB_URL;
    const triggerToken = process.env.GITLAB_TRIGGER_TOKEN;
    const pipelineRef = process.env.PIPELINE_REF || 'main';

    if (!gitlabUrl || !triggerToken) {
      throw new Error('GITLAB_URL and GITLAB_TRIGGER_TOKEN must be set');
    }

    const url = `${gitlabUrl}/api/v4/projects/${projectId}/trigger/pipeline`;
    
    const formData = new URLSearchParams();
    formData.append('token', triggerToken);
    formData.append('ref', pipelineRef);
    formData.append('variables[CLAUDE_TRIGGER_DATA]', JSON.stringify(data));
    formData.append('variables[TRIGGER_VALID]', 'true');

    // Add configuration as pipeline variables
    formData.append('variables[CLAUDE_MODEL]', this.config.claudeModel);
    formData.append('variables[TRIGGER_PHRASE]', this.config.triggerPhrase);
    formData.append('variables[BASE_BRANCH]', this.config.baseBranch);
    formData.append('variables[BRANCH_PREFIX]', this.config.branchPrefix);
    formData.append('variables[MAX_TURNS]', this.config.maxTurns.toString());
    formData.append('variables[TIMEOUT_MINUTES]', this.config.timeoutMinutes.toString());

    if (this.config.customInstructions) {
      formData.append('variables[CUSTOM_INSTRUCTIONS]', this.config.customInstructions);
    }

    if (this.config.allowedTools?.length) {
      formData.append('variables[ALLOWED_TOOLS]', this.config.allowedTools.join(','));
    }

    if (this.config.disallowedTools?.length) {
      formData.append('variables[DISALLOWED_TOOLS]', this.config.disallowedTools.join(','));
    }

    if (this.config.useBedrock) {
      formData.append('variables[USE_BEDROCK]', 'true');
    }

    if (this.config.useVertex) {
      formData.append('variables[USE_VERTEX]', 'true');
    }

    console.log(`Triggering pipeline for project ${projectId}:`, {
      url,
      ref: pipelineRef,
      triggerType: data.triggerType,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to trigger pipeline: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Pipeline triggered successfully:', result);
  }

  private sanitizeEvent(event: GitLabWebhookEvent): any {
    // Remove sensitive or unnecessary data from the event
    const sanitized = {
      object_kind: event.object_kind,
      project: {
        id: event.project.id,
        name: event.project.name,
        path_with_namespace: event.project.path_with_namespace,
        default_branch: event.project.default_branch,
        web_url: event.project.web_url,
      },
      user: {
        id: event.user.id,
        username: event.user.username,
        name: event.user.name,
      },
    };

    // Add object-specific data
    if (event.object_kind === 'note' && 'object_attributes' in event) {
      (sanitized as any).note = {
        id: event.object_attributes.id,
        body: event.object_attributes.note,
        noteable_type: event.object_attributes.noteable_type,
        noteable_id: event.object_attributes.noteable_id,
        created_at: event.object_attributes.created_at,
      };
    }

    if (event.object_kind === 'issue' && 'object_attributes' in event) {
      (sanitized as any).issue = {
        iid: event.object_attributes.iid,
        title: event.object_attributes.title,
        state: event.object_attributes.state,
      };
    }

    if (event.object_kind === 'merge_request' && 'object_attributes' in event) {
      (sanitized as any).merge_request = {
        iid: event.object_attributes.iid,
        title: event.object_attributes.title,
        state: event.object_attributes.state,
        source_branch: event.object_attributes.source_branch,
        target_branch: event.object_attributes.target_branch,
      };
    }

    return sanitized;
  }
}