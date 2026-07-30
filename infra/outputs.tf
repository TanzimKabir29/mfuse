output "backend_url" {
  description = "The Render web service's public URL."
  value       = render_web_service.mfuse.url
}

output "frontend_url" {
  description = "The Render static site's public URL."
  value       = render_static_site.mfuse.url
}

output "database_connection_uri" {
  description = "Neon Postgres connection string."
  value       = neon_project.mfuse.connection_uri
  sensitive   = true
}
