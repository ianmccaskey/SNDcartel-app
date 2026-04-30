# SNDcartel App — Production Spec

## Overview
Group Buy marketplace platform. Users participate in time-limited group buys for products. Users place orders, submit crypto payment transactions, admins verify payments, manage allocations, and coordinate fulfillment.

## Core Features

### User Account System
- Required fields: username, email, password, shipping address, country, state/region, postal code, phone, optional crypto wallet
- Cannot place orders until profile complete
- Roles: user, admin
- Dashboard: active orders, pending payments, verification status, shipping status, tracking, order history

### Group Buy System
- Admin creates campaigns with: name, description, vendor, start/end dates, status (active/closed/fulfilled), payment wallet, supported payment networks
- Products per group buy: name, description, price, MOQ, weight, dimensions, images, vendor ref
- Orders contribute toward MOQ totals
- Admin dashboard shows MOQ progress

### Order System
- Orders: id, user_id, group_buy_id, order_status, payment_status, created_at
- OrderItems: id, order_id, product_id, quantity, price
- Statuses: pending_payment → payment_submitted → payment_verified → processing → shipped → completed

### Crypto Payment
- User submits: tx hash, blockchain network, amount sent, wallet used
- System: store tx info, generate explorer link, flag for admin review, ~5% tolerance
- Explorers: Etherscan, Solscan, Basescan

### Admin Panel
- Group buy CRUD + totals + MOQ progress
- Product CRUD + pricing + MOQ
- Order management: view all, filter, verify payments, mark processed/shipped
- Payment verification: review txs, compare expected vs submitted, approve/reject, explorer links
- Fulfillment: assign shipments, upload tracking + images, mark complete, partial shipments

### Shipping & Fulfillment
- Shipments: order_id, tracking_number, carrier, tracking_image, shipped_at
- Individual, batch, and partial shipments
- Users see updates in dashboard

### Analytics
- Revenue per group buy, total quantities, orders per product, pending/verified payments, fulfillment progress

## Database Tables
Users, GroupBuys, Products, Orders, OrderItems, Payments, Shipments, AdminActions (audit log)

## Technical Requirements
- Clean modular architecture, scalable folder structure
- Proper API layer, input validation, error handling
- Loading states, auth protection
- Remove all mock data
- Preserve existing v0 UI/UX
