# Eval results: `iter_05` on puzzle P1

Rationale: LEARNED (iter_04, noise glosses for data_export_requested/plans-and-opinions + firmer pricing gloss, BA 93.4% vs 89.9%, predicted 92%): the noise-gloss hypothesis was confirmed. Legal disappeared from the traces, shipping 75% -> 88% (14/16; A04-W01 fixed), billing 97% -> 99% (68/69; A07-W02 fixed), no_action held at 99%, confident-but-wrong 3 -> 2. The worst-10 list now contains every remaining error (8 wrong: 2 shipping, 3 account_access, 1 billing, 2 no_action, matching the per-queue counts exactly). They fall into four kinds. (a) A12-W11 (account_access, own record only pricing_or_survey_page): my firmer gloss 'in past routing account_access, never sales' backfired. Jev went sales 70% (iter_03 wording 'seen on account_access tickets, not sales': sales 33% / account_access 27%; iter_02, same wording without neighbors: correct). Naming the decoy queue in a gloss for a value that already sounds like that queue ('pricing') acts as positive evidence, so the negation is ignored. This was my own regression. (b) Tickets in the thin bands whose only own record is 'Something isn't working' (shipping A11-W04/W05 and billing A11-W06 -> account_access; account_access A12-W10 -> billing). Their box neighborhoods genuinely mix queues. A11-W04/W05 have no shipping evidence anywhere in their neighborhood, so I treat them as unrecoverable with these systems. (c) Wrong own records: A11-W13 (account_access carrying payment_page_error; billing 100%). (d) no_action tickets with a lone account_access-glossed own record against an all-no_action profile (A01-W05 product-usage, A04-W15 identity). Each is worth only ~0.17 BA, and softening those glosses would put account_access tickets at risk (~0.9 BA each), so I leave them. HYPOTHESIS: naming 'sales' in the pricing gloss is what pulls A12-W11 to sales. Stating only the positive association, with a short description of the queue, will route it to account_access despite the mixed profile. CHANGE vs iter_04: ONE gloss text (pricing_or_survey_page -> 'in past routing seen on account_access tickets (sign-in or access trouble)'). Nothing else changes. CONFIRM: A12-W11 -> account_access (account_access 25/27 = 93%), and every other queue unchanged (shipping 14/16, billing 68/69, no_action 142/144). REFUTE: A12-W11 still goes to sales, meaning the value name alone drives sales, or it goes to no_action, meaning the profile dominates a weak own gloss. Either way the next step is a noise gloss, or accepting the loss.
Prediction: balanced accuracy ~94.5%

| Score | Value |
|---|---|
| Balanced accuracy (mean of per-queue accuracy) | 93.4% |
| Balanced soft score (mean probability on the right queue, per queue) | 89.0% |
| Plain accuracy | 96.9% |
| Confident but wrong (confidence > 0.8) | 2 tickets |
| Jev's mean confidence (0-1, needs no labels) | 0.95 |
| Cost | 203292 input tokens for 256 tickets |

| Queue | Tickets | Accuracy |
|---|---|---|
| no_action | 144 | 99% |
| billing | 69 | 99% |
| account_access | 27 | 89% |
| shipping | 16 | 88% |

Accuracy by region (4 accounts x 4 weeks per cell):

| accounts \ weeks | W00-03 | W04-07 | W08-11 | W12-15 |
|---|---|---|---|---|
| A00-03 | 100% | 94% | 100% | 100% |
| A04-07 | 100% | 100% | 100% | 94% |
| A08-11 | 100% | 81% | 100% | 94% |
| A12-15 | 100% | 100% | 88% | 100% |

Jev's mean confidence by region (4 accounts x 4 weeks per cell):

| accounts \ weeks | W00-03 | W04-07 | W08-11 | W12-15 |
|---|---|---|---|---|
| A00-03 | 0.96 | 0.95 | 0.96 | 0.99 |
| A04-07 | 0.92 | 0.97 | 0.95 | 0.93 |
| A08-11 | 0.94 | 0.97 | 0.93 | 0.91 |
| A12-15 | 0.96 | 0.96 | 0.92 | 0.97 |

`render.png` is Jev's routing map: accounts are rows, weeks are columns, and each ticket is drawn in the probability-weighted mix of its queues' colors (see `palette.json`). Correct routing draws a clean picture.

## Traces: worst-routed tickets (10)

### Ticket A11-W05: WRONG. Right queue shipping; Jev said account_access 89%, billing 11%, refunds 0% (confidence 0.88)

```
Support ticket from account A11 in week 5 (ticket A11-W05).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 7 related tickets (box, radius 1)] analytics-export: identity (in past routing usually account_access (login, password, 2FA), rarely security) x2
- [profile: 7 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x6
- [profile: 7 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x2, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x2
```

