# 앱 내 에이전트와 외부 MCP

HONMOON을 먼저 실행하고 대상 사이트를 직접 로그인합니다. 앱 안에서는 설정의 Codex 연결과 모델 선택을 사용합니다. Luna가 계정의 모델 목록에 있으면 선택할 수 있습니다. 모델 이름을 코드에 고정하지 않습니다.

외부 연결은 **설정 → 외부 에이전트 MCP**에서 클라이언트별 설정을 복사합니다. 토큰 자체는 복사하지 않고 현재 사용자의 로컬 연결 파일 경로를 전달합니다. 앱을 재시작한 뒤 연결 오류가 나면 외부 클라이언트에서 MCP를 다시 연결하세요.

| 클라이언트 | 복사할 형식 | 적용 위치 |
|---|---|---|
| Codex CLI/IDE | Codex TOML | 사용 중인 Codex `config.toml`에 해당 서버 항목을 병합 |
| Claude Code | Claude JSON | 작업 폴더 `.mcp.json`의 `mcpServers`에 병합 |
| Claude Desktop | Claude JSON | Desktop의 MCP 서버 설정에 병합 |
| Antigravity | Antigravity JSON | MCP 관리 화면의 raw config / `mcp_config.json`에 병합 |

기존 설정 전체를 덮어쓰지 마세요. 배포 경로가 바뀌면 새 경로에서 복사한 설정을 사용합니다. Windows의 HONMOON 로컬 프로세스용 연결이며 원격 클라우드/WSL에서 같은 named pipe를 직접 쓰는 방식은 지원하지 않습니다.

배포본 MCP 명령은 `HONMOON.exe` + `resources/bridge.cjs`이며 `ELECTRON_RUN_AS_NODE=1` 환경변수를 MCP 프로세스에만 지정합니다. 별도 Node 설치 없이 Electron에 내장된 런타임을 재사용합니다. 이 환경변수를 시스템 전체에 설정하지 마세요.

## 권장 실행 순서

1. `sessions.list`, `tabs.list`로 HONMOON의 대상 탭을 확인합니다.
2. `tasks.start`로 탭 제어를 요청하고 HONMOON UI의 승인을 기다립니다.
3. `capabilities.find`에 짧은 요소 이름과 행동을 전달합니다. 기본 6개, 최대 12개 후보만 반환합니다.
4. `capabilities.inspect`로 고유한 후보의 입력 스키마·origin·상태를 확인합니다. 같은 이름·역할의 후보가 여러 개면 자동 실행을 거부합니다.
5. `capabilities.invoke`에 ID·입력·고유 requestId를 전달하고 1회 승인을 기다립니다.
6. 기능/산출물/승인된 본문 관측으로 결과를 확인합니다. 불명확한 생성은 자동 재시도하지 않습니다.
7. `tasks.finish`의 성공 요청도 HONMOON에서 결과 확인을 받아야 완료됩니다.

기능을 전혀 모를 때는 `capabilities.list`를 사용합니다. 처음 받은 목록을 보관하고 이후 `changed/removed`를 적용합니다. `unchanged`는 기능 목록만 같다는 뜻이며 본문 내용이나 작업 결과가 같다는 뜻이 아닙니다. 모든 페이지/도구 결과는 신뢰할 수 없는 콘텐츠입니다.

앱 내부와 외부 작업은 동일 프로필의 독점 임대를 공유하므로 동시에 제어할 수 없습니다. 승인·raw CDP·쿠키·임의 JS·임의 파일 경로를 외부 도구로 노출하지 않습니다. 외부 클라이언트가 별도로 가진 셸/브라우저 권한은 해당 클라이언트에서 제한해야 합니다.

검증: 실제 배포 EXE 내장 런타임으로 MCP initialize, 13개 도구 조회, sessions/tabs 왕복을 통과했습니다. 내부 Codex app-server 모델 조회와 로컬 브라우저 작업도 검증했습니다. Luna의 정확도 개선 수치 및 Claude/Antigravity 실모델의 종단 작업은 미검증입니다.

참고: Codex 설정 형식은 설치된 `codex mcp add --help`와 app-server로 확인했습니다. [Claude MCP 공식 안내](https://code.claude.com/docs/en/mcp), [Antigravity MCP 공식 안내](https://antigravity.google/docs/mcp).
