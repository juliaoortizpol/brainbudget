# Product context

## Current implementation
BrainBudget is the API for the Finances project; ChillBudget is its frontend.
The repository contains password and Google authentication, user persistence,
accounts and institutions, budgets and budget items, transaction CRUD/filtering/
pagination, Gmail connection/reading, and a transaction-mail import pipeline.
The parser registry includes APAP and Qik credit-card mail parsers.

Budgets have monthly/weekly/custom periods and draft/active/closed status.
Creating budgets preserves existing budgets/items. Drafts coexist with at most one
active budget per owner. Active v1 coverage continues until manual closure,
independently of optional planning. Spending uses inclusive start / exclusive actual
cutoff and absolute expense amounts rounded to two decimals. See
[coverage contract](budget-coverage.md) for migration and verification boundaries.
Transactions may be manual or Gmail-sourced. Imported messages have a per-user
deduplication key. Accounts and budgets use soft deletion in their services;
transaction removal currently uses physical deletion.

## Requirements and open decisions
Trello acceptance criteria govern each change. This inventory describes code,
not a claim that every feature has passed end-to-end QA.
Currency conversion, monetary storage policy and reporting-period timezone rules
need explicit requirements before changing existing calculations.
Do not infer transfer, recurring-payment or bank synchronization capabilities
from naming alone. Gmail mail import is not a direct bank API connection.
