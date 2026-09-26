# Eval results: `iter_01` on puzzle P1

Rationale: LEARNED (baseline, own records only, BA 45.9%): dev labels use only 4 of the 12 queues (no_action 144, billing 69, account_access 27, shipping 16), so BA weights one account_access or shipping ticket 4-9x more than a no_action ticket. Most baseline errors are vocabulary mismatches, not missing data: Jev routes each system value to the queue whose description sounds closest, but in the labeled traces those values belong to other queues. admin-and-compliance was no_action in 8/8 traces (Jev: legal, often at 100%); reply_to_receipt_email no_action 7/7 (Jev splits billing/no_action); 'Just letting you know' no_action 6/6; payment_page_error billing 6/7 (Jev: technical); 'Something isn't working' billing 6 / account_access 3 / technical 0 (Jev: technical ~99%); order_or_return_page shipping 2/2 (Jev: returns); payments billing 2/2; orders-and-delivery shipping 2/3; data_export_requested no_action 1/1 (Jev: legal). Jev never predicted correctly when it said legal, technical or returns, and those queues have 0 dev tickets. A ticket with no records went to no_action at 100% (truth billing); that is a separate failure mode for neighbor context later. HYPOTHESIS: glossing each well-attested value with the queue it historically routes to will remove the semantic-mismatch errors. This run changes ONE thing vs baseline (adds glosses; same include_own k=3, same raw format) so the gain is attributable. product-usage and 'I need you to do something' (n=1 each) are deliberately left unglossed to see what they co-occur with. CONFIRM: BA >= 60%, legal/technical/returns mostly gone from traces, no_action accuracy > 75%, remaining worst traces dominated by no-record tickets, wrong records and the billing-vs-account_access ambiguity of 'Something isn't working'. REFUTE: BA < 52% or Jev still says legal/technical on glossed values (glosses ignored).
Prediction: balanced accuracy ~68%

| Score | Value |
|---|---|
| Balanced accuracy (mean of per-queue accuracy) | 71.2% |
| Balanced soft score (mean probability on the right queue, per queue) | 72.4% |
| Plain accuracy | 86.7% |
| Confident but wrong (confidence > 0.8) | 16 tickets |
| Jev's mean confidence (0-1, needs no labels) | 0.93 |
| Cost | 161370 input tokens for 256 tickets |

| Queue | Tickets | Accuracy |
|---|---|---|
| no_action | 144 | 99% |
| billing | 69 | 88% |
| account_access | 27 | 22% |
| shipping | 16 | 75% |

Accuracy by region (4 accounts x 4 weeks per cell):

| accounts \ weeks | W00-03 | W04-07 | W08-11 | W12-15 |
|---|---|---|---|---|
| A00-03 | 88% | 94% | 100% | 100% |
| A04-07 | 50% | 88% | 100% | 100% |
| A08-11 | 75% | 81% | 94% | 69% |
| A12-15 | 100% | 81% | 69% | 100% |

Jev's mean confidence by region (4 accounts x 4 weeks per cell):

| accounts \ weeks | W00-03 | W04-07 | W08-11 | W12-15 |
|---|---|---|---|---|
| A00-03 | 0.97 | 0.97 | 0.94 | 0.98 |
| A04-07 | 0.80 | 0.96 | 0.94 | 0.93 |
| A08-11 | 0.93 | 0.90 | 0.92 | 0.91 |
| A12-15 | 0.96 | 0.89 | 0.91 | 0.98 |

`render.png` is Jev's routing map: accounts are rows, weeks are columns, and each ticket is drawn in the probability-weighted mix of its queues' colors (see `palette.json`). Correct routing draws a clean picture.

## Traces: worst-routed tickets (10)

### Ticket A03-W03: WRONG. Right queue billing; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A03 in week 3 (ticket A03-W03).
Records:
(no records)
```

### Ticket A07-W00: WRONG. Right queue account_access; Jev said technical 87%, no_action 11%, feedback 2% (confidence 0.86)

```
Support ticket from account A07 in week 0 (ticket A07-W00).
Records:
- [customer-form] Ticket A07-W00: customer chose "I need you to do something"
- [analytics-export] Ticket A07-W00 topic cluster: product-usage
```

### Ticket A05-W07: WRONG. Right queue billing; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A05 in week 7 (ticket A05-W07).
Records:
(no records)
```

### Ticket A04-W02: WRONG. Right queue billing; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A04 in week 2 (ticket A04-W02).
Records:
(no records)
```

### Ticket A07-W03: WRONG. Right queue billing; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A07 in week 3 (ticket A07-W03).
Records:
(no records)
```

### Ticket A11-W13: WRONG. Right queue account_access; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A11 in week 13 (ticket A11-W13).
Records:
- [customer-form] Ticket A11-W13: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [event-log] Ticket A11-W13 event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
```

### Ticket A09-W01: WRONG. Right queue account_access; Jev said no_action 90%, technical 5%, feedback 3% (confidence 0.88)

```
Support ticket from account A09 in week 1 (ticket A09-W01).
Records:
- [customer-form] Ticket A09-W01: customer chose "I have a question"
```

### Ticket A09-W15: WRONG. Right queue account_access; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A09 in week 15 (ticket A09-W15).
Records:
(no records)
```

### Ticket A12-W11: WRONG. Right queue account_access; Jev said sales 98%, no_action 2%, billing 0% (confidence 0.97)

```
Support ticket from account A12 in week 11 (ticket A12-W11).
Records:
- [event-log] Ticket A12-W11 event: pricing_or_survey_page
```

