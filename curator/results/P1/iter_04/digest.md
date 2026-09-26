# Eval results: `iter_04` on puzzle P1

Rationale: LEARNED (iter_03, + box r1 neighbor profile + relative format, BA 89.9% vs 84.6%, predicted 86%): the neighbor hypothesis was confirmed, with no band erosion. billing 88% -> 97% (the no-record core tickets are fixed, e.g. A07-W03 billing 100% from its profile alone), account_access 78% -> 89% (24/27), no_action 97% -> 99%, shipping flat at 75% (12/16). Confident-but-wrong fell 9 -> 3. Own glossed records still dominate when present (A01-W05 kept its own product-usage gloss against an all-no_action profile). REMAINING ERRORS in the worst 10 fall into three kinds. (1) Decoy values glossed as if they were signals: data_export_requested now shows up on no_action 2, billing 1 and shipping 1 own traces, and often in billing-core profiles, so it is noise, not a no_action signal. When it co-occurs with conflicting records, Jev falls back to legal despite the gloss: A04-W01 (shipping, legal 47%) and A07-W02 (billing, legal 48%, which also carried the new unglossed analytics value plans-and-opinions). plans-and-opinions appears in profiles in both the billing core and no_action areas, so it also looks like noise. pricing_or_survey_page (account_access A12-W11) was correct in iter_02 on its soft gloss alone, but the mixed profile diluted it to sales 33% / account_access 27%. (2) Tickets in the thin bands whose only own record is 'Something isn't working' (shipping A11-W04/W05 -> account_access, billing A11-W06 -> account_access, account_access A12-W10 -> billing). Their neighborhoods genuinely mix queues, and 'Something isn't working' appears on billing 15 / account_access 7 / shipping 4 / no_action 1 traced tickets, although my gloss names only billing and account_access. That is deferred to a separate run. (3) Wrong own records (A11-W13, A04-W15), which cannot be fixed. HYPOTHESIS: glossing noise values as noise, rather than as a queue, will stop the legal fallback and hand the decision to the ticket's real records and its neighbors; a firmer pricing gloss will survive a mixed profile. CHANGE vs iter_03: gloss text only, for 3 values (data_export_requested -> noise; new plans-and-opinions -> noise; pricing_or_survey_page -> 'account_access, never sales'). Neighbor op, format and all other glosses are unchanged. CONFIRM: no legal answers in traces; A04-W01 -> shipping, A07-W02 -> billing, A12-W11 -> account_access if they appear; shipping >= 81% (13/16), billing >= 97%, account_access >= 89%. REFUTE: legal still appears on data_export_requested tickets, or no_action falls below 97% (would mean data_export_requested was carrying real no_action signal).
Prediction: balanced accuracy ~92%

| Score | Value |
|---|---|
| Balanced accuracy (mean of per-queue accuracy) | 93.4% |
| Balanced soft score (mean probability on the right queue, per queue) | 88.9% |
| Plain accuracy | 96.9% |
| Confident but wrong (confidence > 0.8) | 2 tickets |
| Jev's mean confidence (0-1, needs no labels) | 0.95 |
| Cost | 203130 input tokens for 256 tickets |

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
| A00-03 | 0.96 | 0.95 | 0.97 | 0.99 |
| A04-07 | 0.92 | 0.96 | 0.95 | 0.93 |
| A08-11 | 0.94 | 0.97 | 0.95 | 0.91 |
| A12-15 | 0.96 | 0.96 | 0.94 | 0.97 |

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

### Ticket A12-W11: WRONG. Right queue account_access; Jev said sales 70%, account_access 14%, no_action 6% (confidence 0.66)

```
Support ticket from account A12 in week 11 (ticket A12-W11).
Records:
- [event-log] This ticket event: pricing_or_survey_page (in past routing account_access, never sales)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2, orders-and-delivery (in past routing usually shipping) x1, identity (in past routing usually account_access (login, password, 2FA), rarely security) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x3, Just letting you know (in past routing usually no_action) x3
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1
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

### Ticket A12-W10: WRONG. Right queue account_access; Jev said billing 70%, account_access 29%, no_action 1% (confidence 0.67)

```
Support ticket from account A12 in week 10 (ticket A12-W10).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: orders-and-delivery (in past routing usually shipping) x1, payments (in past routing usually billing) x1, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4, Just letting you know (in past routing usually no_action) x2
- [profile: 8 related tickets (box, radius 1)] event-log: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x2, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2, pricing_or_survey_page (in past routing account_access, never sales) x1, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x1, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1
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

### Ticket A05-W10: correct. Right queue no_action; Jev said no_action 54%, billing 42%, account_access 2% (confidence 0.49)

```
Support ticket from account A05 in week 10 (ticket A05-W10).
Records:
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x4, payments (in past routing usually billing) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x5, Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x2, I have a question (in past routing seen on account_access tickets, not sales) x1
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x2, data_export_requested (not a routing signal: in past routing it appeared on billing, shipping and no_action tickets alike, never legal; route by this ticket's other records and nearby tickets) x1
```

### Ticket A11-W10: correct. Right queue shipping; Jev said shipping 56%, billing 42%, account_access 1% (confidence 0.50)

```
Support ticket from account A11 in week 10 (ticket A11-W10).
Records:
- [analytics-export] This ticket topic cluster: orders-and-delivery (in past routing usually shipping)
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x2
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x6
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x3, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x1, pricing_or_survey_page (in past routing account_access, never sales) x1
```


