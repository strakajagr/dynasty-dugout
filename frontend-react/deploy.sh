#!/bin/bash
npm run build
# Upload everything
aws s3 sync build/ s3://fantasy-baseball-frontend-strakajagr --delete
# Force no-cache on HTML files
aws s3 cp s3://fantasy-baseball-frontend-strakajagr/ s3://fantasy-baseball-frontend-strakajagr/ \
  --recursive --exclude "*" --include "*.html" \
  --metadata-directive REPLACE \
  --cache-control "no-cache, no-store, must-revalidate, max-age=0" \
  --content-type "text/html"
# Invalidate BOTH CloudFront distributions
aws cloudfront create-invalidation --distribution-id E3D451GEGCN6CL --paths "/*"
aws cloudfront create-invalidation --distribution-id E20B8XDXCIFHQ4 --paths "/*"