### Ticket A13-W07: WRONG. Right queue account_access; Jev said technical 79%, feedback 14%, no_action 6% (confidence 0.77)

```
Support ticket from account A13 in week 7 (ticket A13-W07).
Records:
- [analytics-export] Ticket A13-W07 topic cluster: product-usage
```


## Traces: random sample of tickets (20)

### Ticket A00-W14: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A00 in week 14 (ticket A00-W14).
Records:
- [event-log] Ticket A00-W14 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
```

### Ticket A01-W04: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 0.99)

```
Support ticket from account A01 in week 4 (ticket A01-W04).
Records:
- [customer-form] Ticket A01-W04: customer chose "Just letting you know (in past routing usually no_action)"
- [analytics-export] Ticket A01-W04 topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [event-log] Ticket A01-W04 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
```

### Ticket A02-W11: correct. Right queue no_action; Jev said no_action 92%, billing 3%, account_access 3% (confidence 0.91)

```
Support ticket from account A02 in week 11 (ticket A02-W11).
Records:
- [analytics-export] Ticket A02-W11 topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [event-log] Ticket A02-W11 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [customer-form] Ticket A02-W11: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
```

### Ticket A05-W04: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A05 in week 4 (ticket A05-W04).
Records:
- [analytics-export] Ticket A05-W04 topic cluster: payments (in past routing usually billing)
- [customer-form] Ticket A05-W04: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [event-log] Ticket A05-W04 event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
```

### Ticket A06-W12: correct. Right queue no_action; Jev said no_action 97%, feedback 3%, billing 0% (confidence 0.97)

```
Support ticket from account A06 in week 12 (ticket A06-W12).
Records:
- [customer-form] Ticket A06-W12: customer chose "Just letting you know (in past routing usually no_action)"
```

### Ticket A07-W07: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A07 in week 7 (ticket A07-W07).
Records:
- [event-log] Ticket A07-W07 event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
```

### Ticket A08-W11: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A08 in week 11 (ticket A08-W11).
Records:
- [event-log] Ticket A08-W11 event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [analytics-export] Ticket A08-W11 topic cluster: payments (in past routing usually billing)
- [customer-form] Ticket A08-W11: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
```

### Ticket A08-W12: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A08 in week 12 (ticket A08-W12).
Records:
- [event-log] Ticket A08-W12 event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
```

### Ticket A09-W06: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A09 in week 6 (ticket A09-W06).
Records:
- [customer-form] Ticket A09-W06: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [analytics-export] Ticket A09-W06 topic cluster: payments (in past routing usually billing)
- [event-log] Ticket A09-W06 event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
```

### Ticket A09-W14: WRONG. Right queue account_access; Jev said security 61%, account_access 39%, billing 0% (confidence 0.56)

```
Support ticket from account A09 in week 14 (ticket A09-W14).
Records:
- [customer-form] Ticket A09-W14: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [analytics-export] Ticket A09-W14 topic cluster: identity
- [event-log] Ticket A09-W14 event: login_or_device_alert
```

### Ticket A11-W02: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A11 in week 2 (ticket A11-W02).
Records:
- [customer-form] Ticket A11-W02: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] Ticket A11-W02 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
```

### Ticket A12-W09: WRONG. Right queue account_access; Jev said security 59%, account_access 41%, billing 0% (confidence 0.54)

```
Support ticket from account A12 in week 9 (ticket A12-W09).
Records:
- [customer-form] Ticket A12-W09: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [event-log] Ticket A12-W09 event: login_or_device_alert
```

### Ticket A14-W00: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A14 in week 0 (ticket A14-W00).
Records:
- [event-log] Ticket A14-W00 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [customer-form] Ticket A14-W00: customer chose "Just letting you know (in past routing usually no_action)"
- [analytics-export] Ticket A14-W00 topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
```

### Ticket A14-W07: correct. Right queue no_action; Jev said no_action 96%, legal 4%, billing 0% (confidence 0.95)

```
Support ticket from account A14 in week 7 (ticket A14-W07).
Records:
- [analytics-export] Ticket A14-W07 topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
```

### Ticket A14-W10: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A14 in week 10 (ticket A14-W10).
Records:
- [analytics-export] Ticket A14-W10 topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [customer-form] Ticket A14-W10: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] Ticket A14-W10 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
```

### Ticket A14-W12: correct. Right queue no_action; Jev said no_action 96%, legal 4%, billing 0% (confidence 0.95)

```
Support ticket from account A14 in week 12 (ticket A14-W12).
Records:
- [analytics-export] Ticket A14-W12 topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
```

### Ticket A15-W03: correct. Right queue no_action; Jev said no_action 94%, technical 6%, billing 0% (confidence 0.93)

```
Support ticket from account A15 in week 3 (ticket A15-W03).
Records:
- [analytics-export] Ticket A15-W03 topic cluster: product-usage
- [event-log] Ticket A15-W03 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
```

### Ticket A15-W08: correct. Right queue no_action; Jev said no_action 99%, legal 1%, billing 0% (confidence 0.99)

```
Support ticket from account A15 in week 8 (ticket A15-W08).
Records:
- [analytics-export] Ticket A15-W08 topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [customer-form] Ticket A15-W08: customer chose "Just letting you know (in past routing usually no_action)"
```

### Ticket A15-W13: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A15 in week 13 (ticket A15-W13).
Records:
- [event-log] Ticket A15-W13 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [customer-form] Ticket A15-W13: customer chose "Just letting you know (in past routing usually no_action)"
```

### Ticket A15-W15: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A15 in week 15 (ticket A15-W15).
Records:
- [event-log] Ticket A15-W15 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
```
