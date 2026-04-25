terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
  # Remote state (adjust to your own backend):
  # backend "s3" {
  #   bucket         = "factorymind-tfstate"
  #   key            = "prod/factorymind.tfstate"
  #   region         = "eu-south-1"
  #   dynamodb_table = "factorymind-tflock"
  #   encrypt        = true
  # }
}
