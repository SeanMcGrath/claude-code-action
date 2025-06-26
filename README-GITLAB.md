# Claude Code Action for GitLab

A GitLab CI/CD integration that enables Claude to interact with GitLab issues and merge requests, providing AI-powered code assistance, reviews, and automated implementations.

## Features

- **Issue & MR Comments**: Respond to `@claude` mentions in issues and merge requests
- **Assignee Triggers**: Automatically trigger when issues/MRs are assigned to specific users
- **Label Triggers**: Trigger when specific labels are applied to issues/MRs
- **Code Reviews**: Provide comprehensive code reviews for merge requests
- **Implementation**: Implement code changes directly in repositories
- **Branch Management**: Smart branch creation and management
- **Multiple AI Providers**: Support for Anthropic API, AWS Bedrock, and Google Vertex AI

## Architecture

The GitLab integration consists of three main components:

1. **Webhook Receiver**: Processes GitLab webhooks and triggers CI/CD pipelines
2. **GitLab CI Pipeline**: Executes Claude with appropriate context and tools
3. **MCP Server**: Provides GitLab-specific file operations and API access

## Quick Start

### 1. Deploy Webhook Receiver

```bash
# Clone the repository
git clone https://github.com/anthropics/claude-code-action.git
cd claude-code-action

# Copy environment configuration
cp .env.example .env

# Edit .env with your GitLab configuration
nano .env

# Start the webhook receiver
docker-compose up -d webhook-receiver
```

### 2. Configure GitLab Project

#### Create Access Tokens

1. **Project Access Token** (recommended):
   - Go to your GitLab project → Settings → Access Tokens
   - Create token with scopes: `api`, `read_repository`, `write_repository`
   - Copy the token to `GITLAB_TOKEN` in your `.env`

2. **Pipeline Trigger Token**:
   - Go to Settings → CI/CD → Pipeline triggers
   - Create a new trigger token
   - Copy the token to `GITLAB_TRIGGER_TOKEN` in your `.env`

#### Set Up Webhooks

1. Go to your GitLab project → Settings → Webhooks
2. Add a new webhook:
   - **URL**: `https://your-domain.com/webhook/gitlab`
   - **Secret Token**: Set `GITLAB_WEBHOOK_SECRET` in your `.env`
   - **Trigger Events**: Check these options:
     - Issues events
     - Merge request events
     - Comments
3. Test the webhook to ensure it's working

### 3. Configure CI/CD Pipeline

Copy the provided `.gitlab-ci.yml` to your repository root:

```yaml
# The .gitlab-ci.yml is already provided in this repository
# It includes all necessary jobs for Claude processing
```

### 4. Set CI/CD Variables

In your GitLab project, go to Settings → CI/CD → Variables and add:

**Required Variables:**
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `GITLAB_TOKEN`: Your GitLab access token

**Optional Variables:**
- `TRIGGER_PHRASE`: Custom trigger phrase (default: `@claude`)
- `CUSTOM_INSTRUCTIONS`: Additional instructions for Claude
- `ALLOWED_TOOLS`: Comma-separated list of additional tools
- `DISALLOWED_TOOLS`: Comma-separated list of tools to disable

## Usage

### Basic Usage

1. **Comment Trigger**: Mention `@claude` in any issue or MR comment
2. **Issue Assignment**: Assign an issue to the configured trigger user
3. **Label Trigger**: Add the configured label to an issue or MR

### Example Interactions

#### Code Review Request
```
@claude please review this merge request for:
- Security vulnerabilities
- Performance issues
- Code quality improvements
```

#### Implementation Request
```
@claude implement the following:
- Add input validation to the user registration form
- Include proper error handling
- Write unit tests for the new functionality
```

