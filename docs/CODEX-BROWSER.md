# Codex 브라우저와 HONMOON 실행

## Codex 자체 인앱 브라우저

Codex 데스크톱 앱의 대화 입력창에서 다음처럼 요청합니다.

```text
@Browser https://example.com 을 열어줘.
```

로컬 웹 서버를 미리보기하려면 서버를 먼저 실행하고 실제 포트로 요청합니다.

```text
@Browser http://localhost:3000 을 열고 화면을 확인해줘.
```

`@Browser`가 보이지 않으면 앱의 Browser/Computer Use 기능과 허용 사이트 설정을 확인합니다. CLI/IDE 자체에는 이 인앱 브라우저 화면이 없습니다. 현재 공식 안내: [Browser](https://learn.chatgpt.com/docs/browser).

## HONMOON을 Codex에서 조작

HONMOON은 Chromium을 내장한 별도 Electron 앱입니다. 현재 구현은 Codex 인앱 브라우저 안에 HONMOON의 EXE를 넣거나 브라우저 엔진을 교체하는 방식이 아닙니다. Codex는 MCP를 통해 HONMOON의 실제 탭을 조작합니다.

1. 설치 폴더의 `Start-HONMOON.cmd` 또는 설치 후 `honmoon` 명령으로 실행합니다.
2. HONMOON에서 대상 웹사이트를 열고 직접 로그인합니다. 기존 생성 시험판은 `%APPDATA%/HONMOON-Media-Preview` 프로필을 계속 사용합니다.
3. HONMOON **설정 → 외부 에이전트 MCP → Codex TOML 복사**를 누릅니다.
4. Codex의 `config.toml`에 복사한 `[mcp_servers.honmoon]` 항목을 병합합니다. 일반적인 위치는 `%USERPROFILE%/.codex/config.toml`이며, `CODEX_HOME`을 지정했다면 그 디렉터리를 사용합니다. 기존 파일 전체를 덮어쓰지 않습니다.
5. Codex에서 MCP를 다시 연결하거나 앱을 재시작한 뒤 새 작업에서 요청합니다.

```text
HONMOON MCP로 열린 탭을 확인하고 현재 Grok 이미지의
생성 기능을 조회해줘. 아직 생성은 제출하지 마.
```

기존 이미지의 영상 변환 예:

```text
HONMOON MCP로 현재 Grok 이미지를 그대로 사용해
480p, 6초 영상으로 변환하고 다운로드해.
이미지를 새로 생성하지 마.
```

외부 제어와 생성 승인은 HONMOON 창에서 처리합니다. 작업 전체 승인 한도는 기존 이미지→영상은 1회, 새 이미지 생성→영상은 2회입니다. 앱 내 Codex 작업과 외부 MCP 작업은 같은 프로필을 동시에 제어하지 않습니다. 외부 Codex를 사용할 때 HONMOON의 내장 Codex 연결은 필수가 아닙니다.

이 안내는 설치 설정을 자동 변경하지 않습니다. 앱에서 복사한 값은 실행 위치와 프로필에 맞는 로컬 경로이며, 연결 파일이나 토큰을 GitHub에 올리지 않습니다.
