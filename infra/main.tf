resource "neon_project" "mfuse" {
  name      = "mfuse"
  region_id = var.neon_region_id
}

resource "render_web_service" "mfuse" {
  name   = "mfuse"
  plan   = "free" # Unverified against a live API call — see infra/README.md.
  region = var.render_region

  runtime_source = {
    docker = {
      repo_url        = var.github_repo_url
      branch          = "main"
      dockerfile_path = "backend/Dockerfile"
      context         = "backend"
      auto_deploy     = true
    }
  }

  env_vars = {
    # Render routes traffic to $PORT (default 10000); this just tells the
    # app itself to bind to the same port.
    SERVER_PORT          = { value = "10000" }
    DATABASE_URL         = { value = neon_project.mfuse.connection_uri }
    GOOGLE_CLIENT_ID     = { value = var.google_client_id }
    GOOGLE_CLIENT_SECRET = { value = var.google_client_secret }
    GOOGLE_REDIRECT_URL  = { value = var.google_redirect_url }
    FRONTEND_ORIGIN      = { value = var.frontend_origin }
  }
}

resource "render_static_site" "mfuse" {
  name     = "mfuse-frontend"
  repo_url = var.github_repo_url
  branch   = "main"

  root_directory = "frontend"
  build_command  = "npm install && npm run build"
  publish_path   = "dist"

  env_vars = {
    # Baked into the built JS at build time (Vite), not read at runtime.
    VITE_API_BASE_URL = { value = var.backend_api_url }
  }
}
