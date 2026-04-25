output "vpc_id" {
  description = "VPC identifier"
  value       = aws_vpc.main.id
}

output "private_subnets" {
  description = "Private subnet IDs (ECS Fargate tasks)"
  value       = aws_subnet.private[*].id
}

output "public_subnets" {
  description = "Public subnet IDs (load balancer)"
  value       = aws_subnet.public[*].id
}

output "postgres_cluster_endpoint" {
  description = "Writer endpoint for Aurora PostgreSQL"
  value       = aws_rds_cluster.postgres.endpoint
  sensitive   = true
}

output "iot_endpoint" {
  description = "AWS IoT Core data endpoint (for MQTT connect)"
  value       = data.aws_iot_endpoint.current.endpoint_address
}

output "secrets_manager_arn" {
  description = "ARN of the consolidated secrets bundle"
  value       = aws_secretsmanager_secret.factorymind.arn
}

output "ecs_cluster_arn" {
  description = "Fargate cluster ARN"
  value       = aws_ecs_cluster.app.arn
}
