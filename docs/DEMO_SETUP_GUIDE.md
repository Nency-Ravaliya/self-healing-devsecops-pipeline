# ️ AI Self-Healing DevSecOps — Demo Setup Guide

> Quick-reference guide for running the live demo at AWS Community Day Pune.

---

## Pre-Demo Checklist

Before presenting, verify these are all done:

- [ ] Terraform applied (`cd terraform && terraform apply`)
- [ ] `AWS_ROLE_ARN` secret set in GitHub
- [ ] `S3_BUCKET` secret set in GitHub (`ai-devsecops-data-95aaa281`)
- [ ] Bedrock Claude 3 Haiku enabled in `us-east-1`
- [ ] AWS CLI configured (`aws sts get-caller-identity` works)
- [ ] Lodge the vulnerable version: `"lodash": "4.17.15"` in `package.json`

---

## Demo Steps (Live)

### Step 1 — Push Vulnerable Code
```bash
# Ensure package.json has: "lodash": "4.17.15"
git add package.json
git commit -m "demo: introduce vulnerable dependency"
git push origin main
```

### Step 2 — Watch GitHub Actions
Go to **Actions** tab → Watch `AI Self-Healing DevSecOps Demo` run.

Key stages to show the audience:
1. **Generate SBOM** → CycloneDX SBOM created
2. **Scan** → `️ FOUND 1 VULNERABILITY(S)` — CVE-2020-8203
3. **Upload to S3** → SBOM stored in AWS
4. **Invoke Lambda** → AI Agent triggered

### Step 3 — Show Lambda Logs (Optional)
```bash
aws logs tail /aws/lambda/ai-self-healing-agent --follow
```
Shows the Observe → Think → Act reasoning in real-time.

### Step 4 — Show the Pull Request
Go to **Pull Requests** tab → Open `️ AI Fix: Update lodash to 4.17.21`

Point out:
- The code diff (the actual fix)
- The AI-generated explanation of WHY the fix is correct
- No human wrote this PR!

### Step 5 — Show S3 Report (Optional)
```bash
aws s3 ls s3://ai-devsecops-data-95aaa281/reports/
```

---

## Quick Fix Commands

| Problem | Fix |
|---------|-----|
| Workflow fails with OIDC error | Verify `AWS_ROLE_ARN` GitHub secret |
| S3 upload fails | Verify `S3_BUCKET` GitHub secret = `ai-devsecops-data-95aaa281` |
| Lambda not creating PR | Check CloudWatch logs |
| No vulnerabilities found | Ensure `lodash` version is `4.17.15` in `package.json` |

---

## ️ Deployed AWS Resources

| Resource | Value |
|----------|-------|
| Lambda | `ai-self-healing-agent` |
| S3 Bucket | `ai-devsecops-data-95aaa281` |
| SNS Topic ARN | `arn:aws:sns:us-east-1:249834688649:ai-devsecops-alerts` |
| GitHub Actions Role | `arn:aws:iam::249834688649:role/ai-self-healing-agent-github-actions` |
| Region | `us-east-1` |

---

## More Documentation

- [Architecture](architecture.md)
- [Full Setup Guide](setup-guide.md)
- [Detailed Demo Walkthrough](demo-walkthrough.md)
- [Terraform Reference](terraform-reference.md)
- [Troubleshooting](troubleshooting.md)