### Ticket A11-W04: WRONG. Right queue shipping; Jev said account_access 83%, billing 17%, refunds 0% (confidence 0.80)

```
Support ticket from account A11 in week 4 (ticket A11-W04).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: identity (in past routing usually account_access (login, password, 2FA), rarely security) x3, orders-and-delivery (in past routing usually shipping) x1, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x6, Just letting you know (in past routing usually no_action) x1
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x2, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x2, data_export_requested (not a routing signal: in past routing it appeared on billing, shipping and no_action tickets alike, never legal; route by this ticket's other records and nearby tickets) x1, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1
```

### Ticket A11-W13: WRONG. Right queue account_access; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A11 in week 13 (ticket A11-W13).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [event-log] This ticket event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [profile: 8 related tickets (box, radius 1)] analytics-export: identity (in past routing usually account_access (login, password, 2FA), rarely security) x2, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2, plans-and-opinions (not a routing signal: appears on tickets of every kind, never sales or feedback in past routing; route by this ticket's other records and nearby tickets) x1, orders-and-delivery (in past routing usually shipping) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x2, Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x1
- [profile: 8 related tickets (box, radius 1)] event-log: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x1
```

### Ticket A11-W06: WRONG. Right queue billing; Jev said account_access 82%, billing 18%, refunds 0% (confidence 0.79)

```
Support ticket from account A11 in week 6 (ticket A11-W06).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 7 related tickets (box, radius 1)] analytics-export: identity (in past routing usually account_access (login, password, 2FA), rarely security) x2
- [profile: 7 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x5
- [profile: 7 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x3, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x3
```

### Ticket A01-W05: WRONG. Right queue no_action; Jev said account_access 77%, no_action 20%, technical 2% (confidence 0.74)

```
Support ticket from account A01 in week 5 (ticket A01-W05).
Records:
- [analytics-export] This ticket topic cluster: product-usage (in past routing usually account_access (trouble getting into the product), rarely technical)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x3
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x5, I need you to do something (in past routing seen on account_access tickets, rarely technical) x1
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x6
```

### Ticket A12-W11: WRONG. Right queue account_access; Jev said sales 56%, account_access 37%, billing 5% (confidence 0.51)

```
Support ticket from account A12 in week 11 (ticket A12-W11).
Records:
- [event-log] This ticket event: pricing_or_survey_page (in past routing seen on account_access tickets (sign-in or access trouble))
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2, orders-and-delivery (in past routing usually shipping) x1, identity (in past routing usually account_access (login, password, 2FA), rarely security) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x3, Just letting you know (in past routing usually no_action) x3
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1
```

### Ticket A12-W10: WRONG. Right queue account_access; Jev said billing 56%, account_access 43%, technical 1% (confidence 0.51)

```
Support ticket from account A12 in week 10 (ticket A12-W10).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: orders-and-delivery (in past routing usually shipping) x1, payments (in past routing usually billing) x1, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4, Just letting you know (in past routing usually no_action) x2
- [profile: 8 related tickets (box, radius 1)] event-log: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x2, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2, pricing_or_survey_page (in past routing seen on account_access tickets (sign-in or access trouble)) x1, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x1, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1
```

### Ticket A04-W15: WRONG. Right queue no_action; Jev said account_access 55%, no_action 44%, security 1% (confidence 0.51)

```
Support ticket from account A04 in week 15 (ticket A04-W15).
Records:
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [analytics-export] This ticket topic cluster: identity (in past routing usually account_access (login, password, 2FA), rarely security)
- [profile: 5 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x4
- [profile: 5 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x3
- [profile: 5 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1
```

### Ticket A11-W10: correct. Right queue shipping; Jev said shipping 54%, billing 43%, technical 2% (confidence 0.49)

```
Support ticket from account A11 in week 10 (ticket A11-W10).
Records:
- [analytics-export] This ticket topic cluster: orders-and-delivery (in past routing usually shipping)
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x2
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x6
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x3, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x1, pricing_or_survey_page (in past routing seen on account_access tickets (sign-in or access trouble)) x1
```

### Ticket A11-W11: correct. Right queue shipping; Jev said shipping 54%, billing 30%, account_access 13% (confidence 0.49)

```
Support ticket from account A11 in week 11 (ticket A11-W11).
Records:
- [event-log] This ticket event: order_or_return_page (in past routing usually shipping (delivery status), rarely returns)
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: orders-and-delivery (in past routing usually shipping) x2, identity (in past routing usually account_access (login, password, 2FA), rarely security) x1, payments (in past routing usually billing) x1, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x2, pricing_or_survey_page (in past routing seen on account_access tickets (sign-in or access trouble)) x1
```


## Traces: random sample of tickets (20)

### Ticket A00-W12: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A00 in week 12 (ticket A00-W12).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [profile: 5 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x3
- [profile: 5 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x5
- [profile: 5 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2
```

### Ticket A00-W14: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A00 in week 14 (ticket A00-W14).
Records:
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 5 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2
- [profile: 5 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x5
- [profile: 5 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2, data_export_requested (not a routing signal: in past routing it appeared on billing, shipping and no_action tickets alike, never legal; route by this ticket's other records and nearby tickets) x1
```

### Ticket A01-W02: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A01 in week 2 (ticket A01-W02).
Records:
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [profile: 7 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x4
- [profile: 7 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x4
- [profile: 7 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x6
```

### Ticket A01-W09: correct. Right queue no_action; Jev said no_action 74%, account_access 20%, sales 3% (confidence 0.72)

```
Support ticket from account A01 in week 9 (ticket A01-W09).
Records:
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: pricing_or_survey_page (in past routing seen on account_access tickets (sign-in or access trouble))
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x6
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x1, I need you to do something (in past routing seen on account_access tickets, rarely technical) x1
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x5, data_export_requested (not a routing signal: in past routing it appeared on billing, shipping and no_action tickets alike, never legal; route by this ticket's other records and nearby tickets) x1
```

### Ticket A01-W14: correct. Right queue no_action; Jev said no_action 99%, legal 1%, billing 0% (confidence 0.99)

```
Support ticket from account A01 in week 14 (ticket A01-W14).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: data_export_requested (not a routing signal: in past routing it appeared on billing, shipping and no_action tickets alike, never legal; route by this ticket's other records and nearby tickets)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x3, plans-and-opinions (not a routing signal: appears on tickets of every kind, never sales or feedback in past routing; route by this ticket's other records and nearby tickets) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x5
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x5
```

### Ticket A02-W04: correct. Right queue no_action; Jev said no_action 64%, account_access 31%, legal 4% (confidence 0.60)

```
Support ticket from account A02 in week 4 (ticket A02-W04).
Records:
- [customer-form] This ticket: customer chose "I need you to do something (in past routing seen on account_access tickets, rarely technical)"
- [profile: 7 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x4, product-usage (in past routing usually account_access (trouble getting into the product), rarely technical) x1
- [profile: 7 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x5
- [profile: 7 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x5
```

### Ticket A03-W14: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 0.99)

```
Support ticket from account A03 in week 14 (ticket A03-W14).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x5, plans-and-opinions (not a routing signal: appears on tickets of every kind, never sales or feedback in past routing; route by this ticket's other records and nearby tickets) x1, identity (in past routing usually account_access (login, password, 2FA), rarely security) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x2
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x5
```

### Ticket A04-W10: correct. Right queue no_action; Jev said no_action 99%, legal 1%, billing 0% (confidence 0.99)

```
Support ticket from account A04 in week 10 (ticket A04-W10).
Records:
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [profile: 6 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x5
- [profile: 6 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x6
- [profile: 6 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x3, data_export_requested (not a routing signal: in past routing it appeared on billing, shipping and no_action tickets alike, never legal; route by this ticket's other records and nearby tickets) x1
```

### Ticket A04-W14: correct. Right queue no_action; Jev said no_action 96%, legal 4%, billing 0% (confidence 0.95)

```
Support ticket from account A04 in week 14 (ticket A04-W14).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x4, identity (in past routing usually account_access (login, password, 2FA), rarely security) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x4
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x5
```

### Ticket A05-W06: correct. Right queue billing; Jev said billing 69%, account_access 29%, security 2% (confidence 0.65)

```
Support ticket from account A05 in week 6 (ticket A05-W06).
Records:
- [analytics-export] This ticket topic cluster: payments (in past routing usually billing)
- [event-log] This ticket event: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security)
- [profile: 7 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x5, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x1
- [profile: 7 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4, Just letting you know (in past routing usually no_action) x1
- [profile: 7 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x4, pricing_or_survey_page (in past routing seen on account_access tickets (sign-in or access trouble)) x1
```

### Ticket A05-W11: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 0.99)

```
Support ticket from account A05 in week 11 (ticket A05-W11).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [profile: 6 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2
- [profile: 6 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x4, Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x2
- [profile: 6 related tickets (box, radius 1)] event-log: data_export_requested (not a routing signal: in past routing it appeared on billing, shipping and no_action tickets alike, never legal; route by this ticket's other records and nearby tickets) x1, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x1, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1
```

### Ticket A08-W01: correct. Right queue account_access; Jev said account_access 99%, security 1%, billing 0% (confidence 0.99)

```
Support ticket from account A08 in week 1 (ticket A08-W01).
Records:
- [event-log] This ticket event: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security)
- [profile: 8 related tickets (box, radius 1)] analytics-export: orders-and-delivery (in past routing usually shipping) x2, product-usage (in past routing usually account_access (trouble getting into the product), rarely technical) x1, plans-and-opinions (not a routing signal: appears on tickets of every kind, never sales or feedback in past routing; route by this ticket's other records and nearby tickets) x1, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x2, I have a question (in past routing seen on account_access tickets, not sales) x2, I need you to do something (in past routing seen on account_access tickets, rarely technical) x1, Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x1
- [profile: 8 related tickets (box, radius 1)] event-log: order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x2, data_export_requested (not a routing signal: in past routing it appeared on billing, shipping and no_action tickets alike, never legal; route by this ticket's other records and nearby tickets) x1
```

### Ticket A08-W07: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A08 in week 7 (ticket A08-W07).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x6
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x5
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x7
```

### Ticket A09-W10: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A09 in week 10 (ticket A09-W10).
Records:
- [event-log] This ticket event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [analytics-export] This ticket topic cluster: payments (in past routing usually billing)
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x4
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x7
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x5, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1
```

### Ticket A10-W01: correct. Right queue no_action; Jev said no_action 98%, shipping 1%, account_access 1% (confidence 0.98)

```
Support ticket from account A10 in week 1 (ticket A10-W01).
Records:
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2, identity (in past routing usually account_access (login, password, 2FA), rarely security) x1, orders-and-delivery (in past routing usually shipping) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x3, I have a question (in past routing seen on account_access tickets, not sales) x2, I need you to do something (in past routing seen on account_access tickets, rarely technical) x1, Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x1
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1
```

### Ticket A10-W02: correct. Right queue account_access; Jev said account_access 99%, billing 1%, refunds 0% (confidence 0.99)

```
Support ticket from account A10 in week 2 (ticket A10-W02).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [analytics-export] This ticket topic cluster: identity (in past routing usually account_access (login, password, 2FA), rarely security)
- [profile: 8 related tickets (box, radius 1)] analytics-export: orders-and-delivery (in past routing usually shipping) x2, payments (in past routing usually billing) x1, identity (in past routing usually account_access (login, password, 2FA), rarely security) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: I have a question (in past routing seen on account_access tickets, not sales) x2, Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x1, Just letting you know (in past routing usually no_action) x1
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x3, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1, data_export_requested (not a routing signal: in past routing it appeared on billing, shipping and no_action tickets alike, never legal; route by this ticket's other records and nearby tickets) x1, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x1, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x1
```

### Ticket A10-W03: correct. Right queue shipping; Jev said shipping 80%, billing 17%, account_access 2% (confidence 0.78)

```
Support ticket from account A10 in week 3 (ticket A10-W03).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [analytics-export] This ticket topic cluster: orders-and-delivery (in past routing usually shipping)
- [event-log] This ticket event: data_export_requested (not a routing signal: in past routing it appeared on billing, shipping and no_action tickets alike, never legal; route by this ticket's other records and nearby tickets)
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x2, identity (in past routing usually account_access (login, password, 2FA), rarely security) x2, orders-and-delivery (in past routing usually shipping) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4, I have a question (in past routing seen on account_access tickets, not sales) x1, Just letting you know (in past routing usually no_action) x1
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x3, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x1, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1
```

### Ticket A11-W02: correct. Right queue no_action; Jev said no_action 99%, account_access 1%, billing 0% (confidence 0.99)

```
Support ticket from account A11 in week 2 (ticket A11-W02).
Records:
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 8 related tickets (box, radius 1)] analytics-export: identity (in past routing usually account_access (login, password, 2FA), rarely security) x2, orders-and-delivery (in past routing usually shipping) x2, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x2, Just letting you know (in past routing usually no_action) x2
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x4, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x1, data_export_requested (not a routing signal: in past routing it appeared on billing, shipping and no_action tickets alike, never legal; route by this ticket's other records and nearby tickets) x1
```

### Ticket A13-W06: correct. Right queue account_access; Jev said account_access 100%, billing 0%, refunds 0% (confidence 0.99)

```
Support ticket from account A13 in week 6 (ticket A13-W06).
Records:
- [analytics-export] This ticket topic cluster: identity (in past routing usually account_access (login, password, 2FA), rarely security)
- [event-log] This ticket event: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x4, identity (in past routing usually account_access (login, password, 2FA), rarely security) x2, product-usage (in past routing usually account_access (trouble getting into the product), rarely technical) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x2, Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x2, I need you to do something (in past routing seen on account_access tickets, rarely technical) x1
- [profile: 8 related tickets (box, radius 1)] event-log: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x3, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2
```

### Ticket A13-W15: correct. Right queue no_action; Jev said no_action 98%, legal 2%, billing 0% (confidence 0.98)

```
Support ticket from account A13 in week 15 (ticket A13-W15).
Records:
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [profile: 5 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x5
- [profile: 5 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x1
- [profile: 5 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x3
```
