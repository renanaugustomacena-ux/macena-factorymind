# FactoryMind — Terraform layout

Infrastructure-as-Code for FactoryMind. Historically a single flat `main.tf`;
as of Mission II.5 remediation (2026-04-18) it is split into 7 canonical
modules plus a top-level `main.tf` that wires them.

## Layout

```
terraform/
  main.tf                     # top-level composition — imports the 7 modules
  variables.tf                # shared inputs
  outputs.tf                  # top-level outputs
  versions.tf                 # provider version locks
  modules/
    vpc/                      # VPC, subnets, IGW, flow logs
    k8s/                      # ECS Fargate cluster (or EKS switch)
    db/                       # Aurora PostgreSQL Serverless v2
    storage/                  # S3 buckets (static, backups, audit)
    cdn_waf/                  # CloudFront + WAFv2
    secrets/                  # Secrets Manager bundle
    observability/            # CloudWatch log groups + alarms
```

## Why modules

The v2.0 plan §11 requires each of the 7 canonical infrastructure concerns
to be independently composable so that a customer can swap (for example)
AWS CDN for an Italian-sovereign equivalent (Seeweb, Aruba) without
touching the rest of the stack. Flat `main.tf` made that refactor
implicit; module layout makes it explicit.

## Migrating existing state

The original `main.tf` created resources in the root module. If you have
existing state, run `terraform state mv` for each resource before the
first `terraform apply`:

```sh
terraform state mv aws_vpc.main module.vpc.aws_vpc.this
terraform state mv 'aws_subnet.public[0]' 'module.vpc.aws_subnet.public[0]'
# ...
```

See `docs/runbooks/terraform-migrate.md` (to be populated) for the full
mapping.

## Italian-sovereignty alternative

Set `var.cloud_provider = "aruba"` or `"ovh-milano"` to swap the AWS
provider block for an OpenStack provider pointing at the respective
Italian data center. Not fully implemented yet — tracked as future work.
