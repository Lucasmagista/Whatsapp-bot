# Script PowerShell para criar o banco, rodar migração e seed
psql -U postgres -c "CREATE DATABASE whatsapp_bot;" 2>$null
psql -U postgres -d whatsapp_bot -f database/migrations/init.sql
psql -U postgres -d whatsapp_bot -f database/seeds/init.sql
