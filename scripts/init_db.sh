#!/bin/bash
# Script para rodar migração e seed do banco
psql -U postgres -d whatsapp_bot -f database/migrations/init.sql
psql -U postgres -d whatsapp_bot -f database/seeds/init.sql
