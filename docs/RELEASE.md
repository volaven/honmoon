# Windows 설치와 배포

저장소: https://github.com/volaven/honmoon

Windows x64 생성 시험판: [v0.1.0-media-preview-r9](https://github.com/volaven/honmoon/releases/tag/v0.1.0-media-preview-r9). 서명되지 않은 개발 시제품이며 자동 업데이트는 포함하지 않습니다. 실사이트 영상 생성·다운로드 전체 검증은 아직 완료되지 않았습니다.

## 터미널에서 설치

PowerShell에서 설치 스크립트를 내려받습니다. 실행 전에 스크립트 내용을 확인할 수 있습니다.

```powershell
Invoke-WebRequest https://github.com/volaven/honmoon/releases/download/v0.1.0-media-preview-r9/install.ps1 -OutFile install-honmoon.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-honmoon.ps1 -Repository volaven/honmoon -Version v0.1.0-media-preview-r9 -AddToPath
```

설치 후 새 터미널에서 `honmoon`을 실행합니다. 현재 터미널에서는 다음 명령을 사용합니다.

```powershell
& "$env:LOCALAPPDATA\Programs\HONMOON\honmoon.cmd"
```

사전 릴리스이므로 `latest` 대신 위 버전을 지정합니다. Node.js/npm은 패키지 실행에 필요하지 않습니다. 내장 에이전트는 별도 Codex 실행 파일을 사용합니다. 외부 MCP만 사용할 때 HONMOON 내장 Codex 로그인은 필수가 아닙니다.

설치기는 `honmoon-release.json`과 ZIP을 받아 SHA-256을 검사하고 `%LOCALAPPDATA%/Programs/HONMOON/versions/<version>`에 설치합니다. `-AddToPath`는 사용자 PATH에 런처를 추가합니다. 기존 설치와 프로필을 삭제하거나 덮어쓰지 않습니다.

시험판은 `%APPDATA%/HONMOON-Media-Preview`를 유지하므로 기존 시험판 로그인 쿠키를 계속 사용합니다. 일반 빌드는 `%APPDATA%/HONMOON`을 사용합니다.

## 소스에서 실행

Node.js 24 이상, Windows x64:

```powershell
git clone https://github.com/volaven/honmoon.git
cd honmoon
npm ci
npm test
npm run build
npm start
```

`npm run verify`는 별도 임시 프로필을 사용하는 Chromium 통합 검사입니다. [Codex 브라우저·MCP 연결 안내](CODEX-BROWSER.md)를 참고하세요.

## 개발자 패키징

```powershell
npm run package
node scripts/package-check.mjs
node scripts/verify-package.cjs
./scripts/release.ps1
```

ZIP, `honmoon-release.json`, `install.ps1`을 함께 배포합니다. EXE만 따로 배포하지 않습니다. 시험판은 `HONMOON_PACKAGE_VARIANT=media-preview-rN`으로 별도 디렉터리에 만들며 기존 시험판을 덮어쓰지 않습니다.

`.github/workflows/release.yml`은 Windows에서 lockfile 설치·단위 검사·빌드·패키지 검사를 실행합니다. 일반 `v<package.version>` 태그는 초안 릴리스를 만듭니다. `v*-media-preview-*` 태그는 자동 빌드에서 제외하며 별도로 검증한 패키지를 올립니다. 계정이 필요한 통합 검사를 CI가 통과했다고 표시하지 않습니다.

프로필·인증 파일·다운로드·개인 진단 기록은 Git 및 패키지에서 제외합니다. 런타임 라이선스와 고정 의존성 목록은 패키지에 포함합니다. 클린 Windows 장치·코드 서명·자동 업데이트 서비스 검증은 별도 단계입니다.
