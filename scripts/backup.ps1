#!/usr/bin/env pwsh
# Script de backup automático para banco de dados PostgreSQL e arquivos

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = "./backups/$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir

# Backup do banco de dados PostgreSQL
$pgDumpPath = "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
$env:PGPASSWORD = $env:DB_PASS
& $pgDumpPath -h $env:DB_HOST -U $env:DB_USER -d $env:DB_NAME -F c -b -v -f "$backupDir/db.backup"

# Backup dos arquivos importantes
Copy-Item -Path "./storage/media/*" -Destination "$backupDir/media" -Recurse -Force
Copy-Item -Path "./storage/logs/*" -Destination "$backupDir/logs" -Recurse -Force
Copy-Item -Path "./storage/sessions/*" -Destination "$backupDir/sessions" -Recurse -Force

Write-Host "Backup realizado em $backupDir"
