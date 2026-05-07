##########################################################################
# FactoryMind — Infrastructure skeleton (AWS).
#
# Delivers the bones of a minimum-viable production deployment:
#   - VPC with public + private subnets (2 AZs).
#   - AWS IoT Core endpoint (MQTT broker as a service, TLS + X.509 certs).
#   - InfluxDB Cloud reference (or run self-hosted on ECS if no cloud).
#   - ECS Fargate cluster with one service per backend / frontend / grafana.
#   - Managed PostgreSQL (Aurora Serverless v2 for cost efficiency).
#
# Alternative Italian-sovereignty deployments are documented in the
# commented blocks at the end of this file (Aruba Cloud, OVHcloud Milano).
##########################################################################

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = merge(var.tags, {
      environment  = var.environment
      project_name = var.project_name
    })
  }
}

# ------------------------------------------------------------------- Network
data "aws_availability_zones" "available" { state = "available" }

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "${var.project_name}-vpc-${var.environment}" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags                    = { Name = "${var.project_name}-public-${count.index}" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 2)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = { Name = "${var.project_name}-private-${count.index}" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${var.project_name}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------- IoT Core
# AWS IoT Core acts as the managed MQTT broker. For tenants running at the
# SME scale FactoryMind targets, a single IoT Core endpoint handles
# millions of messages per day out of the box. Per-device authentication
# uses X.509 certificates issued by AWS IoT Just-in-Time Registration.

resource "aws_iot_thing_type" "machine" {
  name = "${var.project_name}-machine"
  tags = { description = "Industrial machine telemetry device" }
}

resource "aws_iot_policy" "device" {
  name = "${var.project_name}-device-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["iot:Connect"]
        Resource = "arn:aws:iot:${var.aws_region}:*:client/$${iot:Connection.Thing.ThingName}"
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Publish"]
        Resource = "arn:aws:iot:${var.aws_region}:*:topic/factory/*"
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Subscribe"]
        Resource = "arn:aws:iot:${var.aws_region}:*:topicfilter/factory/*"
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Receive"]
        Resource = "arn:aws:iot:${var.aws_region}:*:topic/factory/*"
      }
    ]
  })
}

# -------------------------------------------------------- ECS Fargate cluster
resource "aws_ecs_cluster" "app" {
  name = "${var.project_name}-cluster-${var.environment}"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# --------------------------------------------- Aurora PostgreSQL Serverless v2
resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project_name}-pg-subnet"
  subnet_ids = aws_subnet.private[*].id
}

# R-RDS-EGRESS-001 (F-HIGH-004): scoped egress, matches modules/db/main.tf.
# This top-level SG mirrors the module variant for the legacy flat layout
# customers; new deployments compose modules/db/. The two SGs converge on
# the same egress allow-list so a future `terraform state mv` to the
# module path doesn't trigger a re-create.
resource "aws_security_group" "postgres" {
  name        = "${var.project_name}-pg-sg"
  description = "Restrict access to FactoryMind RDS"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Intra-VPC"
  }
  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = [var.vpc_cidr]
    description = "DNS UDP (in-VPC resolver)"
  }
  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "DNS TCP (in-VPC resolver)"
  }
  egress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    prefix_list_ids = [data.aws_prefix_list.s3_main.id]
    description     = "S3 backups"
  }
  egress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.kms_main.id]
    description     = "KMS unwrap"
  }
  egress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cw_logs_main.id]
    description     = "CloudWatch Logs"
  }
}

data "aws_prefix_list" "s3_main" {
  name = "com.amazonaws.${data.aws_region.current_main.name}.s3"
}
data "aws_region" "current_main" {}
data "aws_ec2_managed_prefix_list" "kms_main" {
  name = "com.amazonaws.${data.aws_region.current_main.name}.kms"
}
data "aws_ec2_managed_prefix_list" "cw_logs_main" {
  name = "com.amazonaws.${data.aws_region.current_main.name}.logs"
}

resource "random_password" "postgres" {
  length  = 32
  special = false
}

resource "aws_rds_cluster" "postgres" {
  cluster_identifier              = "${var.project_name}-${var.environment}"
  engine                          = "aurora-postgresql"
  engine_mode                     = "provisioned"
  engine_version                  = "16.4"
  database_name                   = "factorymind"
  master_username                 = "factorymind"
  master_password                 = random_password.postgres.result
  storage_encrypted               = true
  db_subnet_group_name            = aws_db_subnet_group.postgres.name
  vpc_security_group_ids          = [aws_security_group.postgres.id]
  backup_retention_period         = 14
  preferred_backup_window         = "02:00-03:00"
  deletion_protection             = var.environment == "prod"
  skip_final_snapshot             = var.environment != "prod"
  enabled_cloudwatch_logs_exports = ["postgresql"]

  serverlessv2_scaling_configuration {
    min_capacity = 0.5
    max_capacity = 8
  }
}

resource "aws_rds_cluster_instance" "postgres" {
  count                = 1
  cluster_identifier   = aws_rds_cluster.postgres.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.postgres.engine
  engine_version       = aws_rds_cluster.postgres.engine_version
  db_subnet_group_name = aws_db_subnet_group.postgres.name
  publicly_accessible  = false
}

# ---------------------------------------------------- Secrets (Secrets Manager)
resource "aws_secretsmanager_secret" "factorymind" {
  name        = "${var.project_name}/${var.environment}"
  description = "Consolidated secret bundle for FactoryMind runtime"
}

resource "aws_secretsmanager_secret_version" "factorymind" {
  secret_id = aws_secretsmanager_secret.factorymind.id
  secret_string = jsonencode({
    DATABASE_URL    = "postgresql://factorymind:${random_password.postgres.result}@${aws_rds_cluster.postgres.endpoint}:5432/factorymind"
    INFLUX_URL      = var.influx_cloud_url
    INFLUX_TOKEN    = "" # populate via external secret management
    MQTT_BROKER_URL = "mqtts://${data.aws_iot_endpoint.current.endpoint_address}:8883"
    JWT_SECRET      = random_password.postgres.result # replace with a distinct secret
  })
}

data "aws_iot_endpoint" "current" {
  endpoint_type = "iot:Data-ATS"
}

##########################################################################
# Alternative: self-hosted InfluxDB OSS on ECS (uncomment to use).
#
# resource "aws_ecs_task_definition" "influxdb" { ... }
# resource "aws_ecs_service"        "influxdb" { ... }
#
# Alternative: sovereign Italian provider (Aruba, OVHcloud Milano, Seeweb).
# Replace the AWS provider block with:
#
# provider "openstack" {
#   auth_url    = "https://auth.cloud.ovh.net/v3/"
#   region      = "SBG5"          # or "GRA11", etc.
# }
#
# resource "openstack_compute_instance_v2" "factorymind" { ... }
##########################################################################
