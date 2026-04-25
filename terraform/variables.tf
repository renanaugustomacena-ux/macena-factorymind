variable "project_name" {
  description = "Resource-naming prefix"
  type        = string
  default     = "factorymind"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of dev, staging, prod"
  }
}

variable "aws_region" {
  description = "AWS region (prefer eu-south-1 Milan for Italian data residency, or eu-central-1 Frankfurt)"
  type        = string
  default     = "eu-south-1"
}

variable "vpc_cidr" {
  description = "CIDR for the application VPC"
  type        = string
  default     = "10.60.0.0/16"
}

variable "influx_cloud_url" {
  description = "InfluxDB Cloud endpoint (blank when using self-hosted on ECS/EC2)"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Apex domain for public frontend"
  type        = string
  default     = "factorymind.example"
}

variable "tags" {
  description = "Additional tags applied to all resources"
  type        = map(string)
  default = {
    managed_by    = "terraform"
    application   = "factorymind"
    business_unit = "industrial-iot"
  }
}
