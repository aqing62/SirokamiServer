$ErrorActionPreference = 'Stop'

$scriptDir = $PSScriptRoot
$outputFile = Join-Path $scriptDir 'decks_data.json'
$configFile = Join-Path $scriptDir 'tournament_names.json'

# Read tournament name config
$tournamentNames = @{ }
if (Test-Path $configFile) {
    $config = Get-Content $configFile -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($prop in $config.PSObject.Properties) {
        $tournamentNames[$prop.Name] = $prop.Value
    }
}

$fullWidthColon = [char]0xFF1A
$tournaments = @()

Get-ChildItem $scriptDir -Directory | Sort-Object Name | ForEach-Object {
    $folder = $_.Name
    $tName = if ($tournamentNames.ContainsKey($folder)) {
        $tournamentNames[$folder]
    } else {
        "SaiShi $folder"
    }

    $decks = @()
    Get-ChildItem $_.FullName -Filter '*.ydk' -File | Sort-Object Name | ForEach-Object {
        $file = $_.Name
        $displayName = [System.IO.Path]::GetFileNameWithoutExtension($file)

        $parts = $displayName -split $fullWidthColon, 2
        if ($parts.Count -eq 2) {
            $player   = $parts[0].Trim()
            $deckName = $parts[1].Trim()
        } else {
            $player   = $displayName.Trim()
            $deckName = ''
        }

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
            file        = $file
            displayName = $displayName
            player      = $player
            deckName    = $deckName
            main        = @($main)
            extra       = @($extra)
            side        = @($side)
        }
    }

    $tournaments += @{
        folder = $folder
        name   = $tName
        decks  = @($decks)
    }
}

$result = @{ tournaments = @($tournaments) }
$json = $result | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($outputFile, $json, [System.Text.UTF8Encoding]::new($false))

$totalDecks = ($tournaments | ForEach-Object { $_.decks.Count } | Measure-Object -Sum).Sum
Write-Host 'Done:' $tournaments.Count 'tournaments,' $totalDecks 'decks'
