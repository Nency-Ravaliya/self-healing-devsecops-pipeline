# Troubleshooting Guide

Common errors and their fixes for the AI Self-Healing DevSecOps Pipeline.

---

## GitHub Actions Errors

### `s3:PutObject AccessDenied`
```
An error occurred (AccessDenied) when calling the PutObject operation...
```
**Fix**: The GitHub Actions IAM role is missing S3 permissions.
```bash
cd terraform
terraform apply -var="..." # Re-apply to update IAM policy
```
Also ensure `S3_BUCKET` secret is set in GitHub (Settings → Secrets → Actions).

---

### `S3_BUCKET` Secret is Empty / Invalid bucket name
```
Invalid bucket name "": Bucket name must match the regex...
```
**Fix**: Add the `S3_BUCKET` secret to GitHub.
1. Run `terraform output data_bucket_name` to get the bucket name
2. Go to GitHub repo → Settings → Secrets and variables → Actions
3. Add secret `S3_BUCKET` with the bucket name value

---

### `inspector2: argument operation: Found invalid choice 'start-sbom-scan'`
```
aws: [ERROR]: An error occurred (ParamValidation): argument operation: Found invalid choice 'start-sbom-scan'
```
**Fix**: This is not a valid AWS CLI subcommand. AWS Inspector2 scans deployed resources automatically — it does not accept external SBOM uploads via CLI. The current workflow uses direct Lambda invocation instead.

---

### OIDC Authentication Failed
```
Error: Could not assume role with ARN arn:aws:iam::...
```
**Fix**: Check the GitHub Actions IAM role trust policy.
- Ensure `AWS_ROLE_ARN` secret is set to the value from `terraform output github_actions_role_arn`
- The OIDC condition should match your repo: `repo:<owner>/<repo>:ref:refs/heads/main`

---

## Terraform Errors

### `No configuration files`
```
Error: No configuration files
Apply requires configuration to be present.
```
**Fix**: You must run Terraform from inside the `terraform/` directory.
```bash
cd terraform # ← Make sure you're in this directory
terraform apply -var="..."
```

---

### `Inconsistent dependency lock file`
```
Error: Inconsistent dependency lock file
- provider registry.terraform.io/hashicorp/random: required by this configuration but no version is selected
```
**Fix**: Run `terraform init` again after adding new providers.
```bash
terraform init
terraform apply -var="..."
```

---

### `Missing newline after argument` / HCL Syntax Error
```
Error: Missing newline after argument
 on main.tf line 200: event_pattern = JSON.stringify({
```
**Fix**: HCL doesn't support JavaScript functions. Use `jsonencode()` instead.
```hcl
# Wrong
event_pattern = JSON.stringify({...})

# Correct
event_pattern = jsonencode({...})
```

---

### Secrets Manager `ResourceExistsException`
```
Error: creating Secrets Manager Secret: ResourceExistsException: A resource with the ID already exists.
```
**Fix**: A previous secret was not fully deleted (recovery window). Either:
- Wait ~7 days for auto-deletion, OR
- Force delete the secret:
```bash
aws secretsmanager delete-secret \
 --secret-id github-token-ai-agent \
 --force-delete-without-recovery
```
Then re-run `terraform apply`.

---

## Lambda / AI Agent Errors

### Lambda exits with `Ignored event`
```
[OBSERVE] Unknown event format or no vulnerabilities found.
Return: { message: 'Ignored event' }
```
**Fix**: The payload format is incorrect. Ensure `vuln-report.json` has this structure:
```json
{
 "vulns": [
 {
 "package": "lodash",
 "currentVersion": "4.17.15",
 "cve": "CVE-2020-8203",
 "severity": "HIGH",
 "description": "...",
 "recommendedVersion": "4.17.21"
 }
 ]
}
```

---

### Bedrock `AccessDeniedException`
```
AccessDeniedException: User is not authorized to perform: bedrock:InvokeModel
```
**Fix**: 
1. Ensure Claude 3 Haiku is enabled in Bedrock → Model access
2. Re-run Terraform to ensure Lambda role has Bedrock permissions
3. Check you're in region `us-east-1`

---

### GitHub PR creation fails — `422 Unprocessable Entity`
```
GitHub API POST /repos/.../pulls failed: 422 {"message":"Validation Failed"...}
```
**Fix**: A PR from this branch may already exist. This happens if you run the demo twice quickly. Either:
- Merge or close the existing PR, then re-trigger
- The branch name includes a timestamp so it should be unique — check for race conditions in logs

---

## Git Remote Errors

### `'origin' does not appear to be a git repository`
```
fatal: 'origin' does not appear to be a git repository
```
**Fix**: The remote may be named `main` instead of `origin`.
```bash
git remote -v # Check remote names
git remote rename main origin # Rename if needed
git push origin main
```

---

## Getting Help

1. Check **CloudWatch Logs**: `aws logs tail /aws/lambda/ai-self-healing-agent --follow`
2. Check **S3 reports**: `aws s3 ls s3://<bucket>/reports/`
3. Check **GitHub Actions** logs in the Actions tab
