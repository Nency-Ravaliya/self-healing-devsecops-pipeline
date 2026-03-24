import https from 'https';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const SECRET_ID = process.env.SECRET_ID;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const BASE_BRANCH = process.env.BASE_BRANCH || 'main';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const S3_BUCKET = process.env.S3_BUCKET;
const USE_MOCK_AI = process.env.USE_MOCK_AI === 'true';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const bedrock = new BedrockRuntimeClient({ region: AWS_REGION });
const secrets = new SecretsManagerClient({ region: AWS_REGION });
const sns = new SNSClient({ region: AWS_REGION });
const s3 = new S3Client({ region: AWS_REGION });

let cachedGithubToken = null;

async function getGithubToken() {
  if (cachedGithubToken) return cachedGithubToken;
  console.log('[INIT] Fetching GitHub Token from Secrets Manager...');
  const command = new GetSecretValueCommand({ SecretId: SECRET_ID });
  const response = await secrets.send(command);
  cachedGithubToken = response.SecretString;
  return cachedGithubToken;
}

export const handler = async (event) => {
  console.log('[EVENT] Received event:', JSON.stringify(event, null, 2));
  
  let vuln;
  
  // Handle direct invocation (backward compatibility)
  if (event.vulns && event.vulns.length > 0) {
    vuln = event.vulns[0];
  } 
  // Handle AWS Inspector Finding (EventBridge)
  else if (event.source === "aws.inspector2") {
    console.log('[OBSERVE] Received AWS Inspector Finding');
    const finding = event.detail;
    vuln = {
      package: finding.packageVulnerabilityDetails?.vulnerablePackages?.[0]?.name || 'unknown',
      currentVersion: finding.packageVulnerabilityDetails?.vulnerablePackages?.[0]?.version || 'unknown',
      cve: finding.title || finding.findingArn,
      severity: finding.severity,
      description: finding.description,
      recommendedVersion: finding.packageVulnerabilityDetails?.vulnerablePackages?.[0]?.fixedInVersion || 'unknown'
    };
  } else {
    console.log('[OBSERVE] Unknown event format or no vulnerabilities found.');
    return { message: 'Ignored event' };
  }

  console.log(`[OBSERVE] Found vulnerability in ${vuln.package} (${vuln.currentVersion}) - ${vuln.cve}`);

  // --- STEP 2: THINK ---
  console.log('[THINK] Analyzing vulnerability with AI...');
  const aiResult = await getFixedVersionFromAI(vuln);
  
  const fixedVersion = aiResult.fixedVersion;
  const explanation = aiResult.explanation;
  console.log(`[THINK] AI Analysis complete. Recommended fix: ${fixedVersion}`);
  console.log(`[THINK] Rationale: ${explanation}`);

  // --- STEP 3: ACT ---
  console.log('[ACT] Implementing the fix...');
  
  const timestamp = Date.now();
  const branchName = `ai-fix-${vuln.package}-${timestamp}`;

  try {
    // 1. Get base branch SHA
    const baseRef = await githubRequest(
      'GET',
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${BASE_BRANCH}`
    );
    const baseSha = baseRef.object.sha;

    // 2. Create new branch
    await githubRequest('POST', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, {
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    });

    // 3. Get package.json content
    const pkgFile = await githubRequest(
      'GET',
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/package.json?ref=${BASE_BRANCH}`
    );

    const pkgJson = JSON.parse(
      Buffer.from(pkgFile.content, 'base64').toString('utf8')
    );

    // 4. Apply fix
    if (!pkgJson.dependencies || !pkgJson.dependencies[vuln.package]) {
      throw new Error(`Package ${vuln.package} not found in dependencies`);
    }
    const oldVersion = pkgJson.dependencies[vuln.package];
    pkgJson.dependencies[vuln.package] = fixedVersion;

    const updatedContent = Buffer.from(
      JSON.stringify(pkgJson, null, 2),
      'utf8'
    ).toString('base64');

    // 5. Commit change
    await githubRequest('PUT', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/package.json`, {
      message: `chore: AI fix for ${vuln.package} from ${oldVersion} to ${fixedVersion}`,
      content: updatedContent,
      sha: pkgFile.sha,
      branch: branchName
    });

    // 6. Create Pull Request
    const pr = await githubRequest('POST', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`, {
      title: `🛠️ AI Fix: Update ${vuln.package} to ${fixedVersion}`,
      head: branchName,
      base: BASE_BRANCH,
      body: [
        `### 🤖 AI Agent Self-Healing Report`,
        `The AI Agent detected and analyzed a vulnerability in the project.`,
        ``,
        `#### 🔍 Observation`,
        `- **Package**: \`${vuln.package}\``,
        `- **Current Version**: \`${vuln.currentVersion}\``,
        `- **Vulnerability**: ${vuln.cve}`,
        `- **Severity**: ${vuln.severity}`,
        ``,
        `#### 🧠 AI Thought Process`,
        `${explanation}`,
        ``,
        `#### ⚡ Action Taken`,
        `Automatically updated \`${vuln.package}\` to version \`${fixedVersion}\` and created this Pull Request.`,
        ``,
        `---`,
        `*Generated by AI DevSecOps Agent*`
      ].join('\n')
    });

    console.log(`[ACT] Pull Request created successfully: ${pr.html_url}`);

    // --- STEP 4: NOTIFY & STORE ---
    console.log('[NOTIFY] Sending alerts and storing reports...');
    
    // 1. Notify via SNS
    await sns.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: `AI Fix Applied: ${vuln.package}`,
      Message: `The AI Agent has automatically created a Pull Request to fix ${vuln.cve} in package ${vuln.package}.\n\nPR: ${pr.html_url}\n\nRationale: ${explanation}`
    }));

    // 2. Store report in S3
    const reportData = {
      vulnerability: vuln,
      aiAnalysis: aiResult,
      actionTaken: {
        prUrl: pr.html_url,
        branch: branchName,
        timestamp: new Date().toISOString()
      }
    };

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: `reports/${vuln.package}-${timestamp}.json`,
      Body: JSON.stringify(reportData, null, 2),
      ContentType: 'application/json'
    }));

    return {
      message: 'Self-healing action completed',
      prUrl: pr.html_url,
      reportKey: `reports/${vuln.package}-${timestamp}.json`
    };
  } catch (error) {
    console.error('[ACT] Failed to implement fix:', error.message);
    throw error;
  }
};

