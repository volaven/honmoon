# HONMOON 0.1 — Chromium 내장 에이전트 브라우저

Windows x64 및 macOS(Apple Silicon·Intel)용 개발 시제품입니다. macOS는 시험 빌드이며 [Mac 실행·설치 안내](docs/MACOS.md)에 검증 범위를 표시합니다. Electron의 Chromium이 실제 웹페이지를 렌더링합니다. 기존 Chrome에 연결하거나 Chrome 프로필을 복사하지 않습니다. 테마 시제품 `../prototypes/honmoon`은 그대로 보존했습니다.

저장소: [volaven/honmoon](https://github.com/volaven/honmoon). 최신 검증 패키지는 [생성 시험판 r9](https://github.com/volaven/honmoon/releases/tag/v0.1.0-media-preview-r9)입니다. 실제 Grok/Flow 영상 생성의 전체 경로는 아직 시험 지원입니다.

[설치·배포](docs/RELEASE.md) · [Codex 인앱 브라우저 / HONMOON MCP 실행 안내](docs/CODEX-BROWSER.md) · [생성 기능](docs/MEDIA-GENERATION.md) · [검증 범위](docs/MEDIA-VALIDATION.md)

## 실행

패키지 폴더 전체를 유지한 상태로 **HONMOON.exe**를 실행하세요. EXE만 따로 복사하지 마세요. `ELECTRON_RUN_AS_NODE` 환경변수를 사용하는 개발 도구 안에서는 **Start-HONMOON.cmd**를 사용합니다. 코드 서명과 자동 업데이트는 포함하지 않았습니다.

소스 실행은 Node.js 24 이상에서 `npm ci`, `npm run build`, `npm start` 순서입니다. `npm test`는 정책 검증, `npm run verify`는 별도 임시 프로필을 쓰는 실제 Chromium 통합 검증입니다. Windows의 `npm run package`는 `release/HONMOON-win32-x64`를, Mac의 `npm run package:mac`은 `release/HONMOON-darwin-<arch>/HONMOON.app`을 생성합니다.

## 사용 순서

1. 주소창에서 사이트를 엽니다. 로그인·2FA·CAPTCHA는 **로그인 모드**에서 직접 처리합니다. 완료하면 **인증 보호 중**을 눌러 해제합니다. 로그인 입력이 감지된 화면은 별도로 관측을 차단합니다.
2. 오른쪽 **설정 → ChatGPT 계정으로 연결**에서 HONMOON 전용 Codex 인증을 진행합니다. 표시된 코드를 인증 탭에 직접 입력하세요. 설정 창을 닫으면 인증 탭이 보입니다. Codex CLI가 설치되어 있어야 합니다. PATH와 Codex 데스크톱의 설치 경로에서 자동 탐색하고 실행 가능 여부를 검사합니다. 실패하면 **연결 다시 시도** 또는 **실행파일 위치 지정**을 사용하세요.
3. 모델을 선택하고 작업을 입력합니다. **작업 전체 승인 후 시작**으로 대상·파일·생성 횟수를 미리 승인하거나, 개별 동작을 승인합니다. 개별 승인 창은 2분 후 만료됩니다. 생성 작업 기본 프리셋은 계정에서 지원 여부를 확인한 `gpt-6-luna / high`입니다.
4. **긴급 중지** 또는 페이지 클릭으로 제어권을 회수합니다. 중지 전에 사이트에 접수된 생성·전송은 사이트에서 결과를 확인해야 합니다.
5. 다운로드는 주소창 오른쪽 **다운로드(↓)**에서 확인합니다. PNG/JPEG/WebP/GIF/MP4/WebM은 앱 안에서 미리볼 수 있습니다. 다른 형식은 폴더에서 확인합니다.

Codex 로그인 없이도 **현재 화면의 기능 찾기 → 기능 선택 → 실행 검토 요청 → 1회 승인**으로 실제 브라우저 동작을 시험할 수 있습니다. 시작 페이지는 간단한 검색 화면입니다. **설정 → 테스트 사이트 열기**의 생성 버튼은 테스트 SVG를 만듭니다. 실제 AI 서비스 결과가 아닙니다.

상단 **에이전트** 버튼으로 작업 패널을 접고 펼칩니다. 큰 로고·장식 사이드바·소개 문구는 제거했습니다.

## 저장과 권한

- 앱 데이터: Windows `%APPDATA%/HONMOON`, macOS `~/Library/Application Support/HONMOON`. 전용 Chromium 프로필, SQLite 작업·승인·산출물 메타데이터, 다운로드, 별도 Codex 설정을 저장합니다.
- 생성 시험판(r9 포함)은 `%APPDATA%/HONMOON-Media-Preview`를 사용합니다. 시험판 업데이트 시 이 프로필을 유지하며 쿠키·인증 파일을 배포하거나 다른 브라우저에서 복사하지 않습니다.
- Auth Vault는 agent-browser의 AES 암호화 저장소를 사용합니다. 키는 Electron safeStorage를 통해 Windows DPAPI / macOS Keychain으로 보호합니다. upstream 저장 위치인 사용자 홈의 `.agent-browser/auth`에 `honmoon-UUID` 이름으로 저장하고 키·목록은 HONMOON 데이터에 보관합니다. **브라우저 프로필 전체가 암호화된다는 뜻이 아닙니다.**
- 일반 페이지는 sandbox/contextIsolation을 사용하며 Node.js와 제품 IPC가 없습니다. 웹 권한은 제품의 별도 승인 창으로 요청합니다.
- 자동화는 앱이 만든 탭의 target ID만 선택합니다. CDP는 내부 루프백 포트이며 공개 MCP는 임의 CDP·JS·셸·쿠키·인증정보 조회를 제공하지 않습니다. 로컬 계정 자체가 침해된 상황을 격리하는 보안 제품은 아닙니다.
- 파일 업로드는 사용자가 파일 선택 창에서 고른 ID만 허용합니다. 경로·크기·수정시간·내용 해시를 실행 전에 다시 검사합니다.
- 기능 후보는 허가가 아닙니다. 사이트, 화면 버전, 접근성 요소, 입력 스키마, 승인 조건과 성공 확인 지침을 갖는 계약으로 검토·기록합니다. 현재 일반 웹 계약은 매 실행 승인이 필요합니다.
- 동시 에이전트 작업은 프로필당 1개, 임대 15분입니다. 앱 재시작 시 미완료 작업은 중지 상태로 복구하며 재실행하지 않습니다.

## 외부 MCP

설정의 **MCP 설정 복사**를 사용합니다. 앱 실행 중에만 현재 사용자에게 제한된 연결 파일과 인증된 로컬 연결(Windows named pipe / macOS Unix 소켓)을 이용합니다. 배포본은 Electron 내장 Node 런타임으로 MCP bridge를 실행하므로 별도 Node 설치가 필요하지 않습니다. 소스 개발판은 Node.js 24 이상을 사용합니다.

조회: `sessions.list`, `tabs.list`, `capabilities.list`, `capabilities.find`, `capabilities.inspect`, `tasks.status`, `artifacts.list`.
실행: `tasks.start`, `capabilities.invoke`, `tasks.cancel`, `tasks.finish`.
복구 관측: `page.read`, `page.inspect` (각 단계별 사용자 동의).
승인을 결정하는 도구는 없습니다. 외부 작업 시작도 앱 안에서 승인해야 합니다.

## 검증 범위와 남은 관문

`docs/VALIDATION.md`와 `evidence/verification.json`에 실제 검증 결과를 기록합니다. Codex app-server 연결·모델 조회는 검증했지만, 계정 로그인 후 자연어 작업의 종단 실행은 별도 검증 관문입니다. Flow/Grok은 실계정 로그인과 생성 비용이 필요한 파일럿 단계로 표시합니다. 각 10개 작업의 토큰·완료율 비교는 아직 수행하지 않았고 40% 절감 등 성능 목표를 달성했다고 표시하지 않습니다.

시제품에는 일반 접근성 기반 계약, 승인된 텍스트 관측, 실패 이후 접근성 → 제한 DOM → 화면 이미지 순서의 복구 관측이 있습니다. Flow/Grok 전용 계약과 사이트별 사업 결과의 자동 판정은 후속 실계정 검증에서 완성해야 합니다. 결과는 사용자가 확인해야 완료로 기록합니다. 브라우저 명령 완료와 실제 생성·게시 성공을 구분해 표시합니다.

의존성은 `package-lock.json`에 고정했습니다. 주요 런타임: Electron 44.4.5, Chromium 152.0.7977.130, agent-browser 0.38.1, React 19.3.0, MCP SDK 1.30.1. 검증한 Codex CLI는 0.155.0-alpha.16.3입니다.


## Luna와 외부 에이전트

모델 목록에서 사용 가능한 Luna를 선택할 수 있습니다. 기능 이름 일부로 `capabilities.find`를 호출하고 `capabilities.inspect`로 스키마를 확인한 다음 `capabilities.invoke`로 실행합니다. 같은 이름·역할의 후보가 중복되면 실행을 중단합니다. 이 보조 기능은 로컬 규칙으로 동작하며 추가 모델을 호출하지 않습니다. 실제 Luna 완료율 향상은 아직 측정하지 않았습니다.

설정에서 **Codex TOML / Claude JSON / Antigravity JSON**을 복사할 수 있습니다. 앱 내 작업과 외부 작업은 같은 프로필 임대와 사용자 승인을 사용합니다. 연결 방법과 검증 범위는 [외부 연결 안내](docs/INTEGRATIONS.md), 배포 및 CLI 설치는 [릴리스 안내](docs/RELEASE.md)를 참고하세요. 외부 에이전트의 다른 셸/브라우저 도구까지 HONMOON이 통제하지는 않습니다.

토큰 비교는 [측정 보고서](docs/TOKEN-COMPARISON.md)에 있습니다. 큰 페이지의 전체 접근성 정보 대비 절감은 관측했지만 모든 웹 작업의 비용 절감을 입증한 것은 아닙니다.
