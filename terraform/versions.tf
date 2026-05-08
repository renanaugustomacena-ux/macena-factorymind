terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.44"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # R-TF-STATE-001 (closes F-CRIT-004): remote state with S3 + DynamoDB
  # locking. The bucket and lock table are created once-per-account by
  # `terraform/bootstrap-state.sh`; that script applies the hardening
  # (versioning, KMS encryption, public-access block, TLS-only bucket
  # policy, cross-account-deny, lifecycle rules, PITR + deletion
  # protection on the lock table). Production MUST run the bootstrap
  # before the first `terraform init`.
  #
  # The `key` is environment-scoped via -backend-config at init time,
  # e.g.: `terraform init -backend-config="key=staging/factorymind.tfstate"`.
  # The default below targets prod.
  backend "s3" {
    bucket         = "factorymind-tfstate"
    key            = "prod/factorymind.tfstate"
    region         = "eu-south-1"
    dynamodb_table = "factorymind-tflock"
    encrypt        = true
  }
}
