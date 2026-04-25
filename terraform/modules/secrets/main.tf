##########################################################################
# FactoryMind — Secrets Manager bundle.
##########################################################################

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.70" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

variable "project_name" { type = string }
variable "environment" { type = string }
variable "database_url" { type = string, sensitive = true }
variable "influx_url" { type = string, default = "" }
variable "tags" { type = map(string), default = {} }

resource "random_password" "jwt" {
  length  = 64
  special = true
}

resource "random_password" "jwt_refresh" {
  length  = 64
  special = true
}

resource "aws_secretsmanager_secret" "this" {
  name        = "${var.project_name}/${var.environment}"
  description = "Consolidated FactoryMind runtime secret bundle"
  tags        = var.tags
  # Rotate yearly; operator can manually trigger sooner.
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "this" {
  secret_id = aws_secretsmanager_secret.this.id
  secret_string = jsonencode({
    DATABASE_URL       = var.database_url
    INFLUX_URL         = var.influx_url
    INFLUX_TOKEN       = "" # populate via external flow
    JWT_SECRET         = random_password.jwt.result
    JWT_REFRESH_SECRET = random_password.jwt_refresh.result
  })
}

output "secret_arn" { value = aws_secretsmanager_secret.this.arn }
