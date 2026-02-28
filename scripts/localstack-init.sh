#!/bin/bash
# LocalStack S3 bucket initialization script
# Runs automatically when LocalStack is ready.

echo "Creating veritlog-storage S3 bucket in LocalStack..."
awslocal s3 mb s3://veritlog-storage --region ap-south-1
awslocal s3api put-bucket-cors \
  --bucket veritlog-storage \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["http://localhost:3000"],
      "MaxAgeSeconds": 3000
    }]
  }'
echo "S3 bucket ready."
