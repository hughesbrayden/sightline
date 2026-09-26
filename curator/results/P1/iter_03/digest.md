# Eval results: `iter_03` on puzzle P1

Rationale: LEARNED (iter_02, account_access glosses, BA 84.6% vs 71.2%, predicted 78%): the account_access vocabulary hypothesis was confirmed. account_access rose from 22% to 78% (21/27), login_or_device_alert/identity/'I have a question' tickets now route correctly at ~99%, and no_action slipped only from 99% to 97% (A01-W05, a lone product-usage record on a no_action ticket, went to account_access; product-usage is now 2 account_access / 2 no_action across traces). billing 88% (61/69), shipping 75% (12/16). Vocabulary is no longer the bottleneck. The remaining errors come from missing or uninformative own records. (a) No-record tickets: 5 billing tickets (A03-W03, A04-W02, A05-W07, A07-W03, A10-W06) and 1 account_access (A09-W15) went to no_action at 100%. (b) Tickets whose only record is 'Something isn't working', which occurs on billing 9, account_access 6, shipping 3 and no_action 1 traced tickets: shipping A11-W04/A11-W05 went to billing ~62%, account_access A06-W00 to billing 65%. (c) Wrong records (A11-W13, account_access with payment_page_error). Placing all 74 labeled traces on the account x week grid, over the iter_02 render, gives a clear picture: a billing core (~A03-A12 x W02-W13), a thin shipping band on its edge and a thin account_access band outside that, on a no_action background. In a box-radius-1 neighborhood, every no-record billing ticket has a billing majority (4-8 of 8 neighbors), and A09-W15 has an account_access majority. But ring tickets have mixed neighborhoods, so if Jev over-trusts neighbors the thin high-weight bands could erode. HYPOTHESIS: a compact neighbor profile will let Jev fill in missing own evidence, while own glossed records still dominate when present. CHANGE vs iter_02 (one treatment: neighbor context): add include_related scope=box radius=1 filter=all show=profile k=3 after own records, and switch format to relative so Jev can tell this ticket's records from related ones. Glosses and include_own are unchanged. CONFIRM: billing >= 94% with the no-record billing tickets correct in traces, and account_access and shipping each within 1 ticket of iter_02 (>= 74% and >= 69%). REFUTE (Jev over-trusts neighbors): account_access or shipping drops by 2 or more tickets, with ring tickets that have a correct own record flipped to the neighborhood majority in traces. In that case the next run will limit neighbor influence (filter lookalike, fewer tickets, or one scope). If billing does not improve, Jev ignores profiles and I will try raw neighbor lines.
Prediction: balanced accuracy ~86%

| Score | Value |
|---|---|
| Balanced accuracy (mean of per-queue accuracy) | 89.9% |
| Balanced soft score (mean probability on the right queue, per queue) | 87.2% |
| Plain accuracy | 95.7% |
| Confident but wrong (confidence > 0.8) | 3 tickets |
| Jev's mean confidence (0-1, needs no labels) | 0.95 |
| Cost | 201126 input tokens for 256 tickets |

| Queue | Tickets | Accuracy |
|---|---|---|
| no_action | 144 | 99% |
| billing | 69 | 97% |
| account_access | 27 | 89% |
| shipping | 16 | 75% |

Accuracy by region (4 accounts x 4 weeks per cell):

| accounts \ weeks | W00-03 | W04-07 | W08-11 | W12-15 |
|---|---|---|---|---|
| A00-03 | 100% | 94% | 100% | 100% |
| A04-07 | 88% | 100% | 100% | 94% |
| A08-11 | 100% | 81% | 94% | 94% |
| A12-15 | 100% | 100% | 88% | 100% |

Jev's mean confidence by region (4 accounts x 4 weeks per cell):

| accounts \ weeks | W00-03 | W04-07 | W08-11 | W12-15 |
|---|---|---|---|---|
| A00-03 | 0.96 | 0.95 | 0.94 | 0.98 |
| A04-07 | 0.87 | 0.97 | 0.96 | 0.94 |
| A08-11 | 0.92 | 0.97 | 0.93 | 0.94 |
| A12-15 | 0.96 | 0.96 | 0.91 | 0.97 |

