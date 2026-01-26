#!/usr/bin/env bash
# ============================================================================
# w2w.sh — Whot2Watch dev stack manager
#
# Usage:
#   ./w2w.sh start [component]   Start the stack (or a single component)
#   ./w2w.sh stop  [component]   Stop the stack (or a single component)
#   ./w2w.sh restart [component] Restart the stack (or a single component)
#   ./w2w.sh status              Show status of all services
#   ./w2w.sh logs  [component]   Tail logs for a component
#
# Components: docker | api | web | all (default)
#
# Examples:
#   ./w2w.sh start               # Start everything
#   ./w2w.sh start api            # Start only the API server
#   ./w2w.sh stop docker          # Stop only Docker containers
#   ./w2w.sh status               # Show status of all services
#   ./w2w.sh restart api          # Restart the API server
#   ./w2w.sh logs api             # Tail API server logs
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
PID_DIR="$PROJECT_DIR/.pids"
LOG_DIR="$PROJECT_DIR/.logs"

# Ports
API_PORT=4000
WEB_PORT=3000
PG_PORT=5432
REDIS_PORT=6379
OS_PORT=9200
DASH_PORT=5601

# Docker container names
PG_CONTAINER="w2w_postgres"
REDIS_CONTAINER="w2w_redis"
OS_CONTAINER="w2w_opensearch"
DASH_CONTAINER="w2w_dashboards"

# Resolve pnpm — .cmd doesn't work in git-bash, use node module directly
resolve_pnpm() {
  if command -v pnpm &>/dev/null; then
    echo "pnpm"
    return
  fi
  local pnpm_cjs
  for candidate in \
    "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs" \
    "$HOME/AppData/Roaming/npm/node_modules/pnpm/bin/pnpm.cjs" \
    "$(npm root -g 2>/dev/null)/pnpm/bin/pnpm.cjs"; do
    if [[ -f "$candidate" ]]; then
      echo "node \"$candidate\""
      return
    fi
  done
  echo "pnpm"  # fallback; will fail with a clear message if not found
}

PNPM="$(resolve_pnpm)"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[w2w]${NC} $*"; }
ok()    { echo -e "${GREEN}[w2w]${NC} $*"; }
warn()  { echo -e "${YELLOW}[w2w]${NC} $*"; }
err()   { echo -e "${RED}[w2w]${NC} $*"; }

ensure_dirs() {
  mkdir -p "$PID_DIR" "$LOG_DIR"
}

load_env() {
  local envfile="$PROJECT_DIR/.env.local"
  if [[ -f "$envfile" ]]; then
    set -a
    # shellcheck disable=SC1090
    source <(grep -v '^\s*#' "$envfile" | grep -v '^\s*$')
    set +a
  fi
  export VIRTUAL_ENV="${VIRTUAL_ENV:-$PROJECT_DIR/.venv}"
}

# Check if a port is responding
port_alive() {
  local port="$1"
  curl -s -o /dev/null --connect-timeout 1 "http://localhost:$port" 2>/dev/null
  return $?
}

# Check if a PID is still running
pid_alive() {
  local pidfile="$PID_DIR/$1.pid"
  if [[ ! -f "$pidfile" ]]; then
    return 1
  fi
  local pid
  pid=$(cat "$pidfile")
  if kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  rm -f "$pidfile"
  return 1
}

save_pid() {
  echo "$2" > "$PID_DIR/$1.pid"
}

read_pid() {
  local pidfile="$PID_DIR/$1.pid"
  if [[ -f "$pidfile" ]]; then
    cat "$pidfile"
  fi
}

# Check if a Docker container is running
container_running() {
  docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null | grep -q true
}

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------

start_docker() {
  info "Starting Docker containers..."
  cd "$PROJECT_DIR"

  if container_running "$PG_CONTAINER" && container_running "$REDIS_CONTAINER" && container_running "$OS_CONTAINER"; then
    ok "Docker containers already running"
    return
  fi

  docker compose up -d 2>&1
  ok "Docker containers started"

  # Wait for services to be ready
  info "Waiting for PostgreSQL..."
  for i in $(seq 1 30); do
    if docker exec "$PG_CONTAINER" pg_isready -U w2w &>/dev/null; then
      ok "PostgreSQL ready"
      break
    fi
    sleep 1
    if [[ $i -eq 30 ]]; then warn "PostgreSQL may not be ready yet"; fi
  done

  info "Waiting for Redis..."
  for i in $(seq 1 15); do
    if docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null | grep -q PONG; then
      ok "Redis ready"
      break
    fi
    sleep 1
    if [[ $i -eq 15 ]]; then warn "Redis may not be ready yet"; fi
  done

  info "Waiting for OpenSearch..."
  for i in $(seq 1 45); do
    if curl -s "http://localhost:$OS_PORT" &>/dev/null; then
      ok "OpenSearch ready"
      break
    fi
    sleep 2
    if [[ $i -eq 45 ]]; then warn "OpenSearch may not be ready yet"; fi
  done
}

