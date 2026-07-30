variable "render_api_key" {
  description = "Render API key."
  type        = string
  sensitive   = true
}

variable "render_owner_id" {
  description = "Render workspace/owner ID."
  type        = string
}

variable "github_repo_url" {
  description = "HTTPS URL of this repo, e.g. https://github.com/you/mfuse."
  type        = string
}

variable "neon_api_key" {
  description = "Neon API key."
  type        = string
  sensitive   = true
}

variable "neon_org_id" {
  description = "Neon organization ID."
  type        = string
}

variable "neon_region_id" {
  description = "Neon region ID."
  type        = string
  default     = "aws-us-east-2"
}

# The backend isn't Terraform-managed — see README.md. This is the manually
# created Render service's URL, baked into the frontend build once known.
variable "backend_api_url" {
  description = "The backend's URL, e.g. https://mfuse.onrender.com."
  type        = string
  default     = ""
}
