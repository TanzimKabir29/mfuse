resource "neon_project" "mfuse" {
  name                      = "mfuse"
  region_id                 = var.neon_region_id
  org_id                    = var.neon_org_id
  history_retention_seconds = 21600 # free-tier max; provider defaults to 1 day, which exceeds it
}

resource "render_static_site" "mfuse" {
  name     = "mfuse-frontend"
  repo_url = var.github_repo_url
  branch   = "main"

  root_directory = "frontend"
  build_command  = "npm install && npm run build"
  publish_path   = "dist"

  env_vars = {
    VITE_API_BASE_URL = { value = var.backend_api_url } # baked in at build time
  }
}
