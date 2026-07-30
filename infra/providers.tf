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

  # Local state is fine to start with. Once you've created a GCS or S3 bucket
  # for state (a one-time step — Terraform can't create the very bucket it
  # would store its own state in), uncomment a backend block here and run
  # `terraform init -migrate-state` to move state there instead of your disk.
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
