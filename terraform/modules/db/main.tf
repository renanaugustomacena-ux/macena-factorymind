##########################################################################
# FactoryMind — Aurora PostgreSQL Serverless v2 module.
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
variable "private_subnet_ids" { type = list(string) }
variable "vpc_id" { type = string }
variable "vpc_cidr" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "engine_version" {
  type    = string
  default = "16.4"
}

# R-RDS-KMS-001 (F-HIGH-003): customer-managed CMK for RDS at-rest
# encryption replaces the default `aws/rds` AWS-managed key. The
# customer can rotate independently, can revoke FactoryMind's access
# without involving AWS Support, and satisfies ISO 27001 A.10 /
# PCI-DSS 3.5 separation-of-duties controls. Set
# `kms_key_arn = null` to fall back to the AWS-managed key (NOT
# recommended in production but kept as escape hatch for dev).
variable "kms_key_arn" {
  type        = string
  default     = null
  description = "Customer-managed KMS key ARN for RDS encryption-at-rest. Null falls back to aws/rds (default key)."
}

resource "random_password" "postgres" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.project_name}-pg-subnet-${var.environment}"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}

# R-RDS-EGRESS-001 (F-HIGH-004): replace 0.0.0.0/0 egress with the
# specific destinations the RDS engine actually needs. Aurora Postgres
# initiates outbound connections to:
#   - DNS (53/udp + tcp) for hostname resolution.
#   - AWS regional service endpoints (S3 backups, KMS unwrap, CloudWatch
#     metrics + logs) over 443/tcp; the prefix lists below cover them.
# A compromised pg_extension reaching attacker-controlled hosts is
# blocked at the SG layer; defence-in-depth alongside the IAM policies
# applied to the cluster.
data "aws_prefix_list" "s3" {
  name = "com.amazonaws.${data.aws_region.current.name}.s3"
}

# Managed prefix list for AWS regional services. Available since
# 2024 in all regions FactoryMind targets (eu-south-1, eu-west-1,
# eu-central-1).
data "aws_ec2_managed_prefix_list" "kms" {
  name = "com.amazonaws.${data.aws_region.current.name}.kms"
}

data "aws_ec2_managed_prefix_list" "cloudwatch_logs" {
  name = "com.amazonaws.${data.aws_region.current.name}.logs"
}

data "aws_ec2_managed_prefix_list" "cloudwatch_monitoring" {
  name = "com.amazonaws.${data.aws_region.current.name}.monitoring"
}

data "aws_region" "current" {}

resource "aws_security_group" "pg" {
  name        = "${var.project_name}-pg-sg-${var.environment}"
  description = "Postgres access — intra-VPC ingress, scoped egress"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Intra-VPC only"
  }

  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = [var.vpc_cidr]
    description = "DNS (UDP) inside VPC (resolver)"
  }
  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "DNS (TCP) inside VPC (resolver)"
  }

  egress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    prefix_list_ids = [data.aws_prefix_list.s3.id]
    description     = "S3 backups via gateway endpoint"
  }
  egress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.kms.id]
    description     = "KMS unwrap for at-rest encryption"
  }
  egress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudwatch_logs.id]
    description     = "CloudWatch Logs for engine logs export"
  }
  egress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudwatch_monitoring.id]
    description     = "CloudWatch Metrics for cluster telemetry"
  }

  tags = var.tags
}

resource "aws_rds_cluster" "this" {
  cluster_identifier              = "${var.project_name}-${var.environment}"
  engine                          = "aurora-postgresql"
  engine_mode                     = "provisioned"
  engine_version                  = var.engine_version
  database_name                   = "factorymind"
  master_username                 = "factorymind"
  master_password                 = random_password.postgres.result
  storage_encrypted               = true
  kms_key_id                      = var.kms_key_arn # null → aws/rds default
  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = [aws_security_group.pg.id]
  backup_retention_period         = 14
  preferred_backup_window         = "02:00-03:00"
  deletion_protection             = var.environment == "prod"
  skip_final_snapshot             = var.environment != "prod"
  enabled_cloudwatch_logs_exports = ["postgresql"]

  serverlessv2_scaling_configuration {
    min_capacity = 0.5
    max_capacity = 8
  }

  tags = var.tags
}

resource "aws_rds_cluster_instance" "this" {
  count               = 1
  cluster_identifier  = aws_rds_cluster.this.id
  instance_class      = "db.serverless"
  engine              = aws_rds_cluster.this.engine
  engine_version      = aws_rds_cluster.this.engine_version
  publicly_accessible = false
  tags                = var.tags
}

output "endpoint" {
  value     = aws_rds_cluster.this.endpoint
  sensitive = true
}
output "master_password" {
  value     = random_password.postgres.result
  sensitive = true
}
output "security_group_id" { value = aws_security_group.pg.id }
