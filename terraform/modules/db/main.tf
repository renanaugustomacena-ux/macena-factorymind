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
variable "tags" { type = map(string), default = {} }
variable "engine_version" { type = string, default = "16.4" }

resource "random_password" "postgres" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.project_name}-pg-subnet-${var.environment}"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}

resource "aws_security_group" "pg" {
  name        = "${var.project_name}-pg-sg-${var.environment}"
  description = "Postgres access — intra-VPC only"
  vpc_id      = var.vpc_id
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Intra-VPC only"
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
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
  count              = 1
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version
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
