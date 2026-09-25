# Production launch checklist

## Infrastructure
- [ ] Managed PostgreSQL with automated backups
- [ ] HTTPS/TLS and secure DNS
- [ ] Secrets manager
- [ ] WAF/CDN and rate limiting
- [ ] Centralized logs and alerting
- [ ] Monitoring and uptime checks

## Identity and security
- [ ] Replace demo accounts/passwords
- [ ] Email verification
- [ ] Password reset
- [ ] MFA for administrators
- [ ] Session revocation and device/session management
- [ ] CSRF strategy if cookie-authenticated browser APIs are expanded
- [ ] Security headers
- [ ] Dependency and container scanning
- [ ] Independent penetration test

## Commerce
- [ ] Payment provider account and verified webhooks
- [ ] Refund/chargeback workflow
- [ ] Courier account and live tracking webhooks
- [ ] Delivery addresses and shipping calculation
- [ ] Seller KYC/business verification
- [ ] VAT/tax handling
- [ ] Seller settlement/reconciliation
- [ ] Returns and consumer-law workflows

## South Africa legal/compliance
- [ ] POPIA/privacy documentation
- [ ] Terms of use
- [ ] Seller agreement
- [ ] Returns/refunds policy
- [ ] Consumer Protection Act review
- [ ] Electronic Communications and Transactions Act review
- [ ] Tax/VAT review with a qualified South African professional

## Testing
- [ ] Unit tests
- [ ] API integration tests
- [ ] Checkout concurrency tests
- [ ] Payment webhook replay/idempotency tests
- [ ] Authorization tests for every role
- [ ] Backup restore test
- [ ] Load test
