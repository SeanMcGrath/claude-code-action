#!/usr/bin/env bun

import { GitLabTriggerValidator } from '../gitlab/validation/trigger.js';
import { GitLabActionConfig } from '../gitlab/types.js';

async function main() {
  try {
    const claudeTriggerData = process.env.CLAUDE_TRIGGER_DATA;

    if (!claudeTriggerData) {
      console.log('No CLAUDE_TRIGGER_DATA found, skipping validation');
      console.log('::set-env name=TRIGGER_VALID::false');
      return;
    }

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
    };

    const validator = new GitLabTriggerValidator(actionConfig);
    const triggerResult = validator.validatePipelineTrigger(claudeTriggerData);

    if (triggerResult.shouldTrigger) {
      console.log('Trigger validation successful:', {
        triggerType: triggerResult.triggerType,
        resourceType: triggerResult.resourceType,
        resourceId: triggerResult.resourceId,
        projectId: triggerResult.projectId,
      });
      console.log('::set-env name=TRIGGER_VALID::true');
    } else {
      console.log('Trigger validation failed');
      console.log('::set-env name=TRIGGER_VALID::false');
    }

  } catch (error) {
    console.error('Trigger validation error:', error);
    console.log('::set-env name=TRIGGER_VALID::false');
    process.exit(1);
  }
}

main();