`render.png` is Jev's routing map: accounts are rows, weeks are columns, and each ticket is drawn in the probability-weighted mix of its queues' colors (see `palette.json`). Correct routing draws a clean picture.

## Traces: worst-routed tickets (10)

### Ticket A11-W04: WRONG. Right queue shipping; Jev said account_access 85%, billing 14%, no_action 1% (confidence 0.83)

```
Support ticket from account A11 in week 4 (ticket A11-W04).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: identity (in past routing usually account_access (login, password, 2FA), rarely security) x3, orders-and-delivery (in past routing usually shipping) x1, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x6, Just letting you know (in past routing usually no_action) x1
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x2, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x2, data_export_requested (in past routing usually no_action, not legal) x1, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1
```

### Ticket A11-W05: WRONG. Right queue shipping; Jev said account_access 89%, billing 11%, refunds 0% (confidence 0.88)

```
Support ticket from account A11 in week 5 (ticket A11-W05).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 7 related tickets (box, radius 1)] analytics-export: identity (in past routing usually account_access (login, password, 2FA), rarely security) x2
- [profile: 7 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x6
- [profile: 7 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x2, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x2
```

### Ticket A11-W13: WRONG. Right queue account_access; Jev said billing 99%, account_access 1%, refunds 0% (confidence 0.99)

```
Support ticket from account A11 in week 13 (ticket A11-W13).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [event-log] This ticket event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [profile: 8 related tickets (box, radius 1)] analytics-export: identity (in past routing usually account_access (login, password, 2FA), rarely security) x2, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2, plans-and-opinions x1, orders-and-delivery (in past routing usually shipping) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x2, Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x1
- [profile: 8 related tickets (box, radius 1)] event-log: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x1
```

### Ticket A07-W02: WRONG. Right queue billing; Jev said legal 48%, no_action 18%, billing 16% (confidence 0.43)

