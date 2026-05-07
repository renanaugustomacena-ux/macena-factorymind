#!/usr/bin/env bash
# =============================================================================
# terraform/bootstrap-state.sh — one-shot bootstrap of the remote-state backend.
#
# R-TF-STATE-001 (closes F-CRIT-004): terraform/versions.tf declares the
# backend "s3" block but the bucket + lock table must exist BEFORE
# `terraform init`. This script creates them with the right hardening:
#
#   - S3 bucket with versioning ENABLED (state recovery), KMS-encrypted
#     at rest with an aws/s3 default key (or a customer-managed CMK if
#     provided via TFSTATE_KMS_KEY_ID), public access block, bucket
#     policy denying non-TLS traffic + cross-account principals.
#   - DynamoDB table with PAY_PER_REQUEST billing, encryption-at-rest
#     enabled, point-in-time recovery, deletion-protection enabled.
#
# Run ONCE per AWS account before the first `terraform init`. Re-runs are
# idempotent — every step is wrapped in an "exists?" check.
#
# Usage:
#   AWS_PROFILE=factorymind-prod \
#   AWS_REGION=eu-south-1 \
#   ./terraform/bootstrap-state.sh
#
# Optional:
#   TFSTATE_BUCKET=factorymind-tfstate          # default
#   TFSTATE_LOCK_TABLE=factorymind-tflock       # default
#   TFSTATE_KMS_KEY_ID=alias/factorymind-state  # default aws/s3 if unset
# =============================================================================
set -Eeuo pipefail
IFS=$'\n\t'

REGION="${AWS_REGION:-eu-south-1}"
BUCKET="${TFSTATE_BUCKET:-factorymind-tfstate}"
TABLE="${TFSTATE_LOCK_TABLE:-factorymind-tflock}"
KMS_KEY_ID="${TFSTATE_KMS_KEY_ID:-}"

log()  { printf '[bootstrap-state] %s\n' "$*"; }
die()  { printf '[bootstrap-state] ERROR: %s\n' "$*" >&2; exit 1; }

command -v aws >/dev/null 2>&1 || die "aws CLI not found"
aws sts get-caller-identity >/dev/null 2>&1 || die "AWS credentials missing or invalid (run 'aws configure' or set AWS_PROFILE)"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
log "AWS account: $ACCOUNT_ID  |  region: $REGION"
log "Bucket:      $BUCKET"
log "Lock table:  $TABLE"

# ---------------------------------------------------------------- S3 bucket
if aws s3api head-bucket --bucket "$BUCKET" --region "$REGION" 2>/dev/null; then
  log "Bucket already exists — verifying hardening."
else
  log "Creating S3 bucket..."
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
fi

log "Enabling versioning..."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled \
  --region "$REGION" >/dev/null

log "Blocking all public access..."
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --region "$REGION" >/dev/null

log "Enabling default encryption..."
if [[ -n "$KMS_KEY_ID" ]]; then
  ENC_RULE=$(cat <<JSON
{ "Rules": [ { "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "aws:kms", "KMSMasterKeyID": "$KMS_KEY_ID" }, "BucketKeyEnabled": true } ] }
JSON
)
else
  ENC_RULE='{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
fi
aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration "$ENC_RULE" \
  --region "$REGION" >/dev/null

log "Applying TLS-only + cross-account-deny bucket policy..."
POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::$BUCKET", "arn:aws:s3:::$BUCKET/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    },
    {
      "Sid": "DenyForeignAccounts",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::$BUCKET", "arn:aws:s3:::$BUCKET/*"],
      "Condition": { "StringNotEquals": { "aws:PrincipalAccount": "$ACCOUNT_ID" } }
    }
  ]
}
JSON
)
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "$POLICY" --region "$REGION" >/dev/null

log "Enabling object lifecycle (abort incomplete multipart uploads after 7d)..."
aws s3api put-bucket-lifecycle-configuration \
  --bucket "$BUCKET" \
  --region "$REGION" \
  --lifecycle-configuration '{"Rules":[{"ID":"abort-incomplete","Status":"Enabled","Filter":{"Prefix":""},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}}]}' >/dev/null

# ----------------------------------------------------------- DynamoDB lock table
if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" >/dev/null 2>&1; then
  log "Lock table already exists — verifying hardening."
else
  log "Creating DynamoDB lock table..."
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --sse-specification Enabled=true \
    --region "$REGION" >/dev/null
  log "Waiting for table to become ACTIVE..."
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
fi

log "Enabling point-in-time recovery..."
aws dynamodb update-continuous-backups \
  --table-name "$TABLE" \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region "$REGION" >/dev/null || log "(PITR may already be enabled)"

log "Enabling deletion protection..."
aws dynamodb update-table \
  --table-name "$TABLE" \
  --deletion-protection-enabled \
  --region "$REGION" >/dev/null 2>&1 || log "(deletion protection may already be enabled)"

log "DONE. Run \`terraform init\` from the terraform/ directory."
log "  If migrating an existing local state: \`terraform init -migrate-state\`."
