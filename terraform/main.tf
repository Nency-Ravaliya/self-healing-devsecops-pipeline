terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# --- STORAGE LAYER ---

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "data_bucket" {
  bucket = "ai-devsecops-data-${random_id.bucket_suffix.hex}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "data_bucket_pab" {
  bucket = aws_s3_bucket.data_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- SECRETS LAYER ---

resource "aws_secretsmanager_secret" "github_token" {
  name        = "github-token-ai-agent"
  description = "GitHub PAT for AI Agent"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "github_token" {
  secret_id     = aws_secretsmanager_secret.github_token.id
  secret_string = var.github_token
}

# --- AUTOMATION LAYER (SNS) ---

resource "aws_sns_topic" "alerts" {
  name = "ai-devsecops-alerts"
}

# --- INFRASTRUCTURE ---

variable "aws_region" {
  type        = string
  description = "AWS region to deploy to"
  default     = "us-east-1"
}

variable "github_owner" {
  type        = string
  description = "GitHub user or org name"
}

variable "github_repo" {
  type        = string
  description = "GitHub repo name"
}

variable "github_token" {
  type        = string
  description = "GitHub PAT used by Lambda to call GitHub API"
  sensitive   = true
}

variable "base_branch" {
  type        = string
  description = "Base branch for PRs"
  default     = "main"
}

variable "use_mock_ai" {
  type        = bool
  description = "Use mock AI instead of Bedrock"
  default     = true
}

locals {
  lambda_name = "ai-self-healing-agent"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "${local.lambda_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "lambda_policy" {
  statement {
    effect = "Allow"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]

    resources = ["arn:aws:logs:*:*:*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel"
    ]
    resources = ["arn:aws:bedrock:*:*:foundation-model/anthropic.claude-3-haiku-*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue"
    ]
    resources = [aws_secretsmanager_secret.github_token.arn]
  }

  statement {
    effect = "Allow"
    actions = [
      "sns:Publish"
    ]
    resources = [aws_sns_topic.alerts.arn]
  }

  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject"
    ]
    resources = ["${aws_s3_bucket.data_bucket.arn}/*"]
  }
}

resource "aws_iam_role_policy" "lambda_logs" {
  name   = "${local.lambda_name}-logs"
  role   = aws_iam_role.lambda_role.id
  policy = data.aws_iam_policy_document.lambda_policy.json
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/index.mjs"
  output_path = "${path.module}/function.zip"
}

resource "aws_lambda_function" "ai_self_healing" {
  function_name = local.lambda_name
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      SECRET_ID    = aws_secretsmanager_secret.github_token.name
      GITHUB_OWNER = var.github_owner
      GITHUB_REPO  = var.github_repo
      BASE_BRANCH  = var.base_branch
      SNS_TOPIC_ARN = aws_sns_topic.alerts.arn
      S3_BUCKET    = aws_s3_bucket.data_bucket.id
      USE_MOCK_AI  = var.use_mock_ai ? "true" : "false"
    }
  }
}

# --- EVENTBRIDGE (Trigger Lambda on Inspector Findings) ---

resource "aws_cloudwatch_event_rule" "inspector_finding" {
  name        = "inspector-vulnerability-finding"
  description = "Trigger Lambda when Inspector finds a vulnerability"

  event_pattern = jsonencode({
    source      = ["aws.inspector2"]
    detail-type = ["Inspector2 Finding"]
  })
}

resource "aws_cloudwatch_event_target" "lambda_target" {
  rule      = aws_cloudwatch_event_rule.inspector_finding.name
  target_id = "TriggerAISelfHealingLambda"
  arn       = aws_lambda_function.ai_self_healing.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ai_self_healing.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.inspector_finding.arn
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]
}

data "aws_iam_policy_document" "github_oidc_assume" {
  statement {
    effect = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    actions = ["sts:AssumeRoleWithWebIdentity"]

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_owner}/${var.github_repo}:ref:refs/heads/main"
      ]
    }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "github_actions_invoke_lambda" {
  name               = "${local.lambda_name}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume.json
}

data "aws_iam_policy_document" "github_actions_policy" {
  statement {
    effect = "Allow"

    actions = [
      "lambda:InvokeFunction"
    ]

    resources = [aws_lambda_function.ai_self_healing.arn]
  }

  statement {
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:GetObject"
    ]

    resources = ["${aws_s3_bucket.data_bucket.arn}/*"]
  }

  statement {
    effect = "Allow"

    actions = [
      "inspector2:StartSbomExport",
      "inspector2:ListFindings",
      "inspector2:BatchGetFindingDetails"
    ]

    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions_invoke_lambda" {
  name   = "${local.lambda_name}-github-invoke"
  role   = aws_iam_role.github_actions_invoke_lambda.id
  policy = data.aws_iam_policy_document.github_actions_policy.json
}

output "lambda_function_name" {
  description = "Name of the AI self-healing Lambda function"
  value       = aws_lambda_function.ai_self_healing.function_name
}

output "github_actions_role_arn" {
  description = "IAM role ARN that GitHub Actions should assume (AWS_ROLE_ARN)"
  value       = aws_iam_role.github_actions_invoke_lambda.arn
}

output "data_bucket_name" {
  value = aws_s3_bucket.data_bucket.id
}

output "sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