#### Question About Code
```
@claude can you explain how the authentication middleware works?
What are the potential security implications?
```

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITLAB_URL` | GitLab instance URL | Required |
| `GITLAB_TOKEN` | GitLab access token | Required |
| `GITLAB_TRIGGER_TOKEN` | Pipeline trigger token | Required |
| `TRIGGER_PHRASE` | Phrase to trigger Claude | `@claude` |
| `ASSIGNEE_TRIGGER` | Username for assignee triggers | - |
| `LABEL_TRIGGER` | Label name for label triggers | `claude` |
| `BASE_BRANCH` | Default base branch | `main` |
| `BRANCH_PREFIX` | Prefix for created branches | `claude/` |
| `CLAUDE_MODEL` | Claude model to use | `claude-3-5-sonnet-20241022` |
| `MAX_TURNS` | Maximum conversation turns | `10` |
| `TIMEOUT_MINUTES` | Pipeline timeout | `30` |

### AI Provider Configuration

#### Anthropic API (Direct)
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

#### AWS Bedrock
```env
USE_BEDROCK=true
# Ensure your GitLab runners have AWS credentials configured
```

#### Google Vertex AI
```env
USE_VERTEX=true
# Ensure your GitLab runners have GCP credentials configured
```

## Advanced Setup

### Self-Hosted GitLab

For self-hosted GitLab instances:

1. Update `GITLAB_URL` to your instance URL
2. Ensure the webhook receiver can reach your GitLab instance
3. Configure any necessary firewall rules or VPN access

### Custom Runner Configuration

For custom GitLab runners with specific requirements:

```yaml
# In .gitlab-ci.yml, modify the image and before_script as needed
claude-respond:
  image: your-custom-image:latest
  before_script:
    - # Your custom setup commands
    - curl -fsSL https://bun.sh/install | bash
    - export PATH="$HOME/.bun/bin:$PATH"
    - bun install
```

### Webhook Receiver Scaling

For high-traffic repositories:

```yaml
# In docker-compose.yml
webhook-receiver:
  deploy:
    replicas: 3
  # Add load balancer configuration
```

## Security Considerations

### Token Security
- Use project-specific access tokens with minimal required permissions
- Rotate tokens regularly
- Store tokens as CI/CD variables, not in repository files

### Webhook Security
- Always use webhook secrets to verify request authenticity
- Use HTTPS for webhook URLs
- Consider IP allowlisting for webhook endpoints

### Runner Security
- Use private runners for sensitive repositories
- Limit Claude's tool access via `ALLOWED_TOOLS` and `DISALLOWED_TOOLS`
- Audit Claude's actions through GitLab's activity logs

## Troubleshooting

### Common Issues

#### Webhook Not Triggering
1. Check webhook URL is accessible from GitLab
2. Verify webhook secret matches `GITLAB_WEBHOOK_SECRET`
3. Check webhook receiver logs: `docker-compose logs webhook-receiver`

#### Pipeline Fails to Start
1. Verify `GITLAB_TRIGGER_TOKEN` is correct
2. Check pipeline trigger permissions
3. Ensure `.gitlab-ci.yml` is in repository root

#### Claude Comment Not Updating
1. Verify GitLab token has `api` scope
2. Check CI/CD job logs for API errors
3. Ensure comment ID is being passed correctly

#### Permission Errors
1. Verify access token has required scopes
2. Check user permissions on the repository
3. Ensure runner has necessary access

### Debug Mode

Enable debug logging:

```env
NODE_ENV=development
DEBUG=claude:*
```

### Log Analysis

Check logs in the following order:
1. Webhook receiver logs: `docker-compose logs webhook-receiver`
2. GitLab CI job logs: In GitLab CI/CD → Pipelines
3. System logs for the GitLab runner

## Migration from GitHub

If migrating from the GitHub Action:

1. **Data Mapping**:
   - Issues → Issues (similar)
   - Pull Requests → Merge Requests
   - Comments → Notes

2. **Configuration Changes**:
   - `GITHUB_TOKEN` → `GITLAB_TOKEN`
   - GitHub webhooks → GitLab webhooks
   - Action inputs → CI/CD variables

3. **Feature Differences**:
   - No OIDC token exchange (use access tokens)
   - Different API structure (REST vs GraphQL)
   - Different permission model

## API Rate Limits

GitLab API rate limits vary by instance:
- GitLab.com: 2000 requests/minute per user
- Self-hosted: Configurable by administrator

The integration automatically handles rate limiting with exponential backoff.

## Contributing

See the main repository's contributing guidelines. GitLab-specific contributions should:

1. Test against both GitLab.com and self-hosted instances
2. Follow GitLab API best practices
3. Include appropriate error handling for GitLab-specific responses

## Support

For issues:
1. Check the troubleshooting section above
2. Review GitLab CI job logs
3. Open an issue in the repository with:
   - GitLab version (GitLab.com or self-hosted version)
   - Configuration (with sensitive data redacted)
   - Full error logs
   - Steps to reproduce