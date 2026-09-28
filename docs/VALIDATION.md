# HONMOON 0.1 검증 보고서

검증일: 2026-09-28 (KST). Windows x64 / Electron 44.4.5 / Chromium 152.0.7977.130 / agent-browser 0.38.1. 개발 소스와 Windows 패키지의 실제 Chromium으로 검증했습니다. 기존 Chrome 연결은 사용하지 않았습니다.

2026-09-28 수정은 `REVISION-2026-09-28.md`, 토큰 관측 비교는 `TOKEN-COMPARISON.md`를 참고하세요.

## 확인한 결과

| 항목 | 결과 / 근거 |
|---|---|
| TypeScript main + React 타입 검사, Vite 및 MCP 번들 | 통과 |
| 정책 단위 테스트 | 12개 통과. 짧은 기능 ID와 변경분 갱신 포함. SQLite 재시작, 강제 종료된 별도 writer 프로세스 복구, 승인 1회성, 입력 스키마, 인증값 제거, 공개 도구 제한 |
| 실제 Chromium 통합 검사 | 개발판 20개, 최신 배포 EXE에서 21개 통과. `evidence/verification.json`, `evidence/package-verification.json` |
| 탭 대상 식별 | 생성·정확한 target 선택·스냅샷·실제 버튼 클릭·닫기 20회. 닫힌 target 및 다른 열린 탭의 계약 거부 |
| 실제 브라우저 작업 | 테스트 사이트 로그인 세션, 승인된 입력, 업로드 POST, 다운로드 파일 내용 검증. 다운로드 SVG 411 bytes |
| 승인과 취소 | 거절 시 미입력, 동일 requestId 재호출 시 재실행 없음, 취소 후 후속 실행 없음, navigation 후 승인 무효화 |
| 제어권 | 프로필 독점 임대, 임대 만료 중지, 네이티브 입력 보호막의 클릭으로 사람에게 회수 |
| 인증 / 실행 경계 | 수동 인증 보호와 password 요소 탐지 시 관측 중단. 외부 페이지에 Node 및 제품 IPC 없음. javascript/file/credentials URL 거부 |
| 단계적 복구 | 실행 실패 이후 접근성 → 제한 DOM → 화면 이미지, 순서 검사 및 단계별 동의 |
| 결과 처리 | 응답 종료를 사업 결과 성공으로 자동 판정하지 않음. 최종 결과 확인 거부 시 실패 기록 |
| Codex 프로토콜 | 실제 app-server initialize/account read/model list, 모델 7개. dynamic tools를 가진 thread/start 성공. 서버 반환 sandbox=readOnly, networkAccess=false, approvalPolicy=on-request |
| 외부 MCP | 배포용 독립 bridge로 실제 SDK initialize/tools.list/sessions.list/tabs.list 왕복. 공개 도구 13개, 승인·셸·쿠키·임의 JS 도구 없음 |
| 의존성 검사 | 고정 package-lock, npm audit 생산 의존성 알려진 취약점 0건. 라이선스 고지와 Chromium license 파일 포함 |

## 수정한 호환성 문제

- ESM의 ready 이전 비동기 초기화 교착을 피하도록 CJS bootstrap에서 Chromium 실행 옵션을 설정합니다.
- Windows 배율 및 초기 view 크기로 입력 좌표가 어긋나는 문제를 해결하기 위해 탭을 선택할 때 viewport를 실제 표시 영역과 맞추고 창·webContents 포커스를 준비하며 viewport 변경 후 화면 합성을 기다립니다. 이 버전은 작업 실행 시 HONMOON을 전면으로 가져옵니다.
- 네이티브 agent-browser 업로드는 Playwright `>> nth` 구문 대신 검증된 CSS 경로를 사용합니다.
- 설치된 Codex CLI는 `untrusted` 승인 정책을 거부하여 지원되는 `on-request`를 사용하고, HONMOON 밖의 승인 요청은 거절합니다.
- agent-browser 데몬은 앱별 소켓 디렉터리와 작업 세대별 세션명으로 관리하며 긴급 중지 시 해당 세션 PID와 대기 CLI를 종료합니다.
- 배포본의 외부 Node 프로세스는 ASAR 내부에 접근할 수 없으므로 MCP bridge를 독립 번들로 resources에 배치합니다.

처음 실패했던 클릭·업로드·Codex 시작 검사는 수정 전 실패였으며 통과 횟수로 세지 않았습니다. `window.capturePage()`로 만든 shell 이미지는 native child view를 포함하지 않으므로 완전한 제품 화면의 증거로 쓰지 않습니다. 네이티브 창은 별도로 화면 검사했습니다.

## 사용자 참여가 남은 관문

- **Codex 계정 인증 후 자연어 작업 종단 검증:** app-server 연결과 제한된 대화 생성까지 확인했습니다. 실제 모델의 자연어 → HONMOON 동적 도구 → 승인 → 결과 완료는 아직 검증하지 않았습니다. 전용 로그인은 앱 설정에서 사용자가 완료해야 합니다.
- **Flow/Grok:** 실계정 로그인, 각 화면 계약, 비용이 드는 생성·다운로드 검증 전입니다. 일반 기능 후보를 발견할 수 있어도 해당 서비스 지원 완료를 뜻하지 않습니다. UI에서 ‘실계정 검증 필요’로 표시합니다.
- **성능 목표:** 사이트별 10개 작업의 paired baseline 비교를 아직 실행하지 않았습니다. 입력 토큰 중앙값 40% 감소, 완료율 저하 5%p 이내, 오인 제어·승인 누락 0건을 달성했다고 주장하지 않습니다. `benchmarks/`에 입력 형식과 평가기가 있고 미측정 데이터는 합격하지 않습니다.
- **Auth Vault:** DPAPI 키와 upstream encrypted save/login 경로를 연결했습니다. 실서비스 계정의 저장·로그인 및 실패 복구는 실계정 파일럿 대상입니다. 전체 프로필 암호화는 제공하지 않습니다.

## 재현

`npm ci` → `npm run build` → `npm test` → `npm run verify`.

`npm run package` → `node scripts/verify-package.cjs`. 패키지 검사의 데이터는 Windows Temp의 별도 `honmoon-test-*` 프로필에 생성되고 보고서는 `%TEMP%/honmoon-package-verification/evidence/verification.json`에 기록됩니다. 테스트 자동 승인은 이 별도 프로필의 로컬 테스트 사이트에만 사용합니다.

이 검증은 범용 사이트 호환성이나 완전한 보안 인증을 뜻하지 않습니다. 최초 배포는 로컬 사용자 1명용 개발 시제품입니다.

최신 배포본은 기본 Windows 제목 표시줄 없이 실행됩니다. titlebar safe area·패널 접기, 검색/상세 확인 후 실제 승인 입력도 통합 검사에 포함합니다. 배포 EXE를 Node 모드로 실행한 MCP bridge의 initialize/tools.list/sessions.list/tabs.list 왕복을 통과했습니다. Claude·Antigravity 앱 자체의 실모델 연결은 미검증입니다.