```
Support ticket from account A07 in week 2 (ticket A07-W02).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [event-log] This ticket event: data_export_requested (in past routing usually no_action, not legal)
- [analytics-export] This ticket topic cluster: plans-and-opinions
- [profile: 7 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x3, orders-and-delivery (in past routing usually shipping) x2
- [profile: 7 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x2
- [profile: 7 related tickets (box, radius 1)] event-log: order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x2, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x1, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x1
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

### Ticket A04-W01: WRONG. Right queue shipping; Jev said legal 47%, no_action 21%, shipping 20% (confidence 0.42)

```
Support ticket from account A04 in week 1 (ticket A04-W01).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [event-log] This ticket event: data_export_requested (in past routing usually no_action, not legal)
- [analytics-export] This ticket topic cluster: orders-and-delivery (in past routing usually shipping)
- [profile: 7 related tickets (box, radius 1)] analytics-export: identity (in past routing usually account_access (login, password, 2FA), rarely security) x1, orders-and-delivery (in past routing usually shipping) x1, payments (in past routing usually billing) x1
- [profile: 7 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x5
- [profile: 7 related tickets (box, radius 1)] event-log: order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x2, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x2, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x1
```

### Ticket A12-W11: WRONG. Right queue account_access; Jev said sales 33%, account_access 27%, billing 14% (confidence 0.27)

```
Support ticket from account A12 in week 11 (ticket A12-W11).
Records:
- [event-log] This ticket event: pricing_or_survey_page (in past routing seen on account_access tickets, not sales)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2, orders-and-delivery (in past routing usually shipping) x1, identity (in past routing usually account_access (login, password, 2FA), rarely security) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x3, Just letting you know (in past routing usually no_action) x3
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1
```

### Ticket A12-W10: WRONG. Right queue account_access; Jev said billing 63%, account_access 35%, technical 1% (confidence 0.59)

```
Support ticket from account A12 in week 10 (ticket A12-W10).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: orders-and-delivery (in past routing usually shipping) x1, payments (in past routing usually billing) x1, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4, Just letting you know (in past routing usually no_action) x2
- [profile: 8 related tickets (box, radius 1)] event-log: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x2, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2, pricing_or_survey_page (in past routing seen on account_access tickets, not sales) x1, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x1, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1
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


## Traces: random sample of tickets (20)

### Ticket A00-W14: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A00 in week 14 (ticket A00-W14).
Records:
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 5 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2
- [profile: 5 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x5
- [profile: 5 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x2, data_export_requested (in past routing usually no_action, not legal) x1
```

### Ticket A01-W14: correct. Right queue no_action; Jev said no_action 93%, legal 7%, billing 0% (confidence 0.92)

```
Support ticket from account A01 in week 14 (ticket A01-W14).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: data_export_requested (in past routing usually no_action, not legal)
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x3, plans-and-opinions x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x5
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x5
```

### Ticket A02-W03: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A02 in week 3 (ticket A02-W03).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 7 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2
- [profile: 7 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x3, I need you to do something (in past routing seen on account_access tickets, rarely technical) x1, Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x1
- [profile: 7 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x5, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x1
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

### Ticket A02-W07: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A02 in week 7 (ticket A02-W07).
Records:
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2
- [profile: 8 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x3
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x7
```

### Ticket A03-W15: correct. Right queue no_action; Jev said no_action 98%, legal 2%, billing 0% (confidence 0.97)

```
Support ticket from account A03 in week 15 (ticket A03-W15).
Records:
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [profile: 5 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x3, identity (in past routing usually account_access (login, password, 2FA), rarely security) x1, plans-and-opinions x1
- [profile: 5 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x1
- [profile: 5 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x4
```

### Ticket A04-W04: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A04 in week 4 (ticket A04-W04).
Records:
- [event-log] This ticket event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [analytics-export] This ticket topic cluster: orders-and-delivery (in past routing usually shipping)
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 7 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x4, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x1
- [profile: 7 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4, Just letting you know (in past routing usually no_action) x1
- [profile: 7 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x4, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1
```

### Ticket A05-W12: correct. Right queue no_action; Jev said no_action 99%, legal 1%, billing 0% (confidence 0.99)

```
Support ticket from account A05 in week 12 (ticket A05-W12).
Records:
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [profile: 7 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x3
- [profile: 7 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x5, Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x1
- [profile: 7 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x3, data_export_requested (in past routing usually no_action, not legal) x1, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x1
```

### Ticket A07-W03: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 0.99)

```
Support ticket from account A07 in week 3 (ticket A07-W03).
Records:
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x4, plans-and-opinions x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x3, data_export_requested (in past routing usually no_action, not legal) x1, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1
```

### Ticket A08-W02: correct. Right queue shipping; Jev said shipping 97%, billing 2%, account_access 1% (confidence 0.96)

```
Support ticket from account A08 in week 2 (ticket A08-W02).
Records:
- [event-log] This ticket event: order_or_return_page (in past routing usually shipping (delivery status), rarely returns)
- [profile: 7 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x2, orders-and-delivery (in past routing usually shipping) x2, plans-and-opinions x1
- [profile: 7 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x2, I have a question (in past routing seen on account_access tickets, not sales) x2
- [profile: 7 related tickets (box, radius 1)] event-log: data_export_requested (in past routing usually no_action, not legal) x1, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x1, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x1
```

### Ticket A08-W03: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A08 in week 3 (ticket A08-W03).
Records:
- [analytics-export] This ticket topic cluster: payments (in past routing usually billing)
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 7 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x3, plans-and-opinions x1, orders-and-delivery (in past routing usually shipping) x1
- [profile: 7 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x3, I have a question (in past routing seen on account_access tickets, not sales) x1
- [profile: 7 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x3, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x2, data_export_requested (in past routing usually no_action, not legal) x1
```

### Ticket A08-W04: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A08 in week 4 (ticket A08-W04).
Records:
- [analytics-export] This ticket topic cluster: payments (in past routing usually billing)
- [profile: 7 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x5
- [profile: 7 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4
- [profile: 7 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x5
```

### Ticket A08-W05: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A08 in week 5 (ticket A08-W05).
Records:
- [event-log] This ticket event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x6
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x4
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x5
```

### Ticket A09-W03: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A09 in week 3 (ticket A09-W03).
Records:
- [event-log] This ticket event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [analytics-export] This ticket topic cluster: payments (in past routing usually billing)
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x3, orders-and-delivery (in past routing usually shipping) x2, identity (in past routing usually account_access (login, password, 2FA), rarely security) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x5, I have a question (in past routing seen on account_access tickets, not sales) x1
- [profile: 8 related tickets (box, radius 1)] event-log: order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x2, payment_page_error (in past routing usually billing (failed or declined payment), not technical) x2, data_export_requested (in past routing usually no_action, not legal) x1
```

### Ticket A09-W04: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A09 in week 4 (ticket A09-W04).
Records:
- [analytics-export] This ticket topic cluster: payments (in past routing usually billing)
- [event-log] This ticket event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x4, orders-and-delivery (in past routing usually shipping) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x5
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x4, data_export_requested (in past routing usually no_action, not legal) x1
```

### Ticket A09-W08: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A09 in week 8 (ticket A09-W08).
Records:
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [analytics-export] This ticket topic cluster: payments (in past routing usually billing)
- [event-log] This ticket event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x3
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x7
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x5, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1
```

### Ticket A10-W10: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A10 in week 10 (ticket A10-W10).
Records:
- [event-log] This ticket event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [customer-form] This ticket: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [analytics-export] This ticket topic cluster: payments (in past routing usually billing)
- [profile: 8 related tickets (box, radius 1)] analytics-export: payments (in past routing usually billing) x3, orders-and-delivery (in past routing usually shipping) x1
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x7
- [profile: 8 related tickets (box, radius 1)] event-log: payment_page_error (in past routing usually billing (failed or declined payment), not technical) x4, reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x1, order_or_return_page (in past routing usually shipping (delivery status), rarely returns) x1
```

### Ticket A11-W02: correct. Right queue no_action; Jev said no_action 99%, account_access 1%, billing 0% (confidence 0.99)

```
Support ticket from account A11 in week 2 (ticket A11-W02).
Records:
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 8 related tickets (box, radius 1)] analytics-export: identity (in past routing usually account_access (login, password, 2FA), rarely security) x2, orders-and-delivery (in past routing usually shipping) x2, admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x2
- [profile: 8 related tickets (box, radius 1)] customer-form: Something isn't working (vague; in past routing usually billing or account_access, rarely technical) x2, Just letting you know (in past routing usually no_action) x2
- [profile: 8 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x4, login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security) x1, data_export_requested (in past routing usually no_action, not legal) x1
```

### Ticket A15-W03: correct. Right queue no_action; Jev said no_action 85%, account_access 15%, billing 0% (confidence 0.83)

```
Support ticket from account A15 in week 3 (ticket A15-W03).
Records:
- [analytics-export] This ticket topic cluster: product-usage (in past routing usually account_access (trouble getting into the product), rarely technical)
- [event-log] This ticket event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [profile: 4 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x1
- [profile: 4 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x3
- [profile: 4 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x3
```

### Ticket A15-W08: correct. Right queue no_action; Jev said no_action 99%, legal 1%, billing 0% (confidence 0.99)

```
Support ticket from account A15 in week 8 (ticket A15-W08).
Records:
- [analytics-export] This ticket topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [customer-form] This ticket: customer chose "Just letting you know (in past routing usually no_action)"
- [profile: 5 related tickets (box, radius 1)] analytics-export: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal) x4
- [profile: 5 related tickets (box, radius 1)] customer-form: Just letting you know (in past routing usually no_action) x2
- [profile: 5 related tickets (box, radius 1)] event-log: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing) x3
```
