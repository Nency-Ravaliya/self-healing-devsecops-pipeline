# ️ Setup Guide

Complete step-by-step guide to deploy the AI Self-Healing DevSecOps pipeline.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| AWS CLI | v2+ | [docs.aws.amazon.com](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| Terraform | >= 1.5.0 | [developer.hashicorp.com](https://developer.hashicorp.com/terraform/downloads) |
| Node.js | >= 18 | [nodejs.org](https://nodejs.org) |
| Git | Latest | [git-scm.com](https://git-scm.com) |

---

## Phase 1: AWS Account Preparation

### 1.1 Amazon Bedrock — Claude 3 Haiku

> The Model Access page has been retired. Claude 3 Haiku is automatically enabled on first invocation across all AWS commercial regions.

For first-time Anthropic users, you may be prompted to submit use case details:
1. Go to **Amazon Bedrock** in the AWS Console
2. Click **Model catalog** and search for `Claude 3 Haiku`
3. Click **Request access**, fill in your business use case, and submit
4. Approval is usually instant

> Region: Ensure you are in `us-east-1` (N. Virginia).

### 1.2 Configure AWS CLI

```bash
# Install on Mac
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Configure credentials
aws configure
# Enter: Access Key ID, Secret Access Key, region: us-east-1, output: json

# Verify
aws sts get-caller-identity
```

---

## Phase 2: GitHub Preparation

### 2.1 Fork/Clone the Repository

```bash
git clone https://github.com/yatricloud/ai-self-healing-devsecops-demo-aws-community-day-pune.git
cd ai-self-healing-devsecops-demo-aws-community-day-pune
```

### 2.2 Create a GitHub Personal Access Token (PAT)

1. Go to **GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)**
2. Click **Generate new token (classic)**
3. Select scope: `repo` (full control)
4. Copy and save the token — you'll need it for Terraform

---

## Phase 3: Deploy Infrastructure (Terraform)

### 3.1 Initialize

```bash
cd terraform
terraform init
```

### 3.2 Apply

```bash
terraform apply \
 -var="github_owner=<YOUR_GITHUB_USERNAME>" \
 -var="github_repo=<YOUR_REPO_NAME>" \
 -var="github_token=<YOUR_PAT_TOKEN>"
```

Type `yes` when prompted.

### 3.3 Note Outputs

After apply completes, note these values:

```
data_bucket_name = "ai-devsecops-data-xxxxxxxx"
github_actions_role_arn = "arn:aws:iam::XXXXXXXXXXXX:role/ai-self-healing-agent-github-actions"
lambda_function_name = "ai-self-healing-agent"
sns_topic_arn = "arn:aws:sns:us-east-1:XXXXXXXXXXXX:ai-devsecops-alerts"
```

---

## Phase 4: Configure GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value |
|------------|-------|
| `AWS_ROLE_ARN` | `github_actions_role_arn` from Terraform output |
| `S3_BUCKET` | `data_bucket_name` from Terraform output |

---

## Phase 5: (Optional) Subscribe to SNS Alerts

To receive email notifications when the AI Agent creates a fix:

```bash
aws sns subscribe \
 --topic-arn <sns_topic_arn from Terraform> \
 --protocol email \
 --notification-endpoint your@email.com
```

Check your email and confirm the subscription.

---

## Phase 6: Verify Deployment

```bash
# Check Lambda exists
aws lambda get-function --function-name ai-self-healing-agent

# Check S3 bucket
aws s3 ls | grep ai-devsecops

# Check Secrets Manager
aws secretsmanager list-secrets | grep github-token

# Test Lambda directly (optional)
aws lambda invoke \
 --function-name ai-self-healing-agent \
 --payload '{"vulns":[{"package":"lodash","currentVersion":"4.17.15","cve":"CVE-2020-8203","severity":"HIGH","description":"Prototype pollution","recommendedVersion":"4.17.21"}]}' \
 --cli-binary-format raw-in-base64-out \
 output.json && cat output.json
```

---

## You're Ready! 

Your infrastructure is fully deployed. Proceed to the [Demo Walkthrough](demo-walkthrough.md) to run the live end-to-end demo.
