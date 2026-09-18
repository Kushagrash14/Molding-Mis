# PG Electroplast — Injection Molding Production & OEE Tracking MIS

A full-stack enterprise shop-floor production, downtime, rejection, and OEE tracking system designed for injection molding manufacturing plants.

---

## Features

- **Shopfloor Entry Form**: Fast, error-proof multi-mold entry supporting mid-shift mold changes with automatic time window calculations.
- **SAP Product Master**: Live auto-fill for 1,146+ SAP products with standard cavities, shots/hr, cycle times, part weight, runner weight, and price.
- **Defect & Downtime Tracking**: Modal-based fast entry for 13 rejection defect types and 21 planned/unplanned downtime reasons.
- **Real-Time OEE Engine**: Live calculation of Availability (A), Performance (P), Quality Rate (Q), and Overall Equipment Effectiveness (OEE %).
- **Enterprise RBAC**: Role-based access control for Operators, Supervisors, and Plant Administrators.
- **Audit Logging**: Silent tracking of all post-lock adjustments and supervisor overrides.
- **Centralized Cloud Database**: AWS RDS (MySQL) relational backend with multi-plant and multi-machine support.

---

## Getting Started

### Local Development:
```bash
npm install
npm run dev
```

### Production Build:
```bash
npm run build
```

---

## AWS Deployment

See [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md) for full deployment instructions on AWS EC2 with AWS RDS (MySQL).

---

## Tech Stack

- **Frontend**: React 18, Vite 5
- **Backend API**: Node.js, Express
- **Database**: AWS RDS MySQL
- **Process Manager**: PM2
- **Web Server**: Nginx Reverse Proxy

