##########################################################################
# FactoryMind — Kubernetes / ECS compute module.
#
# Supports two back-ends (choose via `var.compute_platform`):
#   - "eks" (AWS EKS, managed Kubernetes)
#   - "ecs" (ECS Fargate, serverless containers)
#
# This module intentionally publishes the minimum primitives the app layer
# needs. Node pool sizing, HPA, and PDB live in the k8s/ manifest directory
# (GitOps) rather than here.
##########################################################################

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.70" }
  }
}

variable "project_name" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "public_subnet_ids" { type = list(string) }
variable "compute_platform" {
  type    = string
  default = "ecs"
  validation {
    condition     = contains(["ecs", "eks"], var.compute_platform)
    error_message = "compute_platform must be ecs or eks"
  }
}
variable "tags" { type = map(string), default = {} }

# ECS branch ---------------------------------------------------------------
resource "aws_ecs_cluster" "this" {
  count = var.compute_platform == "ecs" ? 1 : 0
  name  = "${var.project_name}-cluster-${var.environment}"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = var.tags
}

# EKS branch ---------------------------------------------------------------
# Kept as a placeholder. To enable, set compute_platform = "eks" AND add a
# proper aws_eks_cluster + node-group block. We do not generate them here
# because EKS setup is extensive (IAM, node groups, add-ons) and better
# scaffolded via the official aws_eks module.
# See: https://registry.terraform.io/modules/terraform-aws-modules/eks/aws

output "compute_platform" { value = var.compute_platform }
output "ecs_cluster_arn" {
  value = var.compute_platform == "ecs" ? aws_ecs_cluster.this[0].arn : ""
}
