terraform {
  required_version = ">= 1.5"

  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.8"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.14"
    }
  }

  # Local state by default — see README.md's "Remote state" section.
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "mfuse/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "render" {
  api_key  = var.render_api_key
  owner_id = var.render_owner_id
}

provider "neon" {
  api_key = var.neon_api_key
}
