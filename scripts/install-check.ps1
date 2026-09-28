$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot=Join-Path $root ('.runtime/installer-negative-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$manifest=Get-Content (Join-Path $root 'release/honmoon-release.json') -Raw | ConvertFrom-Json
$manifest.sha256='0'*64
$bad=Join-Path $testRoot 'bad.json'
$manifest | ConvertTo-Json | Set-Content $bad
$rejected=$false
try { & (Join-Path $PSScriptRoot 'install.ps1') -ArchivePath (Join-Path $root ('release/'+$manifest.asset)) -ManifestPath $bad -InstallDir (Join-Path $testRoot 'bad-install') } catch { if ($_.Exception.Message -notmatch 'SHA-256 mismatch') { throw }; $rejected=$true }
if (-not $rejected -or (Test-Path (Join-Path $testRoot 'bad-install'))) { throw 'Checksum rejection failed.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$malicious=Join-Path $testRoot 'unsafe.zip'
$zip=[IO.Compression.ZipFile]::Open($malicious,'Create')
try { $entry=$zip.CreateEntry('../outside.txt');$writer=New-Object IO.StreamWriter($entry.Open());$writer.Write('must never be extracted');$writer.Dispose() } finally { $zip.Dispose() }
$manifest.sha256=(Get-FileHash $malicious -Algorithm SHA256).Hash
$manifest | ConvertTo-Json | Set-Content $bad
$rejected=$false
try { & (Join-Path $PSScriptRoot 'install.ps1') -ArchivePath $malicious -ManifestPath $bad -InstallDir (Join-Path $testRoot 'unsafe-install') } catch { if ($_.Exception.Message -notmatch 'unsafe path') { throw };$rejected=$true }
if (-not $rejected -or (Test-Path (Join-Path $testRoot 'unsafe-install'))) { throw 'Path traversal rejection failed.' }
@{checksumMismatchRejected=$true;archiveTraversalRejected=$true;at=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content (Join-Path $root 'evidence/installer-check.json')
Write-Output 'PASS: checksum mismatch and archive traversal are rejected before extraction.'
