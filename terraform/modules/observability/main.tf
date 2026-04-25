##########################################################################
# FactoryMind — Observability module.
#
# Provisions Grafana Cloud stack / CloudWatch log groups + alarms.
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
  log_groups = [
    "/app/${var.project_name}/backend",
    "/app/${var.project_name}/mosquitto",
    "/app/${var.project_name}/alert-engine",
    "/app/${var.project_name}/influxdb"
  ]
}

resource "aws_cloudwatch_log_group" "this" {
  count             = length(local.log_groups)
  name              = "${local.log_groups[count.index]}-${var.environment}"
  retention_in_days = 90
  tags              = var.tags
}

resource "aws_cloudwatch_metric_alarm" "backend_5xx" {
  alarm_name          = "${var.project_name}-backend-5xx-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Backend 5xx > 10/min — check app health"
  tags                = var.tags
}

output "log_group_names" { value = aws_cloudwatch_log_group.this[*].name }
