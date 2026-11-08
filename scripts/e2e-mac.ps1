<#
  Тесты экранов (Playwright) на Mac mini: там 15 ядер, ноутбук не тормозит.
  npm run e2e:mac [-- <аргументы playwright test>]   например: npm run e2e:mac -- e2e/drill.e2e.ts -g "庚"

  1. Снимок рабочего дерева (с незакоммиченными правками) — отдельным коммитом через временный индекс:
     ваш индекс и ветка не меняются.
  2. git push снимка на мак (ssh-алиас macmini, клон ~/work/bazi-trainer) в ref refs/e2e/snapshot.
  3. На маке: checkout снимка, npm ci --ignore-scripts при смене package-lock (sharp для иконок тестам не нужен),
     npx playwright test с переданными аргументами.
  4. Отчёт забирается в playwright-report-mac/ (и test-results-mac/ при провале); код выхода — как у прогона.
#>
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$PwArgs)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$remoteDir = 'work/bazi-trainer'

# 1. Снимок рабочего дерева
$index = Join-Path ([IO.Path]::GetTempPath()) "bazi-e2e-index-$PID"
try {
  $env:GIT_INDEX_FILE = $index
  git read-tree HEAD
  # Предупреждения про CRLF при добавлении не нужны
  git add -A 2>$null
  $tree = git write-tree
  $commit = git commit-tree $tree -p HEAD -m 'e2e snapshot'
} finally {
  Remove-Item Env:GIT_INDEX_FILE
  Remove-Item $index -ErrorAction SilentlyContinue
}
Write-Host "Снимок $($commit.Substring(0, 8)) → macmini"

# 2. На мак
git push --force --quiet "macmini:$remoteDir" "${commit}:refs/e2e/snapshot"
if ($LASTEXITCODE) { throw 'git push на мак не прошёл: проверьте ssh macmini' }

# 3. Прогон на маке
$quoted = ($PwArgs | ForEach-Object { "'" + ($_ -replace "'", "'\''") + "'" }) -join ' '
$remote = @(
  'set -e'
  "cd ~/$remoteDir"
  "git checkout --quiet --force --detach $commit"
  'lock=$(shasum package-lock.json | cut -c1-40)'
  'if [ "$(cat node_modules/.e2e-lock 2>/dev/null)" != "$lock" ]; then npm ci --ignore-scripts --no-audit --no-fund --loglevel=error && echo "$lock" > node_modules/.e2e-lock; fi'
  'rm -rf playwright-report test-results'
  'set +e'
  "npx playwright test $quoted"
  'code=$?'
  'echo "E2E_EXIT=$code"'
  'exit $code'
) -join "`n"
# Последняя строка тоже с переводом строки: иначе PowerShell допишет к ней CR и bash не поймёт exit
"$remote`n" | ssh macmini 'zsh -lic "bash -s"'
$code = $LASTEXITCODE

# 4. Отчёт обратно
Remove-Item -Recurse -Force playwright-report-mac, test-results-mac -ErrorAction SilentlyContinue
scp -q -r "macmini:$remoteDir/playwright-report" playwright-report-mac 2>$null
if ($code) { scp -q -r "macmini:$remoteDir/test-results" test-results-mac 2>$null }
Write-Host "Отчёт: npx playwright show-report playwright-report-mac"
exit $code
