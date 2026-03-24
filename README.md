# AI Agent Self-Healing DevSecOps Pipeline on AWS

> **Presented at AWS Community Day Pune** — A live demo of AI-powered, automated vulnerability remediation.

This project demonstrates how an **AI Agent** can behave like a senior DevSecOps engineer — automatically **detecting**, **analyzing**, and **fixing** security vulnerabilities with zero human intervention.

---

## The AI Agent Mental Model: Observe > Think > Act

| Step | What Happens | AWS Service |
|------|-------------|-------------|
| **Observe** | CI pipeline generates SBOM and detects vulnerabilities | GitHub Actions |
| **Think** | AI Agent analyzes the CVE and determines the correct fix | Amazon Bedrock (Claude 3) |
| **Act** | Agent creates a Pull Request with the fix and explanation | GitHub API + Lambda |

---

## Architecture

```
Developer → GitHub → GitHub Actions
 │
 ├── Generate CycloneDX SBOM
 ├── Scan for Vulnerabilities
 ├── Upload SBOM → S3 (Storage)
 └── Invoke AI Agent Lambda
           │
 ┌─────────┼─────────┐
 ▼         ▼         ▼
Amazon   AWS SNS  Amazon S3
Bedrock  (Alerts) (Reports)
(Claude 3 Haiku)
           │
           ▼
    GitHub Pull Request
     (Auto-Fix Applied)
```

**AWS Services Used:**
- **AWS Lambda** — AI Agent brain (Observe → Think → Act logic)
- **Amazon Bedrock** — Claude 3 Haiku for vulnerability analysis
- **Amazon S3** — Stores SBOMs and AI analysis reports
- **AWS Secrets Manager** — Securely stores GitHub PAT
- **Amazon SNS** — Sends notifications when a fix is applied
- **Amazon EventBridge** — Routes Inspector findings to Lambda
- **AWS IAM + OIDC** — Keyless authentication for GitHub Actions
- **Amazon CloudWatch** — Logs and metrics for the Lambda function

---

## Project Structure

```
.
├── lambda/
│   └── index.mjs              # AI Agent (Observe → Think → Act)
├── .github/
│   └── workflows/
│       ├── ci.yml             # Main CI/CD pipeline
│       └── self-healing.yml   # Self-healing trigger
├── scripts/
│   ├── generate-sbom.js       # CycloneDX SBOM generator
│   └── scan-vulns.js          # Vulnerability scanner
├── terraform/
│   └── main.tf                # All AWS infrastructure (IaC)
├── docs/
│   ├── demo/                  # AWS Console screenshots
│   ├── demo.md                # Live demo screenshots page
│   ├── architecture.md        # System design and data flow
│   ├── setup-guide.md         # Step-by-step deployment
│   ├── DEMO_SETUP_GUIDE.md    # Quick-reference demo card
│   ├── demo-walkthrough.md    # Live demo guide
│   ├── aws-console-guide.md   # Console navigation guide
│   ├── terraform-reference.md # Terraform variables and outputs
│   └── troubleshooting.md     # Common errors and fixes
├── index.js                   # Sample vulnerable application
└── package.json
```

---

## Quick Start

### 1. Deploy Infrastructure
```bash
cd terraform
terraform init
terraform apply \
  -var="github_owner=<YOUR_GITHUB_USERNAME>" \
  -var="github_repo=<YOUR_REPO_NAME>" \
  -var="github_token=<YOUR_GITHUB_PAT>"
```

### 2. Add GitHub Secrets
| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | Output from Terraform |
| `S3_BUCKET` | Output from Terraform (`data_bucket_name`) |

### 3. Trigger the Demo
```bash
# Edit package.json: "lodash": "4.17.15"
git add . && git commit -m "demo: introduce vulnerability" && git push origin main
```

### 4. Watch the Magic
- GitHub Actions runs the pipeline
- AI Agent analyzes the vulnerability using Bedrock
- A Pull Request is **automatically created** with the fix!

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Architecture](docs/architecture.md) | Full system design and AWS service interactions |
| [Setup Guide](docs/setup-guide.md) | Step-by-step deployment guide |
| [Demo Setup Guide](docs/DEMO_SETUP_GUIDE.md) | Quick-reference card for the live demo |
| [Demo Walkthrough](docs/demo-walkthrough.md) | Running the live end-to-end demo |
| [Live Demo Screenshots](docs/demo.md) | AWS Console screenshots from the live system |
| [AWS Console Guide](docs/aws-console-guide.md) | How to find each AWS service in the Console |
| [Terraform Reference](docs/terraform-reference.md) | All infrastructure variables and outputs |
| [Troubleshooting](docs/troubleshooting.md) | Common errors and fixes |

---

## Live Demo — AWS Console Screenshots

### GitHub Actions — Pipeline Success
All steps pass: SBOM generated, vulnerability scanned, uploaded to S3, Lambda invoked.

![GitHub Actions pipeline showing all steps succeeded](docs/demo/03-github-actions-pipeline-success.png)

---

### AWS Lambda — AI Agent Function
The `ai-self-healing-agent` Lambda with EventBridge trigger wired up.

![Lambda function overview showing EventBridge trigger and Function ARN](docs/demo/02-lambda-function-console.png)

---

### Lambda CloudWatch Metrics
8 invocations at 3000ms duration with 100% success rate.

![CloudWatch metrics showing 8 invocations with 100% success rate](docs/demo/06-lambda-cloudwatch-metrics.png)

---

### Amazon S3 — SBOM Storage
SBOMs uploaded by each CI run stored in the `sboms/` folder.

![S3 sboms folder showing 7 uploaded SBOM JSON files](docs/demo/07-s3-sboms-folder.png)

---

### Amazon S3 — Bucket Console
The `ai-devsecops-data-95aaa281` bucket created by Terraform.

![S3 bucket console showing ai-devsecops-data-95aaa281](docs/demo/09-s3-bucket-console.png)

---

### AWS Secrets Manager — GitHub Token
GitHub PAT stored securely as `github-token-ai-agent`.

![Secrets Manager showing github-token-ai-agent secret](docs/demo/04-secrets-manager-console.png)

---

### Amazon SNS — Alerts Topic
The `ai-devsecops-alerts` topic that sends fix notifications.

![SNS Topics page showing ai-devsecops-alerts topic with ARN](docs/demo/01-sns-topic-console.png)

---

### SNS — Email Subscription Confirmation
Confirmation email received after subscribing to the SNS topic.

![AWS SNS subscription confirmation email](docs/demo/05-sns-subscription-email.png)

---

### Amazon EventBridge — Inspector Rule
The `inspector-vulnerability-finding` rule routing Inspector findings to Lambda.

![EventBridge rule details showing inspector-vulnerability-finding event pattern](docs/demo/08-eventbridge-rule-console.png)