async function getFixedVersionFromAI(vuln) {
  const prompt = `Analyze this vulnerability and suggest the correct updated version. Return:
1. fixed version
2. short explanation

Vulnerability details:
Package: ${vuln.package}
Current version: ${vuln.currentVersion}
CVE: ${vuln.cve}
Description: ${vuln.description}
Scanner Recommendation: ${vuln.recommendedVersion}

Format your response as:
FIXED_VERSION: <version>
EXPLANATION: <text>`;

  if (USE_MOCK_AI) {
    return {
      fixedVersion: vuln.recommendedVersion || vuln.currentVersion,
      explanation: 'Mock AI: verified that the scanner recommendation is correct and compatible.'
    };
  }

  try {
    const modelId = "anthropic.claude-3-haiku-20240307-v1:0"; 
    const input = {
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }]
      }),
    };

    const command = new InvokeModelCommand(input);
    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody.content[0].text;

    // Basic parsing
    const fixedVersionMatch = text.match(/FIXED_VERSION:\s*([^\n]+)/i);
    const explanationMatch = text.match(/EXPLANATION:\s*([\s\S]+)/i);

    return {
      fixedVersion: fixedVersionMatch ? fixedVersionMatch[1].trim() : (vuln.recommendedVersion || vuln.currentVersion),
      explanation: explanationMatch ? explanationMatch[1].trim() : text
    };
  } catch (error) {
    console.warn('Bedrock call failed, falling back to mock behavior:', error.message);
    return {
      fixedVersion: vuln.recommendedVersion || vuln.currentVersion,
      explanation: `Fallback: AI analysis failed (${error.message}). Using scanner recommendation.`
    };
  }
}

async function githubRequest(method, path, body) {
  const token = await getGithubToken();
  const options = {
    hostname: 'api.github.com',
    port: 443,
    path,
    method,
    headers: {
      'User-Agent': 'ai-self-healing-demo',
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new Error(`GitHub API ${method} ${path} failed: ${res.statusCode} ${data}`)
          );
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({});
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

