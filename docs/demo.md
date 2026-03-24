# Demo — AWS Console Screenshots

Live screenshots from the deployed AI Self-Healing DevSecOps pipeline.

---

## GitHub Actions — Pipeline Success

All steps completed successfully: SBOM generated, vulnerability scanned, uploaded to S3, and Lambda invoked.

![GitHub Actions pipeline showing all steps succeeded](demo/03-github-actions-pipeline-success.png)

---

## AWS Lambda — AI Agent Function

The `ai-self-healing-agent` Lambda function with EventBridge trigger configured.

![Lambda function overview showing EventBridge trigger and Function ARN](demo/02-lambda-function-console.png)

---

## Lambda CloudWatch Metrics

Lambda invocations, duration, and success rate metrics confirming the AI Agent ran successfully.

![CloudWatch metrics showing 8 invocations at 3000ms duration with 100% success rate](demo/06-lambda-cloudwatch-metrics.png)

---

## Amazon S3 — SBOM Storage

The S3 bucket `ai-devsecops-data-95aaa281` with SBOMs uploaded by the CI pipeline.

![S3 sboms folder showing 7 uploaded SBOM JSON files](demo/07-s3-sboms-folder.png)

---

## Amazon S3 — Bucket Console

The S3 bucket created by Terraform for storing SBOMs and AI analysis reports.

![S3 bucket console showing ai-devsecops-data-95aaa281](demo/09-s3-bucket-console.png)

---

## AWS Secrets Manager — GitHub Token

The GitHub PAT stored securely as `github-token-ai-agent`.

![Secrets Manager showing github-token-ai-agent secret created March 20 2026](demo/04-secrets-manager-console.png)

---

## Amazon SNS — Alerts Topic

The `ai-devsecops-alerts` SNS topic that sends notifications when a fix is applied.

![SNS Topics page showing ai-devsecops-alerts topic with its ARN](demo/01-sns-topic-console.png)

---

## SNS — Email Subscription Confirmation

Email received when subscribing to the SNS topic.

![AWS Notification subscription confirmation email showing the SNS topic ARN](demo/05-sns-subscription-email.png)

---

## Amazon EventBridge — Inspector Rule

The `inspector-vulnerability-finding` rule that routes AWS Inspector findings to the Lambda function.

![EventBridge rule details showing event pattern filtering for aws.inspector2 source](demo/08-eventbridge-rule-console.png)
