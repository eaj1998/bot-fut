$ErrorActionPreference = "Stop"

# Carregar variáveis do .env (um nível acima)
Get-Content "..\.env" | ForEach-Object {
    if ($_ -match '^\s*#') { return }      # ignora comentários
    if ($_ -match '^\s*$') { return }      # ignora linhas vazias

    $name, $value = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim())
}

# Executa dump e restore em pipeline
& 'C:\Program Files\MongoDB\Tools\100\bin\mongodump' `
    --uri "$env:MONGO_SRC_URI" `
    --db "$env:SRC_DB" `
    --archive | `
    & 'C:\Program Files\MongoDB\Tools\100\bin\mongorestore' `
    --uri "$env:MONGO_DEST_URI" `
    --archive `
    --drop `
    --nsFrom "$($env:SRC_DB).*" `
    --nsTo "$($env:DEST_DB).*"
