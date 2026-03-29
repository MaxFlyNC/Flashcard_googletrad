#!/bin/bash
# ── Ajouter un nouveau projet au serveur OVH ─────────────────────────────────
# Compatible : Ubuntu 22.04 / 24.04, Debian 12
#
# Usage :
#   sudo ./scripts/add-project.sh <domaine> <conteneur:port>
#
# Exemples :
#   sudo ./scripts/add-project.sh monapp.example.com monapp:3000
#   sudo ./scripts/add-project.sh api.example.com monapi:8080
#
# Prérequis :
#   - Le domaine DNS pointe déjà vers l'IP de ce serveur
#   - Le conteneur Docker du projet est en cours d'exécution sur le réseau app-network
#   - La stack FlashCardTrad est démarrée (docker compose up -d)
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

# ── Arguments ─────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Ce script doit être lancé en root : sudo ./scripts/add-project.sh"
[[ $# -lt 2 ]]    && error "Usage : sudo ./scripts/add-project.sh <domaine> <conteneur:port>"

DOMAIN="$1"
TARGET="$2"   # ex: monapp:3000

# Extraire le nom du conteneur (avant :) pour nommer le fichier de conf
PROJECT_NAME="${TARGET%%:*}"
CONF_FILE="$(pwd)/docker/nginx/conf.d/${PROJECT_NAME}.conf"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Ajout d'un nouveau projet                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""
info "Domaine   : $DOMAIN"
info "Cible     : http://$TARGET"
info "Conf Nginx: $CONF_FILE"
echo ""

# ── Vérification : domaine joignable ─────────────────────────────────────────
if ! curl -s --connect-timeout 5 "http://$DOMAIN/.well-known/acme-challenge/test" > /dev/null 2>&1; then
    warn "Le domaine $DOMAIN ne semble pas pointer vers ce serveur."
    warn "Vérifiez votre DNS avant de continuer (propagation DNS peut prendre jusqu'à 24h)."
    read -p "Continuer quand même ? (y/N) " -n 1 -r
    echo ""
    [[ ! $REPLY =~ ^[Yy]$ ]] && error "Annulé."
fi

# ── 1. Générer le fichier de configuration Nginx ──────────────────────────────
info "Génération de la configuration Nginx..."

cat > "$CONF_FILE" << EOF
# ── ${PROJECT_NAME} ── généré par add-project.sh le $(date '+%Y-%m-%d') ──────────────────────
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/nginx/snippets/ssl-params.conf;

    location / {
        proxy_pass  http://${TARGET};
        include     /etc/nginx/snippets/proxy-params.conf;
    }
}
EOF

success "Fichier $CONF_FILE créé"

# ── 2. Certificat SSL Let's Encrypt ───────────────────────────────────────────
info "Génération du certificat SSL pour $DOMAIN..."

# Le conteneur certbot partage le webroot avec nginx — on utilise le conteneur existant
if docker ps --format '{{.Names}}' | grep -q '^certbot$'; then
    docker exec certbot certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        --non-interactive \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        && success "Certificat SSL généré" \
        || { warn "Certbot via conteneur a échoué — tentative directe..."; SSL_FALLBACK=1; }
fi

if [[ "${SSL_FALLBACK}" == "1" ]]; then
    # Fallback : certbot installé en local
    if command -v certbot &> /dev/null; then
        certbot certonly \
            --webroot \
            --webroot-path "$(pwd)/docker/certbot-webroot" \
            --non-interactive \
            --agree-tos \
            --no-eff-email \
            -d "$DOMAIN" \
            && success "Certificat SSL généré (local)" \
            || error "Impossible de générer le certificat SSL pour $DOMAIN"
    else
        error "Certbot non disponible. Installez-le : apt install certbot"
    fi
fi

# ── 3. Tester et recharger Nginx ──────────────────────────────────────────────
info "Test de la configuration Nginx..."
docker exec nginx nginx -t \
    && success "Configuration Nginx valide" \
    || error "Configuration Nginx invalide — vérifiez $CONF_FILE"

info "Rechargement de Nginx..."
docker exec nginx nginx -s reload
success "Nginx rechargé"

# ── Résumé ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Projet ajouté avec succès !          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}${PROJECT_NAME}${NC} → https://${DOMAIN}"
echo ""
echo -e "  Conf Nginx : ${BLUE}${CONF_FILE}${NC}"
echo -e "  Supprimer  : ${BLUE}rm ${CONF_FILE} && docker exec nginx nginx -s reload${NC}"
echo ""
echo -e "  Assurez-vous que le conteneur '${PROJECT_NAME}' est connecté au réseau app-network :"
echo -e "  ${BLUE}docker network connect app-network ${PROJECT_NAME}${NC}"
echo ""
