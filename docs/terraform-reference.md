# Terraform Reference

Complete reference for all Terraform variables, resources, and outputs.

---

## Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `aws_region` | string | `us-east-1` | AWS region to deploy all resources |
| `github_owner` | string | — | GitHub username or org |
| `github_repo` | string | — | GitHub repository name |
| `github_token` | string (sensitive) | — | GitHub PAT with `repo` scope |
| `base_branch` | string | `main` | Branch for PRs to target |
| `use_mock_ai` | bool | `true` | Use mock AI instead of real Bedrock |

> **Note**: Set `use_mock_ai = false` to use real Amazon Bedrock for AI analysis.

---

## Resources Created

### Storage Layer
| Resource | Type | Name |
|----------|------|------|
| `aws_s3_bucket.data_bucket` | S3 Bucket | `ai-devsecops-data-<random>` |
| `aws_s3_bucket_public_access_block` | S3 Config | (blocks all public access) |

### Secrets Layer
| Resource | Type | Name |
|----------|------|------|
| `aws_secretsmanager_secret.github_token` | Secret | `github-token-ai-agent` |
| `aws_secretsmanager_secret_version` | Secret Value | GitHub PAT value |

### Automation Layer
| Resource | Type | Name |
|----------|------|------|
| `aws_sns_topic.alerts` | SNS Topic | `ai-devsecops-alerts` |
| `aws_lambda_function.ai_self_healing` | Lambda | `ai-self-healing-agent` |
| `aws_iam_role.lambda_role` | IAM Role | `ai-self-healing-agent-role` |

### EventBridge (AI Trigger)
| Resource | Type | Name |
|----------|------|------|
| `aws_cloudwatch_event_rule.inspector_finding` | Event Rule | `inspector-vulnerability-finding` |
| `aws_cloudwatch_event_target.lambda_target` | Event Target | Routes to Lambda |
| `aws_lambda_permission.allow_eventbridge` | Permission | Allows EventBridge to invoke Lambda |

### CI/CD Auth (GitHub OIDC)
| Resource | Type | Name |
|----------|------|------|
| `aws_iam_openid_connect_provider.github` | OIDC Provider | `token.actions.githubusercontent.com` |
| `aws_iam_role.github_actions_invoke_lambda` | IAM Role | `ai-self-healing-agent-github-actions` |

---

## IAM Permissions Summary

### Lambda Role (`ai-self-healing-agent-role`)
```
logs:CreateLogGroup
logs:CreateLogStream
logs:PutLogEvents
↓
bedrock:InvokeModel (on Claude 3 Haiku)
↓
secretsmanager:GetSecretValue (on github-token-ai-agent)
↓
sns:Publish (on ai-devsecops-alerts)
↓
s3:PutObject, s3:GetObject (on ai-devsecops-data-*)
```

### GitHub Actions Role (`ai-self-healing-agent-github-actions`)
```
lambda:InvokeFunction (on ai-self-healing-agent)
↓
s3:PutObject, s3:GetObject (on ai-devsecops-data-*/*)
↓
inspector2:StartSbomExport
inspector2:ListFindings
inspector2:BatchGetFindingDetails
```

---

## Outputs

| Output | Description | Example |
|--------|-------------|---------|
| `lambda_function_name` | Lambda name | `ai-self-healing-agent` |
| `github_actions_role_arn` | Role ARN for GitHub Secrets | `arn:aws:iam::123456789012:role/...` |
| `data_bucket_name` | S3 bucket name for S3_BUCKET secret | `ai-devsecops-data-95aaa281` |
| `sns_topic_arn` | SNS topic ARN for subscriptions | `arn:aws:sns:us-east-1:...` |

---

## Common Commands

```bash
# Plan (preview changes)
terraform plan \
 -var="github_owner=<owner>" \
 -var="github_repo=<repo>" \
 -var="github_token=<token>"

# Apply
terraform apply \
 -var="github_owner=<owner>" \
 -var="github_repo=<repo>" \
 -var="github_token=<token>"

# Use real Bedrock (not mock)
terraform apply \
 -var="use_mock_ai=false" \
 -var="github_owner=<owner>" \
 -var="github_repo=<repo>" \
 -var="github_token=<token>"

# Get outputs at any time
terraform output

# Destroy all resources
terraform destroy \
 -var="github_owner=<owner>" \
 -var="github_repo=<repo>" \
 -var="github_token=<token>"
```
