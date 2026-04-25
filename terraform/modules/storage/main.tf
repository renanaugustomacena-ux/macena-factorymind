##########################################################################
# FactoryMind — Object storage module.
#
# Provisions S3 buckets for:
#   - frontend static assets (private, served via CloudFront)
#   - backup artifacts (Postgres dumps, Influx snapshots, SBOM)
#   - audit-log archive (migrated partitions after 24 months)
##########################################################################

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.70" }
  }
}

variable "project_name" { type = string }
variable "environment" { type = string }
variable "tags" { type = map(string), default = {} }

locals {
  buckets = {
    static  = "${var.project_name}-static-${var.environment}"
    backups = "${var.project_name}-backups-${var.environment}"
    audit   = "${var.project_name}-audit-${var.environment}"
  }
}

resource "aws_s3_bucket" "this" {
  for_each = local.buckets
  bucket   = each.value
  tags     = merge(var.tags, { purpose = each.key })
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each                = aws_s3_bucket.this
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.this["backups"].id
  rule {
    id     = "expire-old-backups"
    status = "Enabled"
    expiration { days = 30 }
    noncurrent_version_expiration { noncurrent_days = 7 }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "audit" {
  bucket = aws_s3_bucket.this["audit"].id
  rule {
    id     = "glacier-after-1year"
    status = "Enabled"
    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }
}

output "bucket_names" {
  value = { for k, v in aws_s3_bucket.this : k => v.id }
}
