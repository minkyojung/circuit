# 1Password CLI 통합 가이드

## 설치

```bash
# Homebrew로 설치
brew install --cask 1password-cli

# 설치 확인
op --version
```

## 1단계: 1Password에 OAuth 크레덴셜 저장

1. 1Password 앱 열기
2. 새 항목 생성: "Octave GitHub OAuth (Dev)"
3. 필드 추가:
   - `GITHUB_CLIENT_ID`: Ov23li4kRHEcvoj3dS7P
   - `GITHUB_CLIENT_SECRET`: 1676dc52a3fba93634b9f2bf5496db15a19493e5
4. Vault에 저장 (예: "Development")

## 2단계: 1Password CLI 인증

```bash
# 1Password 계정 로그인 (최초 1회)
op account add

# 세션 시작
eval $(op signin)
```

## 3단계: .env 파일을 1Password 참조로 변경

### Option A: 런타임에 자동 로드 (추천)

`octave/.env` 파일을 다음과 같이 수정:

```bash
# GitHub OAuth Configuration (Development)
# Loaded from 1Password at runtime
GITHUB_CLIENT_ID=op://Development/Octave GitHub OAuth Dev/GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=op://Development/Octave GitHub OAuth Dev/GITHUB_CLIENT_SECRET
```

그런 다음 `main.cjs`를 수정하여 1Password에서 로드:

```javascript
// Before dotenv
const { execSync } = require('child_process');
const fs = require('fs');

// Load secrets from 1Password
try {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const injectedEnv = execSync('op inject', {
    input: envContent,
    encoding: 'utf8'
  });

  // Parse and set environment variables
  injectedEnv.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
} catch (error) {
  console.warn('[1Password] Failed to inject secrets, falling back to .env');
  require('dotenv').config({
    path: path.join(__dirname, '..', '.env')
  });
}
```

### Option B: 명령어로 수동 주입

개발 서버 실행 전:

```bash
# .env 파일에 1Password 시크릿 주입
op inject -i octave/.env -o octave/.env.local

# .env.local 사용하도록 설정
# (main.cjs에서 .env.local 우선 로드)
```

## 4단계: package.json 스크립트 업데이트

```json
{
  "scripts": {
    "dev": "op run -- vite",
    "dev:electron": "op run -- electron .",
    "build": "op run -- vite build"
  }
}
```

`op run --` 프리픽스가 자동으로 1Password에서 시크릿을 주입합니다!

## 장점

✅ **보안**: 시크릿이 파일 시스템에 평문으로 저장되지 않음
✅ **팀 협업**: 팀원마다 자신의 1Password vault 사용
✅ **Rotation**: 1Password에서 시크릿 변경하면 즉시 반영
✅ **감사**: 1Password가 모든 접근을 로깅
✅ **백업**: 1Password가 자동 백업

## Git에 커밋하지 않기

```bash
# .gitignore에 추가
.env
.env.local
```

## 참고 자료

- [1Password CLI 문서](https://developer.1password.com/docs/cli)
- [Secret References](https://developer.1password.com/docs/cli/secret-references)
