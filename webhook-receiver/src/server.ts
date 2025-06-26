import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import crypto from 'crypto';
import { GitLabWebhookHandler } from './webhook-handler.js';
import { GitLabTriggerValidator } from '../../src/gitlab/validation/trigger.js';
import { GitLabActionConfig } from '../../src/gitlab/types.js';

const app = express();
const port = process.env.PORT || 8080;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Logging middleware
app.use(morgan('combined'));

// Parse JSON with increased size limit for large payloads
app.use(express.json({ limit: '10mb' }));

// Configuration
const config: GitLabActionConfig = {
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

const triggerValidator = new GitLabTriggerValidator(config);
const webhookHandler = new GitLabWebhookHandler(config);

// Webhook signature verification middleware
function verifyWebhookSignature(req: express.Request, res: express.Response, next: express.NextFunction) {
  const webhookSecret = process.env.GITLAB_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.warn('GITLAB_WEBHOOK_SECRET not set - skipping signature verification');
    return next();
  }

  const signature = req.headers['x-gitlab-token'] as string;
  
  if (!signature) {
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  if (signature !== webhookSecret) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  return next();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Main webhook endpoint
app.post('/webhook/gitlab', verifyWebhookSignature, async (req, res) => {
  try {
    const event = req.body;
    const eventType = req.headers['x-gitlab-event'] as string;
    
    console.log(`Received GitLab webhook: ${eventType}`, {
      projectId: event.project?.id,
      objectKind: event.object_kind,
      user: event.user?.username,
    });

    // Validate trigger conditions
    const triggerResult = triggerValidator.validateTrigger(event);
    
    if (!triggerResult.shouldTrigger) {
      console.log('Webhook did not meet trigger conditions', triggerResult);
      return res.json({ message: 'No action required' });
    }

    console.log('Trigger validated, processing webhook', triggerResult);

    // Handle the webhook asynchronously
    webhookHandler.handleWebhook(event, triggerResult)
      .catch(error => {
        console.error('Error handling webhook:', error);
      });

    // Respond quickly to GitLab
    res.json({ 
      message: 'Webhook received and processing started',
      triggerType: triggerResult.triggerType,
      resourceType: triggerResult.resourceType,
      resourceId: triggerResult.resourceId,
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Manual trigger endpoint for testing
app.post('/trigger/manual', async (req, res) => {
  try {
    const { projectId, resourceType, resourceId, prompt } = req.body;
    
    if (!projectId || !resourceType || !resourceId) {
      return res.status(400).json({ 
        error: 'Missing required fields: projectId, resourceType, resourceId' 
      });
    }

    const triggerResult = triggerValidator.validateDirectTrigger(
      projectId,
      resourceType,
      resourceId,
      prompt || 'Manual trigger'
    );

    await webhookHandler.handleManualTrigger(triggerResult, prompt);

    return res.json({ 
      message: 'Manual trigger started',
      triggerResult 
    });

  } catch (error) {
    console.error('Error processing manual trigger:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  // Basic metrics - in production, you'd use a proper metrics library
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(port, () => {
  console.log(`Claude GitLab Webhook Receiver listening on port ${port}`);
  console.log(`Configuration:`, {
    triggerPhrase: config.triggerPhrase,
    labelTrigger: config.labelTrigger,
    baseBranch: config.baseBranch,
    branchPrefix: config.branchPrefix,
    model: config.claudeModel,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

export default app;