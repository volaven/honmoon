# macOS 시험 빌드

Apple Silicon (`arm64`, M 시리즈)과 Intel (`x64`)을 별도로 빌드합니다. Electron 내장 Chromium, 로컬 실행기, Codex 작업창, 외부 MCP를 같은 소스로 구성합니다. Windows 패키지는 Mac에서 실행하지 않습니다.

## 소스에서 실행

Mac에 Git과 Node.js 24 이상을 설치한 뒤 터미널에서 실행합니다.

```sh
git clone --branch codex/macos-support https://github.com/volaven/honmoon.git
cd honmoon
npm ci
npm run build
npm start
```

에이전트 작업에는 별도로 설치한 Codex CLI가 필요합니다. 터미널에서 `codex --version`을 확인하세요. Finder로 실행한 앱에서도 `/opt/homebrew/bin`, `/usr/local/bin`을 탐색합니다. nvm 등 별도 경로를 사용한다면 설정의 **실행파일 위치 지정**으로 선택하거나 해당 Node가 PATH에 있는 터미널에서 실행합니다. 자동 모델 대체나 다른 브라우저의 로그인 정보 복사는 하지 않습니다.

## .app 패키지 만들기

패키지는 Mac에서 만듭니다. 기본 아키텍처는 빌드에 사용하는 Node의 아키텍처입니다. Apple Silicon에서는 `node -p process.arch`가 `arm64`인지 확인하세요.

```sh
npm run package:mac
node scripts/package-check.mjs
node scripts/verify-native.mjs
node scripts/release-macos.mjs
```

생성 위치:

- Apple Silicon: `release/HONMOON-darwin-arm64/HONMOON.app`
- Intel: `release/HONMOON-darwin-x64/HONMOON.app`
- 배포 파일: `release/HONMOON-0.1.0-macos-<arch>.zip` 및 `.zip.sha256`

GitHub Actions의 **macOS builds**는 두 아키텍처의 네이티브 러너에서 빌드·테스트·패키지 검증을 실행합니다. 성공한 작업의 Artifacts에서 `honmoon-macos-arm64` 또는 `honmoon-macos-x64`를 받습니다. GitHub Artifact 바깥 ZIP을 먼저 풀면 실제 배포 ZIP, 체크섬, 설치기가 있습니다. 워크플로는 릴리스를 자동 공개하지 않습니다.

## 터미널 설치

HONMOON을 종료하고 ZIP, 동일 이름의 `.sha256`, `install-macos.sh`를 같은 폴더에 둡니다.

```sh
sh install-macos.sh ./HONMOON-0.1.0-macos-arm64.zip
env -u ELECTRON_RUN_AS_NODE open "$HOME/Applications/HONMOON.app"
```

Intel Mac은 파일명의 `arm64`를 `x64`로 바꿉니다. 설치기는 SHA-256과 앱 서명을 검사하고 `~/Applications/HONMOON.app`에 설치합니다. 기존 앱은 날짜가 붙은 백업으로 남기며 프로필을 삭제하지 않습니다. 환경변수 `ELECTRON_RUN_AS_NODE`를 사용하는 도구에서는 패키지의 `Start-HONMOON.command`로도 실행할 수 있습니다.

현재 패키지는 **로컬 ad-hoc 서명**이며 Apple Developer ID 서명·공증은 없습니다. macOS가 첫 실행을 차단하면 시스템 설정 → 개인정보 보호 및 보안에서 해당 앱의 열기를 허용해야 할 수 있습니다. 설치기는 Gatekeeper를 끄거나 격리 속성을 자동 삭제하지 않습니다. Developer ID 배포는 별도 인증서와 공증 설정이 필요합니다.

## 프로필과 외부 에이전트

- 일반 프로필: `~/Library/Application Support/HONMOON`
- 생성 시험판 프로필: `~/Library/Application Support/HONMOON-Media-Preview`
- 같은 Mac의 같은 변형을 업데이트하면 프로필 경로를 유지합니다. Windows의 쿠키·OS 암호화 키는 이전하지 않으며 Mac에서는 처음 한 번 직접 로그인합니다.
- Auth Vault 키는 Electron `safeStorage`의 macOS Keychain 보호를 사용합니다. 브라우저 프로필 전체가 암호화된다는 뜻은 아닙니다.
- Codex·Claude 등 외부 도구에는 설정의 **MCP 설정 복사**를 사용합니다. macOS에서는 짧은 임시 경로의 Unix 소켓, 소유자 전용 디렉터리(0700), 연결 파일·소켓(0600), 매 실행 갱신되는 인증 토큰을 사용합니다. Windows의 named pipe 설정을 수동으로 복사하지 않습니다.
- 창 왼쪽의 macOS 기본 버튼과 탭이 겹치지 않도록 공간을 확보하며 기본 앱·편집 메뉴를 제공합니다. 창을 닫으면 작업을 취소하고 저장 후 종료합니다.

## 검증 범위

로컬 Windows에서 TypeScript/UI 빌드와 회귀 테스트를 수행했습니다. macOS 전용 권한 검사는 Mac 러너에서 수행합니다. 네이티브 통합 검사는 임시 프로필과 로컬 테스트 사이트만 사용하며 개인 로그인·실서비스 생성·유료 API를 사용하지 않습니다. Grok/Flow 및 Luna high의 실제 계정 동작은 이 이식 작업으로 새로 검증됐다고 표시하지 않습니다.

참고: [Electron 창 API](https://www.electronjs.org/docs/latest/api/browser-window), [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), [GitHub Mac 러너](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