## Traces: random sample of tickets (20)

### Ticket A00-W05: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A00 in week 5 (ticket A00-W05).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 5 related tickets (box, radius 1)] analytics-export: product-usage (in past routing usually account_access (trouble getting into the product), rarely technical) x1, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x1
- [profile: 5 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x4
- [profile: 5 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x3
```

### Ticket A00-W07: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A00 in week 7 (ticket A00-W07).
Records:
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [profile: 5 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2
- [profile: 5 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x3
- [profile: 5 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x4
```

### Ticket A01-W00: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A01 in week 0 (ticket A01-W00).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 4 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x4
- [profile: 4 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x3
- [profile: 4 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2
```

### Ticket A01-W07: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A01 in week 7 (ticket A01-W07).
Records:
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x3
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x4
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x6
```

### Ticket A01-W10: correct. Right queue no_action; Jev said no_action 99%, legal 1%, billing 0% (confidence 0.99)

```
Support ticket from account A01 in week 10 (ticket A01-W10).
Records:
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x5
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x4, I need you to do something (in past routing seen on account_access tickets, rarely technical) x1, Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x1
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x3, pricing_or_survey_page (in past routing account_access, never sales) x1, data_export_requested (not a routing signal: in past routing it appeared on billing, shipping and no_action tickets alike, never legal; route by this ticket's other records and nearby tickets) x1
```

### Ticket A04-W09: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A04 in week 9 (ticket A04-W09).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 6 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2, product-usage (in past routing usually account_access (trouble getting into the product), rarely technical) x1, payments (in past routing usually billing) x1
- [profile: 6 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x4
- [profile: 6 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x4, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x1
```

### Ticket A06-W08: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A06 in week 8 (ticket A06-W08).
Records:
- [analytics-export] This ticket topic cluster: payments (in past routing usually billing)
- [profile: 7 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x4
- [profile: 7 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x3, I have a question (in past routing seen on account_access tickets, not sales) x1, Just letting you know (in past routing usually no_action) x1
- [profile: 7 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x4, pricing_or_survey_page (in past routing account_access, never sales) x1
```

### Ticket A07-W07: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A07 in week 7 (ticket A07-W07).
Records:
- [event-log] This ticket event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x5
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x4, pricing_or_survey_page (in past routing account_access, never sales) x1
```

### Ticket A08-W08: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A08 in week 8 (ticket A08-W08).
Records:
- [event-log] This ticket event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [analytics-export] This ticket topic cluster: payments (in past routing usually billing)
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x3
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x7
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x5
```

### Ticket A08-W15: correct. Right queue account_access; Jev said account_access 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A08 in week 15 (ticket A08-W15).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [analytics-export] This ticket topic cluster: identity (in past routing usually account_access (login, password, 2FA), rarely security)
- [event-log] This ticket event: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security)
- [profile: 4 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2, orders-and-delivery (in past routing usually shipping) x1, identity (in past routing usually account_access (login, password, 2FA), rarely security) x1
- [profile: 4 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x2, Just letting you know (in past routing usually no_action) x1
- [profile: 4 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x1
```

### Ticket A09-W11: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A09 in week 11 (ticket A09-W11).
Records:
- [analytics-export] This ticket topic cluster: payments (in past routing usually billing)
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x5, orders-and-delivery (in past routing usually shipping) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x6
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

### Ticket A10-W05: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A10 in week 5 (ticket A10-W05).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [event-log] This ticket event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [profile: 7 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x3
- [profile: 7 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x6
- [profile: 7 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x3
```

### Ticket A11-W00: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 0.99)

```
Support ticket from account A11 in week 0 (ticket A11-W00).
Records:
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [profile: 5 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2
- [profile: 5 related tickets (box, radius 1)] customer-form: I need you to do something (in past routing seen on account_access tickets, rarely technical) x1
- [profile: 5 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x4
```

### Ticket A12-W05: correct. Right queue account_access; Jev said account_access 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A12 in week 5 (ticket A12-W05).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [event-log] This ticket event: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security)
- [analytics-export] This ticket topic cluster: identity (in past routing usually account_access (login, password, 2FA), rarely security)
- [profile: 8 related tickets (box, radius 1)] analytics-export: identity (in past routing usually account_access (login, password, 2FA), rarely security) x2, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4, Just letting you know (in past routing usually no_action) x1
- [profile: 8 related tickets (box, radius 1)] event-log: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x2, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1
```

### Ticket A13-W01: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A13 in week 1 (ticket A13-W01).
Records:
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x4, orders-and-delivery (in past routing usually shipping) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x5
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x6
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

### Ticket A13-W11: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A13 in week 11 (ticket A13-W11).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x3
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x3, Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x1
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x3, pricing_or_survey_page (in past routing account_access, never sales) x1
```

### Ticket A14-W14: correct. Right queue no_action; Jev said no_action 95%, legal 5%, billing 0% (confidence 0.95)

```
Support ticket from account A14 in week 14 (ticket A14-W14).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [profile: 7 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x3
- [profile: 7 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x5
- [profile: 7 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x5, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1
```

### Ticket A15-W13: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 0.99)

```
Support ticket from account A15 in week 13 (ticket A15-W13).
Records:
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [profile: 4 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x4
- [profile: 4 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x2
- [profile: 4 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1
```
