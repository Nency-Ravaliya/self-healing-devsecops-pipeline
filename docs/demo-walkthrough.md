# Demo Walkthrough

Step-by-step guide to run the live AI Self-Healing DevSecOps demo.

---

## Pre-Flight Checklist

Before starting the demo, confirm:
- [ ] Terraform has been applied successfully
- [ ] GitHub Secrets `AWS_ROLE_ARN` and `S3_BUCKET` are set
- [ ] Bedrock Claude 3 Haiku is enabled in `us-east-1`
- [ ] SNS email subscription confirmed (optional, for notifications)

---

## Demo Flow

```
Step 1: Push vulnerable code
 ↓
Step 2: Watch GitHub Actions run
 ↓ 
Step 3: Observe: SBOM Generated + Vulnerability Detected
 ↓
Step 4: Think: AI Agent calls Amazon Bedrock
 ↓
Step 5: Act: Pull Request created automatically
 ↓
Step 6: Review the AI-generated explanation & merge
```

---

## Step 1: Introduce a Vulnerability

Edit `package.json` to use a known-vulnerable version of `lodash`:

```json
{
 "dependencies": {
 "lodash": "4.17.15"
 }
}
```

Commit and push:

```bash
git add package.json
git commit -m "demo: introduce vulnerable lodash dependency (CVE-2020-8203)"
git push origin main
```

---

## Step 2: Watch GitHub Actions

1. Go to your repo → **Actions** tab
2. Watch the `AI Self-Healing DevSecOps Demo` workflow run
3. Follow each step:

| Step | What to Look For |
|------|-----------------|
| **Generate SBOM** | CycloneDX SBOM created at `sbom.json` |
| **Scan for Vulnerabilities** | `️ FOUND 1 VULNERABILITY(S)` — lodash CVE-2020-8203 |
| **Upload SBOM to S3** | ` SBOM stored at s3://ai-devsecops-data-.../sboms/...` |
| **Invoke AI Agent Lambda** | Lambda invoked, response printed |

---

## Step 3: Observe — Vulnerability Detection

The scan output will show:
```
--------------------------------------------------
️ DevSecOps Vulnerability Scan Report
--------------------------------------------------
️ FOUND 1 VULNERABILITY(S)
 - [HIGH] lodash: CVE-2020-8203
 Description: Lodash versions prior to 4.17.21 are vulnerable to Prototype Pollution
 Recommendation: Upgrade to 4.17.21
--------------------------------------------------
```

---

## Step 4: Think — AI Analysis (CloudWatch)

Check Lambda CloudWatch logs to see the AI thinking:

```bash
aws logs tail /aws/lambda/ai-self-healing-agent --follow
```

You'll see:
```
[INIT] Fetching GitHub Token from Secrets Manager...
[OBSERVE] Found vulnerability in lodash (4.17.15) - CVE-2020-8203
[THINK] Analyzing vulnerability with AI...
[THINK] AI Analysis complete. Recommended fix: 4.17.21
[THINK] Rationale: Lodash 4.17.21 patches the prototype pollution vulnerability...
[ACT] Implementing the fix...
[ACT] Pull Request created successfully: https://github.com/.../pull/1
[NOTIFY] Sending alerts and storing reports...
```

---

## Step 5: Act — Check the Pull Request

1. Go to your repo → **Pull Requests** tab
2. Find the PR titled: `️ AI Fix: Update lodash to 4.17.21`
3. Open it and review:
 - The **code diff** showing `4.17.15` → `4.17.21`
 - The **AI-generated description** explaining the vulnerability and fix

---

## Step 6: Check S3 Report

```bash
# List reports in S3
aws s3 ls s3://<your-bucket>/reports/

# Download and view the AI analysis report
aws s3 cp s3://<your-bucket>/reports/<file>.json report.json
cat report.json
```

The report contains:
```json
{
 "vulnerability": { "package": "lodash", "cve": "CVE-2020-8203", ... },
 "aiAnalysis": { "fixedVersion": "4.17.21", "explanation": "..." },
 "actionTaken": { "prUrl": "https://github.com/.../pull/1", "timestamp": "..." }
}
```

---

## Merge the Fix

Once reviewed, merge the Pull Request. The vulnerability is fixed! 

You can now push another vulnerable commit to see the cycle repeat.

---

## Key Demo Talking Points

1. **"No human wrote this PR"** — The AI Agent did it all automatically
2. **"The AI explains its reasoning"** — Not a black box, full transparency
3. **"Secure by design"** — No credentials in CI/CD, uses OIDC + Secrets Manager
4. **"Full audit trail"** — Every action stored in S3 + CloudWatch
5. **"Event-driven"** — Can also be triggered by AWS Inspector findings via EventBridge
