$ErrorActionPreference='Stop'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$package=Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json
$asset="HONMOON-$($package.version)-win-x64.zip"
$folder=Join-Path $repoRoot 'release\HONMOON-win32-x64'
$archive=Join-Path $repoRoot ('release\'+$asset)
if (-not (Test-Path -LiteralPath (Join-Path $folder 'HONMOON.exe'))) { throw 'Run npm run package first.' }
# Copy only distribution files; running Chromium may create a locked debug.log.
$staging=Join-Path ([IO.Path]::GetTempPath()) ('honmoon-release-'+[guid]::NewGuid().ToString('N'))
$clean=Join-Path $staging 'HONMOON-win32-x64'
New-Item -ItemType Directory -Path $clean | Out-Null
$rootFiles=@('chrome_100_percent.pak','chrome_200_percent.pak','d3dcompiler_47.dll','dxcompiler.dll','dxil.dll','ffmpeg.dll','HONMOON.exe','icudtl.dat','LICENSE','LICENSES.chromium.html','resources.pak','snapshot_blob.bin','START-HERE.md','Start-HONMOON.cmd','THIRD_PARTY_NOTICES.md','v8_context_snapshot.bin','version','vk_swiftshader_icd.json','vk_swiftshader.dll','vulkan-1.dll')
foreach ($file in $rootFiles) { Copy-Item -LiteralPath (Join-Path $folder $file) -Destination (Join-Path $clean $file) }
foreach ($directory in @('resources','locales','docs')) { New-Item -ItemType Directory -Path (Join-Path $clean $directory) | Out-Null }
foreach ($file in @('app.asar','bridge.cjs','agent-browser-win32-x64.exe')) { Copy-Item -LiteralPath (Join-Path $folder ('resources/'+$file)) -Destination (Join-Path $clean ('resources/'+$file)) }
foreach ($file in @('ko.pak','en-US.pak')) { Copy-Item -LiteralPath (Join-Path $folder ('locales/'+$file)) -Destination (Join-Path $clean ('locales/'+$file)) }
foreach ($file in @('INTEGRATIONS.md','RELEASE.md','TOKEN-COMPARISON.md','VALIDATION.md','REVISION-2026-09-28.md')) { Copy-Item -LiteralPath (Join-Path $folder ('docs/'+$file)) -Destination (Join-Path $clean ('docs/'+$file)) }
Compress-Archive -LiteralPath $clean -DestinationPath $archive -Force
$hash=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
@{version=$package.version;asset=$asset;sha256=$hash;platform='win32-x64'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $repoRoot 'release\honmoon-release.json') -Encoding utf8
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'install.ps1') -Destination (Join-Path $repoRoot 'release\install.ps1')
Write-Output $archive
