# ️ Architecture: AI Self-Healing DevSecOps Pipeline

## Overview

This system implements a fully automated, event-driven security remediation pipeline. When a vulnerability is detected in application dependencies, the AI Agent automatically analyzes it and submits a Pull Request with the fix — no human intervention required.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ CI/CD LAYER │
│ │
│ Developer ──push──▶ GitHub ──trigger──▶ GitHub Actions │
│ │ │
│ ┌───────────────┼────────────────┐ │
│ │ │ │ │
│ Generate Scan for Upload │
│ SBOM Vulnerabilities to S3 │
│ │ │ │ │
└──────────────────────────────┼───────────────┼────────────────┼────┘
 │ │ │
 │ ▼ │
┌──────────────────────────────┼─────────────────────┐ │
│ AUTOMATION LAYER │ │ │
│ │ │ │
│ AWS Lambda ◀─────────┘ │ │
│ (AI Agent) │ │ │
│ │ │ │
│ ┌────────────────────┐ │ ┌──────────┐ │ │
│ │ [OBSERVE] │ │ │ SNS │ │ │
│ │ Parse vuln data │ │ │ Topic │ │ │
│ │ [THINK] │────┼───▶│ (Notify) │ │ │
│ │ Call Bedrock AI │ │ └──────────┘ │ │
│ │ [ACT] │ │ │ │
│ │ Create PR │ │ │ │
│ └────────────────────┘ │ │ │
│ │ │ │
└──────────────────────────────┼─────────────────────┘ │
 │ │
┌──────────────────────────────┼────────────────────────────────┼────┐
│ STORAGE LAYER │ │ │
│ │ │ │
│ ┌──────────────────┐ │ ┌───────────────┐ │ │
│ │ Amazon S3 │ │ │ Secrets │ │ │
│ │ │ │ │ Manager │ │ │
│ │ /sboms/ │◀─────┼────────────│ github-token │ │ │
│ │ /reports/ │ │ └───────────────┘ │ │
│ └──────────────────┘ │ │ │
│ │ ▲ │ │
│ ┌──────────────────┐ │ │ │ │
│ │ CloudWatch │ │ Lambda fetches token │ │
│ │ Logs │ │ │ │
│ └──────────────────┘ │ ◀───────────────────────────┘ │
│ │ │
└──────────────────────────────┼─────────────────────────────────────┘
 │
┌──────────────────────────────┼─────────────────────────────────────┐
│ AI LAYER │ │
│ │ │
│ ┌──────────────────────────▼──────────────────────────────┐ │
│ │ Amazon Bedrock │ │
│ │ (Claude 3 Haiku) │ │
│ │ │ │
│ │ Input: CVE, package, version, description │ │
│ │ Output: Fixed version + detailed explanation │ │
│ └──────────────────────────────────────────────────────────┘ │
│ │
│ ┌──────────────────┐ │
│ │ EventBridge │ (Listens for Inspector findings) │
│ └──────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. CI/CD Pipeline (GitHub Actions)
1. Developer pushes code to `main` branch
2. GitHub Actions is triggered
3. Node.js dependencies are installed
4. **SBOM Generation**: `scripts/generate-sbom.js` creates a CycloneDX 1.4 SBOM
5. **Vulnerability Scan**: `scripts/scan-vulns.js` checks components against known CVEs
6. **AWS Authentication**: OIDC-based keyless authentication to AWS
7. **S3 Upload**: SBOM is uploaded to `s3://<bucket>/sboms/<sha>.json`
8. **Lambda Invocation**: If vulnerabilities found, Lambda is invoked with `vuln-report.json`

### 2. AI Agent Logic (Lambda)
1. **[OBSERVE]** Receives vulnerability report payload
2. Fetches GitHub token from **AWS Secrets Manager**
3. **[THINK]** Sends CVE details to **Amazon Bedrock** (Claude 3 Haiku)
4. Claude analyzes the vulnerability and returns:
 - Fixed version number
 - Detailed explanation of the vulnerability and fix
5. **[ACT]**:
 - Creates a new branch in GitHub
 - Updates `package.json` with the fixed version
 - Creates a Pull Request with AI-generated description
 - Publishes notification to **SNS topic**
 - Stores detailed report to **S3** (`reports/`)

---

## AWS Services Reference

| Service | Role | Resource Name |
|---------|------|---------------|
| AWS Lambda | AI Agent execution environment | `ai-self-healing-agent` |
| Amazon Bedrock | Claude 3 Haiku model inference | `anthropic.claude-3-haiku-20240307-v1:0` |
| Amazon S3 | SBOM and report storage | `ai-devsecops-data-<suffix>` |
| AWS Secrets Manager | Secure GitHub PAT storage | `github-token-ai-agent` |
| Amazon SNS | Team notifications | `ai-devsecops-alerts` |
| Amazon EventBridge | Inspector finding routing | `inspector-vulnerability-finding` |
| AWS IAM | Role-based access control | `ai-self-healing-agent-role` |
| GitHub OIDC | Keyless CI/CD authentication | `token.actions.githubusercontent.com` |

---

## Security Design

- **No hardcoded credentials**: GitHub token stored in Secrets Manager
- **Least privilege IAM**: Each role has minimal permissions
- **Keyless CI/CD auth**: OIDC eliminates long-lived AWS access keys in GitHub
- **Private S3**: Bucket has all public access blocked
- **Audit trail**: All actions logged to CloudWatch
