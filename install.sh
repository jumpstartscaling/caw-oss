#!/bin/bash
set -e

echo "======================================"
echo " CAW Framework - Bare-Metal Installer "
echo "======================================"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "[!] Node.js not found. Please install Node.js >= 22.0.0."
    exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "[!] npm not found."
    exit 1
fi

echo "[*] Node and npm are installed."

if [ ! -f .env ]; then
    echo "[*] Creating .env from .env.example..."
    cp .env.example .env
else
    echo "[*] .env already exists. Skipping..."
fi

echo "[*] Installing Node dependencies..."
npm install

echo "[*] Seeding database (Make sure PostgreSQL is running)..."
# We won't strictly enforce success of seeding if DB is not available yet,
# but we will try.
npm run db:seed || echo "[!] DB seed failed. Make sure DATABASE_URL is valid in .env and Postgres is running."

echo "======================================"
echo " Installation Complete! "
echo " Run 'npm run dev' to start the server."
echo "======================================"