stop_docker() {
  info "Stopping Docker containers..."
  cd "$PROJECT_DIR"
  docker compose down 2>&1
  ok "Docker containers stopped"
}

# ---------------------------------------------------------------------------
# API Server
# ---------------------------------------------------------------------------

start_api() {
  if pid_alive api; then
    ok "API server already running (PID $(read_pid api))"
    return
  fi

  info "Starting API server on port $API_PORT..."
  cd "$PROJECT_DIR"
  load_env

  eval $PNPM exec tsx -r ./scripts/load-env.cjs server/api.ts \
    > "$LOG_DIR/api.log" 2>&1 &
  local pid=$!
  save_pid api "$pid"

  # Wait for it to be ready
  for i in $(seq 1 20); do
    if port_alive "$API_PORT"; then
      ok "API server started (PID $pid) on http://localhost:$API_PORT"
      return
    fi
    sleep 1
  done
  warn "API server started (PID $pid) but port $API_PORT not yet responding — check $LOG_DIR/api.log"
}

stop_api() {
  if pid_alive api; then
    local pid
    pid=$(read_pid api)
    info "Stopping API server (PID $pid)..."
    kill "$pid" 2>/dev/null || true
    rm -f "$PID_DIR/api.pid"
    ok "API server stopped"
  else
    # Try to kill anything on the port
    if port_alive "$API_PORT"; then
      warn "No tracked PID, but port $API_PORT is in use — attempting cleanup"
      if command -v npx &>/dev/null; then
        npx --yes kill-port "$API_PORT" 2>/dev/null || true
      fi
    else
      info "API server is not running"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Web (Next.js)
# ---------------------------------------------------------------------------

start_web() {
  if pid_alive web; then
    ok "Web server already running (PID $(read_pid web))"
    return
  fi

  info "Starting Next.js on port $WEB_PORT..."
  cd "$PROJECT_DIR"
  load_env

  PORT=$WEB_PORT eval $PNPM --filter web dev \
    > "$LOG_DIR/web.log" 2>&1 &
  local pid=$!
  save_pid web "$pid"

  for i in $(seq 1 60); do
    if port_alive "$WEB_PORT"; then
      ok "Web server started (PID $pid) on http://localhost:$WEB_PORT"
      return
    fi
    sleep 1
  done
  warn "Web server started (PID $pid) but port $WEB_PORT not yet responding — check $LOG_DIR/web.log"
}

stop_web() {
  if pid_alive web; then
    local pid
    pid=$(read_pid web)
    info "Stopping web server (PID $pid)..."
    kill "$pid" 2>/dev/null || true
    rm -f "$PID_DIR/web.pid"
    ok "Web server stopped"
  else
    if port_alive "$WEB_PORT"; then
      warn "No tracked PID, but port $WEB_PORT is in use — attempting cleanup"
      if command -v npx &>/dev/null; then
        npx --yes kill-port "$WEB_PORT" 2>/dev/null || true
      fi
    else
      info "Web server is not running"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

print_status() {
  echo ""
  echo -e "${BOLD}Whot2Watch Stack Status${NC}"
  echo "========================================"

  # Docker containers
  echo ""
  echo -e "${BOLD}Docker Containers${NC}"
  printf "  %-22s %-10s %s\n" "SERVICE" "STATUS" "PORT"
  echo "  ----------------------------------------"

  for pair in \
    "$PG_CONTAINER:PostgreSQL:$PG_PORT" \
    "$REDIS_CONTAINER:Redis:$REDIS_PORT" \
    "$OS_CONTAINER:OpenSearch:$OS_PORT" \
    "$DASH_CONTAINER:Dashboards:$DASH_PORT"; do

    IFS=':' read -r container label port <<< "$pair"
    if container_running "$container"; then
      printf "  %-22s ${GREEN}%-10s${NC} %s\n" "$label" "running" ":$port"
    else
      printf "  %-22s ${RED}%-10s${NC} %s\n" "$label" "stopped" ":$port"
    fi
  done

  # Application servers
  echo ""
  echo -e "${BOLD}Application Servers${NC}"
  printf "  %-22s %-10s %-8s %s\n" "SERVICE" "STATUS" "PID" "URL"
  echo "  -------------------------------------------------------"

  # API
  local api_status="stopped" api_pid="-" api_url=""
  if pid_alive api; then
    api_pid="$(read_pid api)"
    if port_alive "$API_PORT"; then
      api_status="running"
      api_url="http://localhost:$API_PORT"
    else
      api_status="starting"
    fi
  elif port_alive "$API_PORT"; then
    api_status="running*"
    api_url="http://localhost:$API_PORT"
  fi
  if [[ "$api_status" == "running" || "$api_status" == "running*" ]]; then
    printf "  %-22s ${GREEN}%-10s${NC} %-8s %s\n" "API (Fastify)" "$api_status" "$api_pid" "$api_url"
  else
    printf "  %-22s ${RED}%-10s${NC} %-8s %s\n" "API (Fastify)" "$api_status" "$api_pid" "$api_url"
  fi

  # Web
  local web_status="stopped" web_pid="-" web_url=""
  if pid_alive web; then
    web_pid="$(read_pid web)"
    if port_alive "$WEB_PORT"; then
      web_status="running"
      web_url="http://localhost:$WEB_PORT"
    else
      web_status="starting"
    fi
  elif port_alive "$WEB_PORT"; then
    web_status="running*"
    web_url="http://localhost:$WEB_PORT"
  fi
  if [[ "$web_status" == "running" || "$web_status" == "running*" ]]; then
    printf "  %-22s ${GREEN}%-10s${NC} %-8s %s\n" "Web (Next.js)" "$web_status" "$web_pid" "$web_url"
  else
    printf "  %-22s ${RED}%-10s${NC} %-8s %s\n" "Web (Next.js)" "$web_status" "$web_pid" "$web_url"
  fi

  # Feature flags
  echo ""
  echo -e "${BOLD}Feature Flags${NC}"
  load_env 2>/dev/null || true
  printf "  AI_CONCIERGE_ENABLED = %s\n" "${AI_CONCIERGE_ENABLED:-not set}"
  printf "  LLM_PROVIDER         = %s\n" "${LLM_PROVIDER:-not set}"

  # Chat API health (only if API is running)
  if port_alive "$API_PORT"; then
    local health
    health=$(curl -s -H "Accept: application/json" "http://localhost:$API_PORT/v1/chat/health" 2>/dev/null || echo "")
    # Only display if response looks like JSON (not an HTML page)
    if [[ -n "$health" && "$health" == "{"* ]]; then
      echo ""
      echo -e "${BOLD}Chat API${NC}"
      printf "  Health: %s\n" "$health"
    fi
  fi

  echo ""
  echo -e "  * ${YELLOW}running*${NC} = port responds but PID not tracked by this script"
  echo ""
}

# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------

show_logs() {
  local component="${1:-api}"
  local logfile="$LOG_DIR/$component.log"
  if [[ ! -f "$logfile" ]]; then
    err "No log file found at $logfile"
    return 1
  fi
  info "Tailing $logfile (Ctrl+C to stop)..."
  tail -f "$logfile"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

usage() {
  echo "Usage: $0 {start|stop|restart|status|logs} [docker|api|web|all]"
  echo ""
  echo "Commands:"
  echo "  start   [component]   Start services (default: all)"
  echo "  stop    [component]   Stop services (default: all)"
  echo "  restart [component]   Restart services (default: all)"
  echo "  status                Show status of all services"
  echo "  logs    [component]   Tail logs (api or web)"
  echo ""
  echo "Components:"
  echo "  all      Docker + API + Web (default)"
  echo "  docker   Docker containers only"
  echo "  api      API server only"
  echo "  web      Next.js frontend only"
}

main() {
  ensure_dirs

  local cmd="${1:-}"
  local component="${2:-all}"

  case "$cmd" in
    start)
      case "$component" in
        all)
          start_docker
          start_api
          start_web
          echo ""
          print_status
          ;;
        docker) start_docker ;;
        api)    load_env; start_api ;;
        web)    load_env; start_web ;;
        *)      err "Unknown component: $component"; usage; exit 1 ;;
      esac
      ;;
    stop)
      case "$component" in
        all)
          stop_web
          stop_api
          stop_docker
          ;;
        docker) stop_docker ;;
        api)    stop_api ;;
        web)    stop_web ;;
        *)      err "Unknown component: $component"; usage; exit 1 ;;
      esac
      ;;
    restart)
      case "$component" in
        all)
          stop_web; stop_api; stop_docker
          sleep 2
          start_docker; start_api; start_web
          echo ""
          print_status
          ;;
        docker) stop_docker; sleep 2; start_docker ;;
        api)    stop_api; sleep 1; load_env; start_api ;;
        web)    stop_web; sleep 1; load_env; start_web ;;
        *)      err "Unknown component: $component"; usage; exit 1 ;;
      esac
      ;;
    status)
      print_status
      ;;
    logs)
      show_logs "$component"
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      err "Unknown command: $cmd"
      usage
      exit 1
      ;;
  esac
}

main "$@"
