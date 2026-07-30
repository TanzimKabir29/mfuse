variable "render_api_key" {
  description = "Render API key (Render dashboard -> Account Settings -> API Keys)."
  type        = string
  sensitive   = true
}

variable "render_owner_id" {
  description = "Render workspace/owner ID (visible in the dashboard URL, or via `render workspace list` with their CLI)."
  type        = string
}

variable "render_region" {
  description = "Render region for the web service. One of frankfurt, ohio, oregon, singapore, virginia."
  type        = string
  default     = "oregon"
}

variable "github_repo_url" {
  description = <<-EOT
    HTTPS URL of this repo, e.g. https://github.com/you/mfuse. Render needs
    its GitHub App connected to your account/repo first (dashboard -> Account
    Settings -> GitHub) before it can clone and build from it.
  EOT
  type        = string
}

variable "neon_api_key" {
  description = "Neon API key (Neon console -> Account Settings -> API Keys)."
  type        = string
  sensitive   = true
}

variable "neon_region_id" {
  description = "Neon region ID for the database. Check Neon's current region list before applying."
  type        = string
  default     = "aws-us-east-2"
}

variable "google_client_id" {
  description = "Google OAuth client ID (the one already created for local dev)."
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret."
  type        = string
  sensitive   = true
}

# The next three variables can't be known before the first apply — Render
# assigns each service's URL only once it exists, and the backend's OAuth
# redirect URL and the frontend's CORS/API-base config all depend on those
# URLs existing first. Bootstrap order:
#   1. Leave all three blank and `terraform apply`.
#   2. Read `backend_url` and `frontend_url` from the outputs.
#   3. Register `<backend_url>/v1/auth/google/callback` as an Authorized
#      redirect URI on the OAuth client in Google Cloud Console.
#   4. Fill in all three variables below to match, and `terraform apply` again.
variable "google_redirect_url" {
  description = "Full OAuth callback URL, e.g. https://mfuse.onrender.com/v1/auth/google/callback."
  type        = string
  default     = ""
}

variable "frontend_origin" {
  description = "The frontend's URL, e.g. https://mfuse-frontend.onrender.com — used for the backend's CORS check."
  type        = string
  default     = ""
}

variable "backend_api_url" {
  description = "The backend's URL, e.g. https://mfuse.onrender.com — baked into the frontend build as VITE_API_BASE_URL."
  type        = string
  default     = ""
}
