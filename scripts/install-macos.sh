#!/bin/sh
# Install a downloaded native build without touching browser profiles.
set -eu
if [ "$(uname -s)" != Darwin ]; then echo '이 설치기는 macOS 전용입니다.' >&2; exit 1; fi
if [ "$#" != 1 ]; then echo '사용법: sh install-macos.sh /path/to/HONMOON-version-macos-arch.zip' >&2; exit 1; fi
archive=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
checksum="$archive.sha256"
test -f "$archive" && test -f "$checksum" || { echo 'ZIP과 같은 이름의 .sha256 파일을 같은 폴더에 두세요.' >&2; exit 1; }
expected=$(awk 'NR==1 {print $1}' "$checksum")
actual=$(shasum -a 256 "$archive" | awk '{print $1}')
test "$actual" = "$expected" || { echo 'SHA-256 검증 실패' >&2; exit 1; }
arch=$(uname -m)
case "$arch" in arm64) target=arm64 ;; x86_64) target=x64 ;; *) echo '지원하지 않는 Mac입니다.' >&2; exit 1 ;; esac
# Detect an Apple Silicon machine even when Terminal runs under Rosetta.
if [ "$(sysctl -in sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then target=arm64; fi
case "$(basename "$archive")" in HONMOON-*-macos-"$target".zip) ;; *) echo "이 Mac에는 $target 패키지가 필요합니다." >&2; exit 1 ;; esac
staging=$(mktemp -d /tmp/honmoon-install.XXXXXX)
trap 'rm -rf "$staging"' EXIT HUP INT TERM
ditto -x -k "$archive" "$staging"
bundle="$staging/HONMOON-darwin-$target/HONMOON.app"
test -x "$bundle/Contents/MacOS/HONMOON" || { echo '패키지 실행파일이 없습니다.' >&2; exit 1; }
codesign --verify --deep --strict "$bundle"
destination="$HOME/Applications"
mkdir -p "$destination"
if [ -e "$destination/HONMOON.app" ]; then
 backup="$destination/HONMOON-backup-$(date +%Y%m%d-%H%M%S).app"
 test ! -e "$backup" || { echo '동일한 백업 경로가 있습니다.' >&2; exit 1; }
 mv "$destination/HONMOON.app" "$backup"
fi
ditto "$bundle" "$destination/HONMOON.app"
echo "설치 완료: $destination/HONMOON.app"
echo '로컬 서명 시험판입니다. 첫 실행이 차단되면 시스템 설정 → 개인정보 보호 및 보안에서 이 앱만 열기를 허용하세요.'
echo '브라우저 프로필과 로그인 정보는 변경하지 않았습니다.'
