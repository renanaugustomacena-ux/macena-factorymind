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
variable "database_url" {
  type      = string
  sensitive = true
}
variable "influx_url" {
  type    = string
  default = ""
}
variable "tags" {
  type    = map(string)
  default = {}
}

# R-RDS-KMS-001 (F-HIGH-003): customer-managed KMS CMK used by both the
# Secrets Manager bundle and (passed through `kms_key_arn` output to
# the db module) Aurora at-rest encryption. The same key wraps both
# surfaces so the rotation cadence stays single-pane: one annual
# rotation, one IAM key policy to review.
data "aws_caller_identity" "current" {}

resource "aws_kms_key" "factorymind" {
  description             = "FactoryMind CMK — RDS at-rest + Secrets Manager"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = false
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnableRootIAM"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowRDSToUseTheKey"
        Effect    = "Allow"
        Principal = { Service = "rds.amazonaws.com" }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid       = "AllowSecretsManagerToUseTheKey"
        Effect    = "Allow"
        Principal = { Service = "secretsmanager.amazonaws.com" }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })
  tags = var.tags
}

resource "aws_kms_alias" "factorymind" {
  name          = "alias/${var.project_name}-${var.environment}"
  target_key_id = aws_kms_key.factorymind.key_id
}

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
  kms_key_id  = aws_kms_key.factorymind.arn
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
output "kms_key_arn" { value = aws_kms_key.factorymind.arn }
output "kms_key_alias" { value = aws_kms_alias.factorymind.name }
