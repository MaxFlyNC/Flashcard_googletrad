#!/bin/bash
# ── Setup FlashCardTrad sur VPS OVH ──────────────────────────────────────────
# Compatible : Ubuntu 22.04 / 24.04, Debian 12
#
# Usage :
#   chmod +x scripts/setup.sh
#   sudo ./scripts/setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERREUR]${NC} $1"; exit 1; }

# ── Vérifications préalables ──────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Ce script doit être lancé en root : sudo ./scripts/setup.sh"
[[ ! -f ".env" ]] && error "Fichier .env manquant. Faites : cp .env.example .env && nano .env"

source .env
[[ -z "$DOMAIN" ]]         && error "DOMAIN non défini dans .env"
[[ -z "$CERTBOT_EMAIL" ]]  && error "CERTBOT_EMAIL non défini dans .env"
[[ -z "$N8N_PASSWORD" ]]   && error "N8N_PASSWORD non défini dans .env"
[[ "$N8N_PASSWORD" == "changez_ce_mot_de_passe_fort_ici" ]] && \
  error "Changez N8N_PASSWORD dans .env avant de continuer"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     FlashCardTrad — Installation OVH         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""
info "Domaine  : $DOMAIN"
info "Email    : $CERTBOT_EMAIL"
info "Timezone : ${TIMEZONE:-Europe/Paris}"
echo ""

# ── 1. Mise à jour système ────────────────────────────────────────────────────
info "Mise à jour du système..."
apt-get update -qq && apt-get upgrade -y -qq
success "Système mis à jour"

# ── 2. Installation Docker ────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  info "Installation de Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  success "Docker installé"
else
  success "Docker déjà installé ($(docker --version))"
fi

# ── 3. Installation Docker Compose plugin ────────────────────────────────────
if ! docker compose version &> /dev/null; then
  info "Installation de Docker Compose..."
  apt-get install -y -qq docker-compose-plugin
  success "Docker Compose installé"
else
  success "Docker Compose déjà installé"
fi

# ── 4. Pare-feu UFW ───────────────────────────────────────────────────────────
if command -v ufw &> /dev/null; then
  info "Configuration du pare-feu..."
  ufw allow 22/tcp   comment "SSH"    > /dev/null
  ufw allow 80/tcp   comment "HTTP"   > /dev/null
  ufw allow 443/tcp  comment "HTTPS"  > /dev/null
  ufw --force enable > /dev/null
  success "Pare-feu configuré (22, 80, 443)"
fi

# ── 5. Certificat SSL Let's Encrypt (initial) ─────────────────────────────────
info "Génération du certificat SSL pour $DOMAIN..."

# Nginx temporaire pour la vérification ACME
docker run -d --name nginx-temp \
  -p 80:80 \
  -v "$(pwd)/docker/certbot-webroot:/var/www/certbot" \
  nginx:alpine \
  sh -c "mkdir -p /var/www/certbot && nginx -g 'daemon off;'" 2>/dev/null || true

sleep 2

docker run --rm \
  -v "$(pwd)/docker/certbot-certs:/etc/letsencrypt" \
  -v "$(pwd)/docker/certbot-webroot:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  -d "$DOMAIN" && success "Certificat SSL généré" || warn "SSL échoué — vérifiez que $DOMAIN pointe vers ce serveur"

docker stop nginx-temp 2>/dev/null && docker rm nginx-temp 2>/dev/null || true

# ── 6. Démarrage de la stack ──────────────────────────────────────────────────
info "Démarrage de la stack Docker..."
docker compose pull --quiet
docker compose up -d --build
success "Tous les conteneurs démarrés"

# ── 7. Vérification ───────────────────────────────────────────────────────────
echo ""
info "Vérification des conteneurs..."
sleep 5
docker compose ps

# ── Résumé ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Installation terminée !              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}FlashCardTrad${NC} → https://$DOMAIN"
echo -e "  ${GREEN}n8n workflows${NC} → https://$DOMAIN/n8n/"
echo -e "                   Utilisateur : ${N8N_USER:-admin}"
echo ""
echo -e "  Logs en direct : ${BLUE}docker compose logs -f${NC}"
echo -e "  Arrêter        : ${BLUE}docker compose down${NC}"
echo -e "  Mettre à jour  : ${BLUE}git pull && docker compose up -d --build${NC}"
echo ""
echo -e "${BLUE}── Ajouter un autre projet ───────────────────────${NC}"
echo -e "  sudo ./scripts/add-project.sh <domaine> <conteneur:port>"
echo -e "  Exemple : ${BLUE}sudo ./scripts/add-project.sh monapp.com monapp:3000${NC}"
echo ""
