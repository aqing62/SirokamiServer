$ErrorActionPreference = 'Stop'

$scriptDir = $PSScriptRoot
$sourceDir = Join-Path $scriptDir 'chronicle'
$outputFile = Join-Path $scriptDir 'chronicle_decks.json'

if (-not (Test-Path $sourceDir)) {
    Write-Host "错误: 未找到卡组目录 $sourceDir"
    exit 1
}

$decks = @()
Get-ChildItem $sourceDir -Filter '*.ydk' -File | Sort-Object Name | ForEach-Object {
    $name = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
    $main  = @()
    $extra = @()
    $side  = @()
    $sec   = ''

    Get-Content $_.FullName -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq '#main')  { $sec = 'main';  return }
        if ($line -eq '#extra') { $sec = 'extra'; return }
        if ($line -eq '!side')  { $sec = 'side';  return }
        if ($line -match '^\d+$' -and $sec) {
            $id = [int]$line
            switch ($sec) {
                'main'  { $main  += $id }
                'extra' { $extra += $id }
                'side'  { $side  += $id }
            }
        }
    }

    $decks += @{
        name  = $name
        main  = @($main)
        extra = @($extra)
        side  = @($side)
    }
}

$result = @{ decks = @($decks) }
$json = $result | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($outputFile, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Done:' $decks.Count 'chronicle decks ->' $outputFile

# 刷新前端版本号，避免浏览器缓存旧 JSON
$jsPath = Join-Path (Split-Path $scriptDir -Parent) 'js\chronicle-decks.js'
if (Test-Path $jsPath) {
    $js = Get-Content $jsPath -Raw -Encoding UTF8
    $stamp = Get-Date -Format 'yyyyMMddHHmm'
    $js = [regex]::Replace($js, 'chronicle_decks\.json\?v=\d+', "chronicle_decks.json?v=$stamp")
    [System.IO.File]::WriteAllText($jsPath, $js, [System.Text.UTF8Encoding]::new($false))
    Write-Host "前端版本号已刷新: v=$stamp -> $jsPath"
} else {
    Write-Host "警告: 未找到 $jsPath，请手动刷新版本号"
}
